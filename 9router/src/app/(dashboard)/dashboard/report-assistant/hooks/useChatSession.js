import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { safeParse, historySyncSignature, hasStreamingMessage } from "../utils/helpers";
import { getSK } from "../constants";
import { ensureKnowledgeCacheSessionOwner } from "../utils/knowledgeCache";

export function useChatSession({
  initialChatId,
  username,
  usernameLoaded,
  hydrated,
  activeModelId,
  setActiveModelId,
  systemPrompt,
  setSystemPrompt,
  temperature,
  setTemperature,
  setAssistantOnlyMode,
  selectedKnowledgeSubject,
  setSelectedKnowledgeSubject,
  allModels,
  enabledModelIds,
  setEnabledModelIds,
  fullModelsLoaded,
  setReportModels,
  applyFullModelList,
  fetchUser,
  loadFullModels,
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(initialChatId || "");
  const lastHistorySyncSignatureRef = useRef("");
  const historySyncTimerRef = useRef(null);

  // Load chat history and config from local/DB
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);

      const rawSessions =
        localStorage.getItem(uSK.sessions) ??
        localStorage.getItem("report-assistant.sessions");
      const s = safeParse(rawSessions, []);
      const loadedSessions = Array.isArray(s) ? s : [];
      setSessions(loadedSessions);
      lastHistorySyncSignatureRef.current = historySyncSignature(
        username,
        loadedSessions
      );

      fetch(`/api/report-assistant/history?username=${encodeURIComponent(username)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.ok && Array.isArray(data.sessions)) {
            if (data.sessions.length > 0) {
              setSessions((prevSessions) => {
                // Merge database sessions and local sessions without losing newly created local sessions
                const dbIds = new Set(data.sessions.map((s) => s.id));
                const localOnly = (prevSessions || []).filter((s) => !dbIds.has(s.id));
                const merged = [...data.sessions, ...localOnly];

                lastHistorySyncSignatureRef.current = historySyncSignature(
                  username,
                  merged
                );
                try {
                  localStorage.setItem(uSK.sessions, JSON.stringify(merged));
                } catch (err) {
                  if (merged.length > 5) {
                    try {
                      localStorage.setItem(uSK.sessions, JSON.stringify(merged.slice(0, 5)));
                    } catch (e) {}
                  }
                }
                return merged;
              });

              if (!initialChatId) {
                setActiveSessionId((prev) => {
                  const targetSession = (prev && data.sessions.some(s => s.id === prev)) ? prev : data.sessions[0].id;
                  setTimeout(() => router.replace(`/dashboard/report-assistant/${targetSession}`), 0);
                  return targetSession;
                });
              }
            }
          }
        })
        .catch((e) => console.warn("Failed to fetch database chat history:", e));

      let rawActiveSession = initialChatId;
      if (!rawActiveSession) {
        if (loadedSessions && loadedSessions.length > 0) {
          rawActiveSession = loadedSessions[0].id;
        } else {
          rawActiveSession =
            localStorage.getItem(uSK.activeSession) ??
            localStorage.getItem("report-assistant.activeSession");
        }
        if (rawActiveSession) {
          setTimeout(() => router.replace(`/dashboard/report-assistant/${rawActiveSession}`), 0);
        }
      }
      setActiveSessionId(rawActiveSession || "");

      const rawSystemPrompt =
        localStorage.getItem(uSK.systemPrompt) ??
        localStorage.getItem("report-assistant.systemPrompt");
      setSystemPrompt(rawSystemPrompt || "");

      const rawTemperature =
        localStorage.getItem(uSK.temperature) ??
        localStorage.getItem("report-assistant.temperature");
      setTemperature(parseFloat(rawTemperature) || 0.2);

      const savedSubject = localStorage.getItem(uSK.knowledgeSubject);
      if (savedSubject && savedSubject !== "none") {
        setSelectedKnowledgeSubject(savedSubject);
      }

      setAssistantOnlyMode(true);
    } catch {}
  }, [hydrated, usernameLoaded, username, initialChatId, router]);

  // Persist sessions and configs to localStorage
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    const uSK = getSK(username);

    try {
      localStorage.setItem(uSK.sessions, JSON.stringify(sessions));
    } catch (err) {
      console.warn("Storage quota exceeded, pruning old sessions...");
      try {
        if (sessions.length > 5) {
          const pruned = sessions.slice(0, 5);
          localStorage.setItem(uSK.sessions, JSON.stringify(pruned));
        }
      } catch (e) {
        console.error("Failed to save even after pruning", e);
      }
    }

    try {
      localStorage.setItem(uSK.activeSession, activeSessionId);
      localStorage.setItem(uSK.activeModel, activeModelId);
      localStorage.setItem(uSK.systemPrompt, systemPrompt);
      localStorage.setItem(uSK.temperature, String(temperature));
      if (fullModelsLoaded) {
        localStorage.setItem(
          uSK.enabledModels,
          JSON.stringify([...enabledModelIds])
        );
      }
    } catch {}
  }, [
    hydrated,
    usernameLoaded,
    username,
    sessions,
    activeSessionId,
    activeModelId,
    systemPrompt,
    temperature,
    enabledModelIds,
    fullModelsLoaded,
  ]);

  // Persist selectedKnowledgeSubject
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    try {
      const uSK = getSK(username);
      localStorage.setItem(uSK.knowledgeSubject, selectedKnowledgeSubject || "none");
    } catch {}
  }, [hydrated, usernameLoaded, username, selectedKnowledgeSubject]);

  // Sync activeSessionId to URL
  useEffect(() => {
    if (!hydrated) return;
    if (activeSessionId) {
      window.history.replaceState(null, "", `/dashboard/report-assistant/${activeSessionId}`);
    } else {
      window.history.replaceState(null, "", `/dashboard/report-assistant`);
    }
  }, [activeSessionId, hydrated]);

  // Sync to Database history with debounce
  useEffect(() => {
    if (!hydrated || !usernameLoaded) return;
    if (hasStreamingMessage(sessions)) return;

    const signature = historySyncSignature(username, sessions);
    if (signature === lastHistorySyncSignatureRef.current) return;

    if (historySyncTimerRef.current) {
      clearTimeout(historySyncTimerRef.current);
    }

    historySyncTimerRef.current = setTimeout(() => {
      const payload = { username, sessions: sessions.slice(0, 50) };
      fetch("/api/report-assistant/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(() => {
          lastHistorySyncSignatureRef.current = signature;
        })
        .catch((e) => console.warn("report-assistant: persist sync failed", e));
    }, 400);

    return () => {
      if (historySyncTimerRef.current) {
        clearTimeout(historySyncTimerRef.current);
      }
    };
  }, [hydrated, usernameLoaded, username, sessions]);

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
  };
}
