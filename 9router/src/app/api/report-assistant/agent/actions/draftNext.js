import { NextResponse } from "next/server";
import {
  normalizeAgentState,
  setAgentActivity,
  setReportLunaChatId,
  setReportLunaMessageId
} from "../agentActivity";
import { runSupabaseRag, runWebRag } from "../rag";
import { callLLM, isLunaModelId } from "../llm";
import { LeaseManager } from "../leaseManager";
import { handleDraftFinalize } from "./draftFinalize";
import {
  stripOutlineNumberPrefix,
  shouldUseWebRagForSection,
  getLastCompletedYears,
  isInternshipB49ReportSection,
  isCareerOrientationReportSection,
  reportContextPrompt,
  isReferenceOnlySection,
  sanitizeReportDraftContent,
  isB49OpeningSection,
  sanitizeB49OpeningDraftContent,
  hasSubstantiveDraftContent,
  validateDraftQuality,
  normalizeOutlineMatchText,
  logAgentStep
} from "../utils";
import {
  sanitizeCareerSectionIV,
  normalizeSignatureTable,
  throwIfCancelled,
  checkPreconditions,
  retryWithFreshLunaChat
} from "../draftNextHelpers";

export async function handleDraftNext(ctx) {
  const {
    chatId,
    username,
    currentState,
    reportSession,
    targetModelId,
    authToken,
    requestBaseUrl,
    prompts,
    turso,
    getAgentState,
    saveAgentState,
    claimWorkerLease,
    releaseWorkerLease
  } = ctx;

  if (!currentState) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }

  if (currentState.current_step === "REVIEW_REQUIRED" || currentState.current_step === "COMPLETED" || currentState.current_step === "CANCELLED") {
    return NextResponse.json({ ok: true, state: currentState, message: "Agent run completed, cancelled or requires review." });
  }

  normalizeAgentState(currentState);
  const progress = currentState.sections_progress || [];
  const nextToDraft = progress.find((p) => p.status === "todo" || p.status === "drafting" || p.status === "stream_drafting");
  const activeReportContext =
    nextToDraft?.reportContext ||
    currentState.outline?.[0]?.reportContext ||
    progress.find((p) => p.reportContext)?.reportContext ||
    null;

  if (!nextToDraft) {
    const allDoneState = {
      ...currentState,
      current_step: "COMPLETED",
    };
    await saveAgentState(chatId, username, allDoneState);
    return NextResponse.json({ ok: true, state: allDoneState, message: "All sections completed!" });
  }

  // Claim lease first
  const lockId = crypto.randomUUID();
  const nowStr = new Date().toISOString();
  let leaseClaimed = false;
  try {
    leaseClaimed = await claimWorkerLease({ chatId, username, lockId, now: nowStr });
  } catch (dbErr) {
    console.error("[agent/route] DB Error claiming lease:", dbErr);
    return NextResponse.json({ error: `Database error claiming lease: ${dbErr.message}` }, { status: 500 });
  }
  if (!leaseClaimed) {
    return NextResponse.json({
      ok: true,
      workerAlreadyRunning: true,
      state: currentState,
      message: "Another worker is currently processing this report."
    });
  }

  // Create lease manager instance
  const leaseManager = new LeaseManager(turso, chatId, username, lockId);

  // Mark section as stream_drafting
  nextToDraft.status = "stream_drafting";
  setAgentActivity(currentState, nextToDraft, "section_started", `Agent bắt đầu xử lý mục: ${nextToDraft.title}`, {
    actor: "Report Agent",
    sectionId: nextToDraft.id,
  });
  logAgentStep("SECTION_DRAFT_START", { chatId, sectionId: nextToDraft.id, title: nextToDraft.title, model: targetModelId });

  try {
    await checkPreconditions(leaseManager, getAgentState, chatId, username);
    await saveAgentState(chatId, username, currentState, null, lockId);
  } catch (err) {
    await leaseManager.release();
    if (err.code === "LEASE_LOST") {
      const { data: latestState } = await getAgentState(chatId, username);
      return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost." });
    }
    if (err.code === "CONCURRENCY_CONFLICT") {
      return NextResponse.json(
        { error: "Concurrency conflict: State was updated by another request.", code: "CONCURRENCY_CONFLICT" },
        { status: 409 }
      );
    }
    throw err;
  }
  try {
    await checkPreconditions(leaseManager, getAgentState, chatId, username);
  } catch (err) {
    await leaseManager.release();
    const { data: latestState } = await getAgentState(chatId, username);
    return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: cancelled or lease lost." });
  }

  // 1. Search Planning (Heuristic RAG - 0ms)
  let supabaseQuery = "";
  let webQuery = "";

  const cleanTitle = stripOutlineNumberPrefix(nextToDraft.title);
  supabaseQuery = cleanTitle;
  webQuery = cleanTitle;

  if (activeReportContext) {
    const contextQuery = [
      activeReportContext.studyIssue,
      activeReportContext.targetCompany,
      activeReportContext.analysisYearLabel,
    ]
      .filter(Boolean)
      .join(" ");
    supabaseQuery = `${contextQuery} ${supabaseQuery}`.trim();
    webQuery = `${contextQuery} ${webQuery}`.trim();
  }

  setAgentActivity(currentState, nextToDraft, "search_plan_ready", "Agent đã lập truy vấn thông tin dạng heuristic cực nhanh (0ms).", {
    actor: "Planner",
    supabaseQuery,
    webQuery,
  });

  try {
    await saveAgentState(chatId, username, currentState, null, lockId);
  } catch (err) {
    await leaseManager.release();
    const { data: latestState } = await getAgentState(chatId, username);
    return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost during planning." });
  }

  // 2. Execute Supabase RAG and Web RAG in parallel
  let supabaseRAGContent = "";
  let webRAGContent = "";
  let webSources = [];
  const useWebRag = !!webQuery && shouldUseWebRagForSection(nextToDraft, activeReportContext);

  setAgentActivity(currentState, nextToDraft, "rag_parallel_started", useWebRag
    ? "Agent đang đọc tài liệu nội bộ và tìm kiếm web song song."
    : "Agent đang đọc tài liệu nội bộ; bỏ qua Web RAG cho mục này để tăng tốc.", {
    actor: "RAG",
    supabaseQuery,
    webQuery: useWebRag ? webQuery : "",
    webSkipped: !useWebRag,
  });
  try {
    await saveAgentState(chatId, username, currentState, null, lockId);
  } catch (err) {
    await leaseManager.release();
    const { data: latestState } = await getAgentState(chatId, username);
    return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost during RAG trigger." });
  }

  const [supabaseResult, webResult] = await Promise.allSettled([
    runSupabaseRag({ supabaseQuery, username, requestBaseUrl, activeReportContext, authToken, reportType: currentState?.reportType }),
    runWebRag({ useWebRag, webQuery, requestBaseUrl, authToken }),
  ]);

  if (supabaseResult.status === "fulfilled") {
    supabaseRAGContent = supabaseResult.value || "";
  } else {
    console.warn("Execute Supabase RAG failed:", supabaseResult.reason?.message || supabaseResult.reason);
  }

  if (webResult.status === "fulfilled") {
    webRAGContent = webResult.value?.content || "";
    webSources = webResult.value?.sources || [];
  } else {
    console.warn("Execute Web RAG failed:", webResult.reason?.message || webResult.reason);
  }

  setAgentActivity(currentState, nextToDraft, "rag_parallel_ready", "Agent đã hoàn tất truy xuất tri thức cho mục này.", {
    actor: "RAG",
    internalMatched: !!supabaseRAGContent,
    webSources: webSources.length,
    webSkipped: !useWebRag,
  });
  try {
    await saveAgentState(chatId, username, currentState, null, lockId);
  } catch (err) {
    await leaseManager.release();
    const { data: latestState } = await getAgentState(chatId, username);
    return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost after RAG ready." });
  }
  await throwIfCancelled(getAgentState, chatId, username);

  // Construct drafting prompt (Scope Control)
  const previousDone = progress.filter((p) => p.status === "done");
  const lastDoneContent = previousDone.length > 0 ? previousDone[previousDone.length - 1].content : "";

  // Dispatch system prompt theo reportType lưu trong state (uu tiên), fallback sang regex detect
  const reportType = currentState?.reportType;
  const isB49 = reportType ? reportType === "b49" : isInternshipB49ReportSection(nextToDraft);
  const isCareer = reportType ? reportType === "career" : isCareerOrientationReportSection(nextToDraft);

  let systemPrompt = "";
  if (isCareer) {
    systemPrompt = prompts.getDraftingSystemCareer({
      analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
      reportContextPromptText: reportContextPrompt(activeReportContext, progress.length, nextToDraft.target_words),
      outlineJsonString: JSON.stringify(currentState.outline, null, 2),
      lastDoneContent,
    });
  } else if (isB49) {
    systemPrompt = prompts.getDraftingSystemB49({
      analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
      reportContextPromptText: reportContextPrompt(activeReportContext, progress.length, nextToDraft.target_words),
      outlineJsonString: JSON.stringify(currentState.outline, null, 2),
      lastDoneContent,
    });
  } else {
    systemPrompt = prompts.getDraftingSystemStandard({
      analysisYearsText: activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
      reportContextPromptText: reportContextPrompt(activeReportContext, progress.length, nextToDraft.target_words),
      outlineJsonString: JSON.stringify(currentState.outline, null, 2),
      lastDoneContent,
    });
  }
  // If this is a references-only section, override to a specialized listing prompt
  const isRefSection = nextToDraft.is_reference_section || isReferenceOnlySection(nextToDraft);
  const userPromptMsg = isRefSection
    ? prompts.getReferencesUser(supabaseRAGContent, webRAGContent)
    : prompts.getDraftingUser({
      nextToDraftId: nextToDraft.id,
      nextToDraftTitle: nextToDraft.title,
      nextToDraftDescription: nextToDraft.description,
      styleGuidance: nextToDraft.style_guidance,
      targetWords: nextToDraft.target_words,
      subsections: nextToDraft.subsections,
      feedback: nextToDraft.feedback,
      supabaseRAGContent,
      webRAGContent,
    });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPromptMsg }
  ];

  setAgentActivity(currentState, nextToDraft, "drafting_content", "Agent đang soạn nội dung chi tiết cho mục này.", {
    actor: "Writer",
    model: targetModelId,
    sectionId: nextToDraft.id,
  });
  try {
    await saveAgentState(chatId, username, currentState, null, lockId);
  } catch (err) {
    await leaseManager.release();
    const { data: latestState } = await getAgentState(chatId, username);
    return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost before drafting content." });
  }

  const isSolutionOrConclusion = /giai phap|kien nghi|ket luan/i.test(normalizeOutlineMatchText(nextToDraft.title));
  const draftTemperature = isSolutionOrConclusion ? 0.65 : 0.4;

  let draftResult = "";
  let attempts = 0;
  const maxDraftAttempts = 3;
  let dynamicUserPrompt = userPromptMsg;

  try {
    while (attempts < maxDraftAttempts) {
      attempts++;
      try {
        if (attempts > 1) {
          const { data: updatedState } = await getAgentState(chatId, username);
          if (updatedState?.current_step === "CANCELLED") {
            normalizeAgentState(updatedState);
            return NextResponse.json({ ok: true, state: updatedState, message: "Agent run cancelled." });
          }
          const stateToSave = updatedState || currentState;

          // Reset Luna session context parameters for retry attempts
          retryWithFreshLunaChat(reportSession, stateToSave);

          setAgentActivity(
            stateToSave,
            nextToDraft,
            "drafting_retry",
            `Lỗi chất lượng hoặc cấu trúc mục: ${attempts === 2 ? "chất lượng văn bản chưa đạt" : "đang tối ưu chiều sâu phân tích"}. Hệ thống đang tự động khởi tạo chat mới để xử lý lại (lần ${attempts}/${maxDraftAttempts})...`,
            {
              actor: "Writer",
              model: targetModelId,
              sectionId: nextToDraft.id,
              attempt: attempts,
            }
          );
          await saveAgentState(chatId, username, stateToSave, null, lockId);
        }

        await throwIfCancelled(getAgentState, chatId, username);
        let lastSaveTime = 0;
        const onChunk = async (partialText) => {
          if (!partialText) return;
          nextToDraft.content = partialText;
          const now = Date.now();
          if (now - lastSaveTime > 50) {
            lastSaveTime = now;
            try {
              await saveAgentState(chatId, username, currentState, null, lockId);
            } catch (err) {}
          }
        };

        const rawDraft = await callLLM(targetModelId, [
          { role: "system", content: systemPrompt },
          { role: "user", content: dynamicUserPrompt }
        ], draftTemperature, authToken, username, requestBaseUrl, reportSession, { timeout: 120000, onChunk });
        draftResult = sanitizeReportDraftContent(rawDraft);
        if (isB49OpeningSection(nextToDraft)) {
          draftResult = sanitizeB49OpeningDraftContent(draftResult);
        }
        
        // Sanitize Section IV content for Career Orientation Reports
        draftResult = sanitizeCareerSectionIV(draftResult, nextToDraft, currentState);
        
        // Normalize signature table format
        draftResult = normalizeSignatureTable(draftResult);

        await throwIfCancelled(getAgentState, chatId, username);
        if (reportSession.lunaChatId) {
          setReportLunaChatId(currentState, reportSession.lunaChatId);
        }
        if (reportSession.lunaMessageId) {
          setReportLunaMessageId(currentState, reportSession.lunaMessageId);
        }

        if (hasSubstantiveDraftContent(draftResult)) {
          // Thực hiện hậu kiểm chất lượng
          const qualityCheck = validateDraftQuality(draftResult, nextToDraft, activeReportContext);
          if (qualityCheck.valid) {
            break;
          } else {
            console.warn(`[executeDraftNext] Quality check failed for section ${nextToDraft.id} (Attempt ${attempts}): ${qualityCheck.reason}`);
            // Cập nhật lại user prompt gửi đi kèm lý do lỗi chất lượng để AI sửa đổi chính xác
            dynamicUserPrompt = `${userPromptMsg}\n\n⚠️ LƯU Ý SỬA LỖI TỪ LẦN SOẠN THẢO TRƯỚC (BẮT BUỘC KHẮC PHỤC):\nNội dung bạn vừa soạn thảo chưa đạt yêu cầu do: ${qualityCheck.reason}\nHãy viết lại phần này, đảm bảo khắc phục triệt để lỗi trên.`;
          }
        }
        if (isLunaModelId(targetModelId) && attempts < maxDraftAttempts) {
          retryWithFreshLunaChat(reportSession, currentState);

          setAgentActivity(currentState, nextToDraft, "drafting_retry_fresh_luna_chat", `Luna trả về nội dung rỗng. Hệ thống đang thử lại bằng một chat Qwen mới (lần ${attempts + 1}/${maxDraftAttempts})...`, {
            actor: "Writer",
            model: targetModelId,
            sectionId: nextToDraft.id,
          });
        }
      } catch (err) {
        if (err?.code === "AGENT_CANCELLED" || String(err?.message || "").includes("CANCELLED")) {
          throw err;
        }
        console.error(`[executeDraftNext] Attempt ${attempts} failed:`, err.message);
        if (attempts >= maxDraftAttempts) {
          throw err;
        }
      }
    }

    return handleDraftFinalize(ctx, {
      nextToDraft,
      activeReportContext,
      draftResult,
      webSources,
      leaseManager
    });
  } catch (err) {
    try {
      await leaseManager.release();
    } catch (releaseErr) {}

    if (err?.code === "AGENT_CANCELLED" || String(err?.message || "").includes("CANCELLED")) {
      const { data: latestState } = await getAgentState(chatId, username);
      return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: workflow cancelled by user." });
    }

    console.error("[executeDraftNext] Unexpected error in draftNext workflow:", err);
    return NextResponse.json({ ok: false, error: err.message || "Lỗi soạn thảo mục báo cáo" }, { status: 200 });
  }
}
