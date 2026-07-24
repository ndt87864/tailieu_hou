"use client";

import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/components";
import { relTime } from "../utils/helpers";

export function SessionSidebar({
  sessions = [],
  activeSessionId,
  setActiveSessionId,
  onCreateSession,
  onDeleteSession,
}) {
  const sortedSessions = [...(sessions || [])].sort((a, b) => {
    const timeA = new Date(a?.updatedAt || a?.updated_at || a?.createdAt || a?.created_at || 0).getTime();
    const timeB = new Date(b?.updatedAt || b?.updated_at || b?.createdAt || b?.created_at || 0).getTime();
    return timeB - timeA;
  });

  return (
    <div className="w-44 sm:w-48 border-r border-border bg-surface flex flex-col h-full flex-shrink-0">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-bold text-text-main">Lịch sử trò chuyện</h2>
        <Button size="xs" onClick={onCreateSession} className="size-6 p-0 text-xs flex items-center justify-center">
          +
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {sortedSessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={cn(
              "px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-between border",
              s.id === activeSessionId
                ? "bg-brand-500/10 border-brand-500 text-brand-600 font-medium"
                : "bg-surface hover:bg-surface-2 border-border"
            )}
          >
            <div className="min-w-0 flex-1 pr-1.5">
              <p className="text-[11px] font-medium truncate leading-tight">{s.title || "New Chat"}</p>
              <p className="text-[9px] text-text-subtle mt-0.5">
                {relTime(s.updatedAt || s.updated_at || s.createdAt || s.created_at)}
              </p>
            </div>
            <button
              onClick={(e) => onDeleteSession(s.id, e)}
              className="text-text-subtle hover:text-red-500 p-0.5 rounded transition-colors"
              title="Xóa cuộc trò chuyện"
            >
              <span className="material-symbols-outlined text-[13px]">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
