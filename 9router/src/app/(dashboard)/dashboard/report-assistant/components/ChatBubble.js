import { cn } from "@/shared/utils/cn";
import { formatBytes } from "../utils/helpers";

export function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 size-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
      <span className="material-symbols-outlined text-[18px]">
        auto_awesome
      </span>
    </div>
  );
}

export function UserAvatar() {
  return (
    <div className="flex-shrink-0 size-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
      <span className="material-symbols-outlined text-[18px]">
        person
      </span>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1.5 px-3 bg-surface-2 border border-border rounded-2xl w-fit">
      <span className="size-1.5 bg-text-subtle rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
      <span className="size-1.5 bg-text-subtle rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
      <span className="size-1.5 bg-text-subtle rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
    </div>
  );
}

export function MessageFilesGrid({ files }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-w-md">
      {files.map((f, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 p-2 bg-surface-2 border border-border rounded-xl text-xs text-text-muted"
        >
          <span className="material-symbols-outlined text-text-subtle text-[18px]">
            description
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate text-text-main" title={f.name}>
              {f.name}
            </p>
            <p className="text-[10px] text-text-subtle">
              {formatBytes(f.size || 0)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SourceFilePill({ name, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 hover:bg-surface border border-border hover:border-brand-500/40 rounded-xl text-[11px] font-medium text-text-muted hover:text-brand-600 transition-all cursor-pointer"
    >
      <span className="material-symbols-outlined text-[13px] text-text-subtle">
        article
      </span>
      <span className="truncate max-w-[120px]">{name}</span>
    </button>
  );
}
