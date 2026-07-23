import { useState, useRef, useEffect, useCallback } from "react";
import { createId } from "../utils/helpers";
import { fetchKnowledgeContentCached } from "../utils/knowledgeCache";
import { buildAgentReportContent } from "../utils/agentReportBuilder";
import { classifyAgentDraftError } from "../utils/agentErrorHandler";

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
  streamEnabled,
  apiKey,
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
  const agentStateRef = useRef(null);

  useEffect(() => { agentStateRef.current = agentState; }, [agentState]);

  const appendChatMessage = useCallback((chatId, userPrompt, assistantMsg) => {
    if (!setSessions || !chatId) return;
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === chatId);
      const userMsgObj = userPrompt ? {
        id: createId(),
        role: "user",
        content: userPrompt,
        createdAt: new Date().toISOString(),
      } : null;

      if (!exists) {
        return [
          ...prev,
          {
            id: chatId,
            title: userPrompt ? userPrompt.slice(0, 30) + "..." : "Báo cáo mới",
            modelId: "",
            subject: "none",
            messages: [userMsgObj, assistantMsg].filter(Boolean),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }

      return prev.map((s) => {
        if (s.id !== chatId) return s;
        const currentMsgs = s.messages || [];
        const hasUserMsg = userPrompt && currentMsgs.some((m) => m.role === "user" && m.content === userPrompt);
        const newMsgs = [...currentMsgs];
        if (userMsgObj && !hasUserMsg) {
          newMsgs.push(userMsgObj);
        }
        if (assistantMsg) {
          const isDuplicate = currentMsgs.some((m) => m.id === assistantMsg.id);
          if (!isDuplicate) {
            newMsgs.push(assistantMsg);
          }
        }
        return {
          ...s,
          messages: newMsgs,
          updatedAt: new Date().toISOString(),
        };
      });
    });
  }, [setSessions]);

  const updateChatMessage = useCallback((chatId, messageId, patch) => {
    if (!setSessions || !chatId || !messageId) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== chatId) return s;
        return {
          ...s,
          messages: (s.messages || []).map((m) => m.id === messageId ? { ...m, ...patch } : m),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [setSessions]);

  const openAgentProgressPreview = useCallback((state, titlePrefix = "Báo cáo") => {
    const targetState = state || agentStateRef.current;
    const content = buildAgentReportContent(targetState);
    if (!content) return false;
    setSelectedReport({
      title: `${titlePrefix} - ${new Date().toLocaleDateString("vi-VN")}`,
      content,
    });
    return true;
  }, []);

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
        if (forceActive) {
          setAgentActive(true);
        } else {
          const isEnded = data.state.current_step === "COMPLETED" || data.state.current_step === "CANCELLED";
          if (!isEnded) setAgentActive(true);
        }
        if (data.state.current_step === "COMPLETED") {
          const reportCardMsg = {
            id: createId(),
            role: "assistant",
            isReportCard: true,
            content: "Báo cáo hoàn chỉnh",
            createdAt: new Date().toISOString(),
          };
          appendChatMessage(chatId, null, reportCardMsg);
        }
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
  }, [activeSessionId, appendChatMessage]);

  useEffect(() => {
    if (!agentActive || !activeSessionId) return;
    const isEnded = agentState?.current_step === "COMPLETED" || agentState?.current_step === "CANCELLED";
    const isWaitingApproval = agentState?.current_step === "WAIT_APPROVAL";
    if (isEnded || isWaitingApproval) return;
    const timer = setInterval(() => { loadAgentStatus(activeSessionId); }, 1500);
    return () => clearInterval(timer);
  }, [agentActive, activeSessionId, agentState?.current_step, loadAgentStatus]);

  const runAgentInit = useCallback(async (userPromptArg, modelIdArg, chatIdArg, subjectOverrideArg = "") => {
    let userPrompt = userPromptArg, modelId = modelIdArg, chatId = chatIdArg, subjectOverride = subjectOverrideArg;
    if (userPromptArg && typeof userPromptArg === "object") {
      userPrompt = userPromptArg.userPrompt;
      modelId = userPromptArg.selectedReportModelId || userPromptArg.modelId;
      chatId = userPromptArg.chatId || activeSessionId;
      subjectOverride = userPromptArg.selectedOutlineSubject || userPromptArg.subjectOverride || "";
    }
    if (!chatId) chatId = activeSessionId;
    const runId = `run_${createId()}`;
    agentCancelRequestedRef.current = false;
    setAgentLoading(true);
    setSelectedReport(null);
    setSelectedOutline(null);
    setAgentActive(true);
    setAgentState({
      outline: [],
      current_step: "OUTLINING",
      sections_progress: [
        {
          id: "planning",
          title: "Đang lập dàn ý báo cáo",
          description: "AI đang phân tích yêu cầu, đề cương và tài liệu để lập dàn ý phù hợp.",
          status: "drafting",
          content: "",
          feedback: "",
        },
      ],
    });
    const outlineCardId = createId();
    appendChatMessage(chatId, null, {
      id: outlineCardId,
      role: "assistant",
      isOutlineCard: true,
      outlineStatus: "generating",
      content: "Dàn ý báo cáo",
      createdAt: new Date().toISOString(),
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
        const nextState = {
          ...data.state,
          current_step: "WAIT_APPROVAL",
        };
        setAgentState(nextState);
        agentStateRef.current = nextState;
        setAgentActive(true);
        showToast("Agent đã tạo xong dàn ý báo cáo! Vui lòng xác nhận dàn ý để bắt đầu viết.", "success");

        updateChatMessage(chatId, outlineCardId, {
          outlineStatus: "ready",
        });
      }
    } catch (err) {
      console.error(err);
      setAgentActive(false);
      setAgentState(null);
      updateChatMessage(chatId, outlineCardId, {
        outlineStatus: "error",
        errorText: err.message || "Tạo dàn ý thất bại",
      });
      showToast(err.message, "error");
    } finally {
      setAgentLoading(false);
    }
  }, [activeSessionId, username, showToast, appendChatMessage, updateChatMessage]);

  // B3 & B4: Xác nhận dàn ý -> Soạn thảo từng mục -> Xem Preview trong Drawer
  const confirmOutlineAndStartDrafting = useCallback(async (chatIdArg, modelIdArg) => {
    const chatId = chatIdArg || activeSessionId;
    const currentState = agentStateRef.current;
    const modelId = modelIdArg || selectedReportModelId || activeModel?.id || "";

    if (!chatId) return;

    let outline = currentState?.outline;
    if (!outline || outline.length === 0) {
      try {
        const statusRes = await fetch("/api/report-assistant/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", chatId }),
        });
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData?.ok && statusData.state?.outline) {
          outline = statusData.state.outline;
          setAgentState(statusData.state);
          agentStateRef.current = statusData.state;
        }
      } catch (e) {
        console.warn("Không thể tải lại trạng thái agent:", e);
      }
    }

    if (!outline || outline.length === 0) {
      showToast("Không tìm thấy dàn ý báo cáo, vui lòng thử lại.", "error");
      return;
    }

    agentCancelRequestedRef.current = false;
    setAgentLoading(true);

    try {
      const approveRes = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approveOutline",
          chatId,
          username,
          outline,
        }),
      });

      const approveData = await approveRes.json().catch(() => ({}));
      if (!approveRes.ok || !approveData?.ok) {
        throw new Error(approveData?.error || "Phê duyệt dàn ý thất bại.");
      }

      setAgentState(approveData.state);
      agentStateRef.current = approveData.state;
      showToast("Đã xác nhận dàn ý! Hệ thống bắt đầu tạo nội dung các mục...", "info");

      const runNextDraftStep = async () => {
        if (agentCancelRequestedRef.current) return;

        const currentSt = agentStateRef.current;
        const progress = currentSt?.sections_progress || [];
        const nextToDraft = progress.find((p) => p.status === "todo" || p.status === "drafting");

        try {
          const draftRes = await fetch("/api/report-assistant/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "draftNext", chatId, username, modelId }),
          });
          const draftData = await draftRes.json().catch(() => ({}));
          
          if (!draftRes.ok || draftData?.ok === false) {
            const errClass = classifyAgentDraftError(
              draftRes.status,
              typeof draftData?.error === "string" ? draftData.error : "",
              new Error(draftData?.error || "Lỗi không xác định khi soạn thảo")
            );
            setAgentErrorDialog({
              title: errClass.title,
              message: errClass.message,
              detail: errClass.detail,
              chatId,
              sectionId: draftData?.activeSectionId || null,
            });
            setAgentActive(false);
            return;
          }

          if (draftData?.ok && draftData.state) {
            setAgentState(draftData.state);
            agentStateRef.current = draftData.state;

            const isCompleted = draftData.state.current_step === "COMPLETED";
            const isCancelled = draftData.state.current_step === "CANCELLED";

            if (isCancelled || agentCancelRequestedRef.current) {
              setAgentActive(false);
              return;
            }

            if (draftData.workerAlreadyRunning) {
              // Worker đang soạn thảo ở backend, poll lại mỗi 300ms để nhận nội dung stream real-time mới nhất
              setTimeout(runNextDraftStep, 300);
              return;
            }

            const hasMoreTodo = (draftData.state.sections_progress || []).some(
              (s) => s.status === "todo" || s.status === "drafting" || s.status === "stream_drafting"
            );

            if (!isCompleted && hasMoreTodo) {
              setTimeout(runNextDraftStep, 350);
            } else if (isCompleted) {
              showToast("AI Agent đã hoàn thành toàn bộ nội dung báo cáo!", "success");
              // B4: Mở drawer + chuyển Preview báo cáo hoàn chỉnh khi HOÀN THÀNH TẤT CẢ CÁC MỤC
              setAgentActive(true);
              openAgentProgressPreview(draftData.state, "Báo cáo hoàn chỉnh");
              const reportCardMsg = {
                id: createId(),
                role: "assistant",
                isReportCard: true,
                content: "Báo cáo hoàn chỉnh",
                createdAt: new Date().toISOString(),
              };
              appendChatMessage(chatId, null, reportCardMsg);
            }
          }
        } catch (fetchErr) {
          if (agentCancelRequestedRef.current) return;
          console.warn("[runNextDraftStep] Lỗi kết nối mạng tạm thời, tự động thử lại sau 1s...", fetchErr.message);
          setTimeout(runNextDraftStep, 1000);
        }
      };

      runNextDraftStep();
    } catch (err) {
      showToast(err.message || "Không thể khởi chạy quy trình soạn thảo.", "error");
      setAgentLoading(false);
    }
  }, [activeSessionId, selectedReportModelId, activeModel?.id, username, showToast, openAgentProgressPreview, appendChatMessage]);

  const reloadSection = useCallback(async (sectionId, chatIdArg = activeSessionId) => {
    const chatId = chatIdArg || activeSessionId;
    if (!chatId || !sectionId) return;
    setAgentLoading(true);
    try {
      const res = await fetch("/api/report-assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reloadSection", chatId, sectionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data.state) {
        setAgentState(data.state);
        agentStateRef.current = data.state;
        setAgentActive(true);
        showToast("Đã thiết lập lại mục báo cáo để soạn lại!", "info");
        confirmOutlineAndStartDrafting(chatId);
      }
    } catch (err) {
      console.error("Reload section error:", err);
      showToast("Lỗi khi tải lại mục: " + err.message, "error");
    } finally { setAgentLoading(false); }
  }, [activeSessionId, showToast, confirmOutlineAndStartDrafting]);

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
    agentActive, setAgentActive, agentState, setAgentState, agentLoading, setAgentLoading,
    pendingReportRequest, setPendingReportRequest, selectedReportModelId, setSelectedReportModelId,
    reportWorkflowModelId, setReportWorkflowModelId, selectedReport, setSelectedReport,
    selectedOutline, setSelectedOutline, agentErrorDialog, setAgentErrorDialog,
    agentCancelRequestedRef, agentDraftingInProgressRef, buildAgentReportContent,
    openAgentProgressPreview, loadAgentStatus, runAgentInit, confirmOutlineAndStartDrafting,
    reloadSection, cancelAgentWorkflow
  };
}
