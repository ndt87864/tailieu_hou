import { NextResponse } from "next/server";
import {
  normalizeAgentState,
  setAgentActivity,
  setReportLunaChatId,
  setReportLunaMessageId
} from "../agentActivity";
import {
  syncReportCompletionState,
  applyCriticDecision
} from "../stateTransitions";
import { callLLM } from "../llm";
import { getLastCompletedYears } from "../utils";
import { throwIfCancelled } from "../draftNextHelpers";

const REPORT_ENABLE_CRITIC = String(process.env.REPORT_AGENT_ENABLE_CRITIC || "false").toLowerCase() === "true";

export async function handleDraftFinalize(ctx, {
  nextToDraft,
  activeReportContext,
  draftResult,
  webSources,
  leaseManager
}) {
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
    saveAgentState
  } = ctx;

  try {
    const progress = currentState.sections_progress || [];

    if (!REPORT_ENABLE_CRITIC) {
      const stateToSave = currentState;
      normalizeAgentState(stateToSave);
      setReportLunaChatId(stateToSave, reportSession.lunaChatId);
      setReportLunaMessageId(stateToSave, reportSession.lunaMessageId);

      const targetSection = stateToSave.sections_progress.find((s) => String(s.id) === String(nextToDraft.id));
      if (!targetSection) {
        await leaseManager.release();
        return NextResponse.json({ error: `Section not found in progress list: ${nextToDraft.id}`, code: "SECTION_NOT_FOUND" }, { status: 500 });
      }

      targetSection.status = "done";
      targetSection.content = draftResult;
      targetSection.feedback = "";
      targetSection.web_sources = webSources;
      
      setAgentActivity(stateToSave, targetSection, "section_completed", "Mục này đã được soạn xong.", {
        actor: "Writer",
        approved: true,
        criticSkipped: true,
      });

      const reportTitle = activeReportContext?.subject || "Unknown Report";
      const stillTodo = stateToSave.sections_progress.find((p) => p.status === "todo" || p.status === "drafting" || p.status === "stream_drafting");
      if (!stillTodo) {
        stateToSave.current_step = "COMPLETED";
        setAgentActivity(stateToSave, null, "report_completed", "Tất cả mục trong báo cáo đã hoàn tất.", {
          actor: "Report Agent",
          sections: stateToSave.sections_progress.length,
        });
      }

      // 1. Insert section conditionally checking lease
      try {
        await leaseManager.insertSectionWithLeaseCheck({
          sectionId: targetSection.id,
          sectionTitle: targetSection.title,
          content: draftResult,
          reportTitle
        });
      } catch (leaseErr) {
        await leaseManager.release();
        const { data: latestState } = await getAgentState(chatId, username);
        return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost before final section write." });
      }

      // 2. Update state conditional on lease
      try {
        await saveAgentState(chatId, username, stateToSave, null, leaseManager.lockId);
      } catch (stateErr) {
        await leaseManager.release();
        const { data: latestState } = await getAgentState(chatId, username);
        return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost before final state write." });
      }

      // Release lease after all database writes have been committed successfully
      await leaseManager.release();
      return NextResponse.json({ ok: true, state: stateToSave, activeSectionId: nextToDraft.id, draftResult });
    }

    // Critic path
    const criticSystem = prompts.getCriticSystem(
      activeReportContext?.analysisYearLabel || getLastCompletedYears(3).join(", "),
      !!activeReportContext?.careerOrientationReport,
      nextToDraft.id,
      nextToDraft.title
    );

    const criticMessages = [
      { role: "system", content: criticSystem },
      { role: "user", content: `Đoạn văn thảo luận:\n${draftResult}` }
    ];

    setAgentActivity(currentState, nextToDraft, "reviewing_draft", "Agent đang kiểm định chất lượng nội dung vừa soạn.", {
      actor: "Critic",
      sectionId: nextToDraft.id,
    });
    try {
      await leaseManager.verify();
      await saveAgentState(chatId, username, currentState, null, leaseManager.lockId);
    } catch (leaseErr) {
      await leaseManager.release();
      const { data: latestState } = await getAgentState(chatId, username);
      return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost before review save." });
    }

    const criticResult = await callLLM(targetModelId, criticMessages, 0.2, authToken, username, requestBaseUrl, reportSession);
    try {
      await leaseManager.verify();
      await throwIfCancelled(getAgentState, chatId, username);
    } catch (leaseErr) {
      await leaseManager.release();
      const { data: latestState } = await getAgentState(chatId, username);
      return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: cancelled or lease lost during critic." });
    }

    if (reportSession.lunaChatId) {
      setReportLunaChatId(currentState, reportSession.lunaChatId);
    }
    if (reportSession.lunaMessageId) {
      setReportLunaMessageId(currentState, reportSession.lunaMessageId);
    }
    const isApproved = criticResult.toUpperCase().includes("APPROVED");

    const { data: latestStateAfterCritic } = await getAgentState(chatId, username);

    if (latestStateAfterCritic?.current_step === "CANCELLED") {
      normalizeAgentState(latestStateAfterCritic);
      await leaseManager.release();
      return NextResponse.json({ ok: true, state: latestStateAfterCritic, message: "Agent run cancelled." });
    }

    const stateToSave = latestStateAfterCritic || currentState;
    normalizeAgentState(stateToSave);
    setReportLunaChatId(stateToSave, reportSession.lunaChatId);
    setReportLunaMessageId(stateToSave, reportSession.lunaMessageId);

    const targetSection = applyCriticDecision(stateToSave, nextToDraft.id, {
      approved: isApproved,
      content: draftResult,
      feedback: criticResult,
      webSources,
    });
    if (targetSection) {
      if (isApproved) {
        setAgentActivity(stateToSave, targetSection, "section_completed", "Mục này đã được soạn và kiểm định đạt yêu cầu.", {
          actor: "Critic",
          approved: true,
        });
      } else {
        setAgentActivity(stateToSave, targetSection, "critic_rejected", "Mục này cần người dùng xem lại trước khi tiếp tục.", {
          actor: "Critic",
          approved: false,
        });
      }
    }

    const reportTitle = activeReportContext?.subject || "Unknown Report";
    if (isApproved) {
      syncReportCompletionState(stateToSave);
      if (stateToSave.current_step === "COMPLETED") {
        setAgentActivity(stateToSave, null, "report_completed", "Tất cả mục trong báo cáo đã hoàn tất.", {
          actor: "Report Agent",
          sections: stateToSave.sections_progress.length,
        });
      }
    }

    if (isApproved && targetSection) {
      try {
        await leaseManager.insertSectionWithLeaseCheck({
          sectionId: targetSection.id,
          sectionTitle: targetSection.title,
          content: draftResult,
          reportTitle
        });
      } catch (leaseErr) {
        await leaseManager.release();
        const { data: latestState } = await getAgentState(chatId, username);
        return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost before final section write." });
      }
    }

    try {
      await saveAgentState(chatId, username, stateToSave, null, leaseManager.lockId);
    } catch (stateErr) {
      await leaseManager.release();
      const { data: latestState } = await getAgentState(chatId, username);
      return NextResponse.json({ ok: true, state: latestState, message: "Worker aborted: lease lost before final state write." });
    }

    await leaseManager.release();
    return NextResponse.json({ ok: true, state: stateToSave, activeSectionId: nextToDraft.id, draftResult });
  } catch (err) {
    console.error("[handleDraftFinalize] Unexpected error in finalize workflow:", err);
    try {
      await leaseManager.release();
    } catch (releaseErr) {
      console.error("[handleDraftFinalize] lease release failed in unexpected error path:", releaseErr.message);
    }
    throw err;
  }
}
