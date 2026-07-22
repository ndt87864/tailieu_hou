import { useState, useRef, useEffect, useCallback } from "react";
import { createId, safeParse, getReportWorkflowDefaultModelId } from "../utils/helpers";
import { fetchKnowledgeContentCached } from "../utils/knowledgeCache";
import { parsePdfText } from "../utils/pdfParser";
import { parseDocxText } from "../utils/docxParser";
import { prepareReportContent } from "../utils/reportFormatter";

export function useAgentWorkflow({
  activeSessionId,
  setActiveSessionId,
  username,
  sessions,
  setSessions,
  selectedKnowledgeSubject,
  setSelectedKnowledgeSubject,
  reportModels,
  activeModel,
  createSession,
  showToast,
  filesOutlines,
  filesTemplates,
  setDraft,
  setAttachedFiles,
}) {
  const [agentActive, setAgentActive] = useState(false);
  const [agentState, setAgentState] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [pendingReportRequest, setPendingReportRequest] = useState(null);
  const [selectedReportModelId, setSelectedReportModelId] = useState("");
  const [reportWorkflowModelId, setReportWorkflowModelId] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedOutline, setSelectedOutline] = useState(null);
  const [agentErrorDialog, setAgentErrorDialog] = useState(null);

  const agentCancelRequestedRef = useRef(false);
  const agentDraftingInProgressRef = useRef(false);

  const isB49InternshipOpeningSection = (section) => {
    if (!section?.reportContext?.internshipReport) return false;
    const norm = String(section.title || "").toLowerCase();
    return norm.includes("loi mo dau") || norm.includes("mo dau") || norm.includes("nhan xet kien tap") || norm.includes("xac nhan cua can bo");
  };

  const stripB49OpeningPreamble = (text) => {
    if (!text) return "";
    return text.replace(/^#+\s*(?:LỜI MỞ ĐẦU|MỞ ĐẦU|NHẬN XÉT KIẾN TẬP|XÁC NHẬN CỦA CÁN BỘ HƯỚNG DẪN)[\s\S]*?(\n|$)/i, "").trim();
  };

  const normalizeDisplayLineForDedup = (line) => {
    if (!line) return "";
    return String(line)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const shouldExcludeReferences = (title, content) => {
    const normTitle = String(title || "").toLowerCase();
    return normTitle.includes("ba49") || normTitle.includes("b49") || normTitle.includes("kiến tập");
  };

  const buildAgentReportContent = useCallback((state) => {
    const sections = state?.sections_progress || [];
    const hasInternshipReport = sections.some((section) => section?.reportContext?.internshipReport);
    const hasCareerReport = sections.some((section) => section?.reportContext?.careerOrientationReport);
    
    const reportBody = sections
      .filter((section) => String(section?.content || "").trim() || isB49InternshipOpeningSection(section))
      .map((section) => {
        const rawContent = String(section.content || "").trim();
        const content = isB49InternshipOpeningSection(section)
          ? stripB49OpeningPreamble(rawContent)
          : rawContent;
        const firstLine =
          content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) || "";
        const fNorm = normalizeDisplayLineForDedup(firstLine);
        const sNorm = normalizeDisplayLineForDedup(section.title);
        let sameTitle = false;
        if (fNorm) {
          if (fNorm === sNorm || fNorm.length >= 4 && (sNorm.includes(fNorm) || fNorm.includes(sNorm))) {
            sameTitle = true;
          } else if (sNorm.includes("ket luan") && fNorm.includes("ket luan")) {
            sameTitle = true;
          } else if (sNorm.includes("tai lieu tham khao") && fNorm.includes("tai lieu tham khao")) {
            sameTitle = true;
          } else if (sNorm.includes("mo dau") && fNorm.includes("mo dau")) {
            sameTitle = true;
          }
        }
        if (sameTitle) {
          const lines = content.split(/\r?\n/);
          const firstNonEmptyIdx = lines.findIndex(l => l.trim());
          if (firstNonEmptyIdx >= 0 && !lines[firstNonEmptyIdx].trim().startsWith("#")) {
            lines[firstNonEmptyIdx] = `# ${lines[firstNonEmptyIdx].trim()}`;
            return lines.join("\n");
          }
          return content;
        }
        return `# ${section.title}\n\n${content}`;
      })
      .join("\n\n[PAGE_BREAK]\n\n");

    const webSources = [];
    const seen = new Set();
    for (const section of sections) {
      for (const source of section?.web_sources || []) {
        const url = String(source?.url || "").trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        webSources.push({
          title: String(source?.title || url).trim(),
          url,
        });
      }
    }

    let finalBody = reportBody;
    if (hasInternshipReport && !/^\s*#\s*l[oơ]i m[oơ] d[aâ]u\b/i.test(reportBody)) {
      finalBody = `# LỜI MỞ ĐẦU\n\n[PAGE_BREAK]\n\n${reportBody}`;
    } else if (hasCareerReport && !/^\s*#\s*(?:i\b|i\.\s*ph[aâ]n m[oơ] d[aâ]u)/i.test(reportBody)) {
      finalBody = `# I. PHẦN MỞ ĐẦU\n\n[PAGE_BREAK]\n\n${reportBody}`;
    }

    const reportTitle = sections[0]?.reportContext?.reportTitle || state?.title || "";
    const isNoRefReport = hasCareerReport || hasInternshipReport || shouldExcludeReferences(reportTitle, finalBody);
    if (isNoRefReport || !webSources.length) return prepareReportContent(finalBody, reportTitle);

    const references = [
      "[PAGE_BREAK]",
      "## DANH MỤC TÀI LIỆU THAM KHẢO",
      ...webSources.map((source, index) => `${index + 1}. ${source.title}. Truy cập tại: ${source.url}`),
    ].join("\n");

    return prepareReportContent(finalBody ? `${finalBody}\n\n${references}` : references, reportTitle);
  }, []);

  const openAgentProgressPreview = useCallback((state, titlePrefix = "Báo cáo tạm dừng") => {
    const content = buildAgentReportContent(state);
    if (!content) return false;
    setSelectedReport({
      title: `${titlePrefix} - ${new Date().toLocaleDateString("vi-VN")}`,
      content,
    });
    return true;
  }, [buildAgentReportContent]);

  const loadAgentStatus = useCallback(async (chatId = activeSessionId, forceActive = false) => {
    if (!chatId) return null;
    agentCancelRequestedRef.current = false;
    setAgentLoading(true);
    try {
      const res = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", chatId }),
      });
      if (!res.ok) throw new Error("Không thể tải trạng thái quy trình báo cáo.");
      const data = await res.json().catch(() => null);
      if (data?.ok && data.state) {
        setAgentState(data.state);
        const isEnded = data.state.current_step === "COMPLETED" || data.state.current_step === "CANCELLED";
        setAgentActive(forceActive ? true : !isEnded);
        return data.state;
      }
      setAgentState(null);
      setAgentActive(false);
      return null;
    } catch (err) {
      console.error(err);
      setAgentState(null);
      setAgentActive(false);
      return null;
    } finally {
      setAgentLoading(false);
    }
  }, [activeSessionId]);

  const runAgentInit = useCallback(async (userPromptArg, modelIdArg, chatIdArg, subjectOverrideArg = "") => {
    let userPrompt = userPromptArg;
    let modelId = modelIdArg;
    let chatId = chatIdArg;
    let subjectOverride = subjectOverrideArg;

    if (userPromptArg && typeof userPromptArg === "object") {
      userPrompt = userPromptArg.userPrompt;
      modelId = userPromptArg.selectedReportModelId || userPromptArg.modelId;
      chatId = userPromptArg.chatId || activeSessionId;
      subjectOverride = userPromptArg.selectedOutlineSubject || userPromptArg.subjectOverride || "";
    }

    if (!chatId) {
      chatId = activeSessionId;
    }

    const runId = `run_${createId()}`;
    agentCancelRequestedRef.current = false;
    setAgentLoading(true);
    setSelectedReport(null);
    setSelectedOutline(null);
    setAgentActive(true);
    setAgentState({
      outline: [],
      sections_progress: [
        {
          id: "planning",
          title: "Đang tạo quy trình",
          description: "AI đang đọc hiểu đề cương, báo cáo mẫu và yêu cầu của bạn để lập quy trình phù hợp.",
          status: "drafting",
          content: "",
          feedback: "",
        },
      ],
    });
    try {
      let outlineKnowledge = "";
      let templateKnowledge = "";
      const selectedOutlineSubject = subjectOverride && subjectOverride !== "none" ? subjectOverride : "";

      if (selectedOutlineSubject) {
        try {
          const rows = await fetchKnowledgeContentCached("report_outline_chunks", { subject: selectedOutlineSubject });
          outlineKnowledge = rows
            .map((row) => `[De cuong: ${row.filename || selectedOutlineSubject}]\n${(row.content_text || "").trim()}`)
            .filter(Boolean)
            .join("\n\n");
        } catch (e) {
          console.warn("Failed outlines cache load:", e);
        }

        try {
          const rows = await fetchKnowledgeContentCached("report_template_chunks", { subject: selectedOutlineSubject });
          templateKnowledge = rows
            .slice(0, 3)
            .map((row) => `[Bao cao mau: ${row.filename || selectedOutlineSubject}]\n${(row.content_text || "").trim().slice(0, 8000)}`)
            .filter(Boolean)
            .join("\n\n");
        } catch (e) {
          console.warn("Failed templates cache load:", e);
        }
      }

      const res = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init",
          chatId,
          username,
          subject: selectedOutlineSubject || "Báo cáo tự động",
          outlineSource: selectedOutlineSubject,
          outlineKnowledge,
          templateKnowledge,
          modelId,
          userPrompt,
          runId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Khởi tạo Agent thất bại (HTTP ${res.status})`);
      if (data.ok && data.state) {
        setAgentState(data.state);
        setAgentActive(true);
        showToast("Agent đã lập đề cương báo cáo thành công! Đang tự động tiến hành soạn thảo...", "success");

        // Tự động append câu trả lời của AI Agent vào khung trò chuyện
        const outlinesList = (data.state.outline || [])
          .map((item, idx) => `${idx + 1}. **${item.title}**\n   *${item.description || "Soạn thảo chi tiết nội dung"}*`)
          .join("\n\n");

        const agentInitMessage = {
          id: createId(),
          role: "assistant",
          content: `🤖 **HỆ THỐNG AI AGENT ĐÃ KÍCH HOẠT THÀNH CÔNG**\n\nTôi đã tiếp nhận yêu cầu và tự động xây dựng quy trình lập báo cáo theo đề cương dưới đây:\n\n${outlinesList}\n\n---\n⚡ *Hệ thống đang tự động khởi chạy quy trình viết chi tiết từng chương mục báo cáo...*`,
          createdAt: new Date().toISOString(),
        };

        if (setSessions && chatId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === chatId
                ? {
                    ...s,
                    messages: [...(s.messages || []), agentInitMessage],
                    updatedAt: new Date().toISOString(),
                  }
                : s
            )
          );
        }

        // Tự động kích hoạt Duyệt Đề Cương (approveOutline) & Bắt đầu viết nội dung từng mục (draftNext)
        try {
          const approveRes = await fetch("/api/report-assistant/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "approveOutline",
              chatId,
              username,
              outline: data.state.outline,
            }),
          });
          const approveData = await approveRes.json().catch(() => ({}));
          if (approveData?.ok && approveData.state) {
            setAgentState(approveData.state);

            // Hàm vòng lặp tự động gọi draftNext để liên tục viết các mục cho đến khi hoàn thành
            const runNextDraftStep = async () => {
              if (agentCancelRequestedRef.current) return;
              try {
                const draftRes = await fetch("/api/report-assistant/agent", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "draftNext",
                    chatId,
                    username,
                    modelId,
                  }),
                });
                const draftData = await draftRes.json().catch(() => ({}));
                if (draftData?.ok && draftData.state) {
                  setAgentState(draftData.state);
                  const isCompleted = draftData.state.current_step === "COMPLETED";
                  const isCancelled = draftData.state.current_step === "CANCELLED";
                  const hasMoreTodo = (draftData.state.sections_progress || []).some(
                    (s) => s.status === "todo" || s.status === "drafting"
                  );

                  if (isCancelled || agentCancelRequestedRef.current) {
                    setAgentActive(false);
                    return;
                  }

                  if (!isCompleted && hasMoreTodo) {
                    setTimeout(runNextDraftStep, 1500);
                  } else if (isCompleted) {
                    showToast("AI Agent đã hoàn thành toàn bộ nội dung báo cáo!", "success");
                  }
                }
              } catch (err) {
                console.error("Lỗi trong vòng lặp soạn thảo AI Agent:", err);
              }
            };

            // Kích hoạt vòng lặp soạn thảo ngay
            runNextDraftStep();
          }
        } catch (e) {
          console.error("Lỗi tự động phê duyệt đề cương & kích hoạt soạn thảo:", e);
        }
      }
    } catch (err) {
      console.error(err);
      setAgentActive(false);
      setAgentState(null);
      showToast(err.message, "error");
    } finally {
      setAgentLoading(false);
    }
  }, [username, showToast]);

  const cancelAgentWorkflow = useCallback(async () => {
    agentCancelRequestedRef.current = true;
    setAgentLoading(true);
    try {
      const res = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", chatId: activeSessionId, username }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data.state) {
        setAgentState(data.state);
        showToast("Đã dừng quy trình AI Agent thành công!", "info");
      }
    } catch (err) {
      console.error("Lỗi khi hủy AI Agent:", err);
    } finally {
      setAgentLoading(false);
      setAgentActive(false);
    }
  }, [activeSessionId, username, showToast]);

  return {
    agentActive,
    setAgentActive,
    agentState,
    setAgentState,
    agentLoading,
    setAgentLoading,
    pendingReportRequest,
    setPendingReportRequest,
    selectedReportModelId,
    setSelectedReportModelId,
    reportWorkflowModelId,
    setReportWorkflowModelId,
    selectedReport,
    setSelectedReport,
    selectedOutline,
    setSelectedOutline,
    agentErrorDialog,
    setAgentErrorDialog,
    agentCancelRequestedRef,
    agentDraftingInProgressRef,
    buildAgentReportContent,
    openAgentProgressPreview,
    loadAgentStatus,
    runAgentInit,
    cancelAgentWorkflow,
  };
}
