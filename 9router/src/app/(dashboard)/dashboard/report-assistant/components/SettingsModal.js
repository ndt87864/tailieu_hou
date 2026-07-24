import { useState, useMemo } from "react";
import { Button, Badge } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { KnowledgeManager } from "./KnowledgeManager";

export function SettingsModal({
  isOpen,
  onClose,
  systemPrompt,
  onSystemPrompt,
  defaultSystemPrompt,
  showToast,
  activeModel,
  temperature,
  onTemperature,
  assistantOnlyMode,
  onlyCurrentProvider = true,
  onToggleOnlyCurrentProvider,
  hasActiveLuna = false,
  enabledModelIds,
  onToggleModel,
  allModels,
  username,
  isSupabaseConfigured,
  isRestrictedUser,
  subjectsOutlines,
  filesOutlines,
  loadingOutlines,
  loadOutlines,
  subjectsTemplates,
  filesTemplates,
  loadingTemplates,
  loadTemplates,
}) {
  const [activeTab, setActiveTab] = useState("general"); // 'general' or 'knowledge'
  const [search, setSearch] = useState("");
  const [updatingQwenPrompt, setUpdatingQwenPrompt] = useState(false);

  const handleSyncQwenInstruction = async () => {
    const activePrompt = systemPrompt.trim() || defaultSystemPrompt || "";
    if (!activePrompt) return;
    setUpdatingQwenPrompt(true);
    try {
      const res = await fetch("/api/report-assistant/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: activePrompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast?.(
          "Đã cập nhật System Prompt sang Qwen Web (/api/v2/users/user/settings/update) thành công!",
          "success"
        );
      } else {
        showToast?.(
          data.error || `Lỗi cập nhật Qwen Instruction: HTTP ${res.status}`,
          "error"
        );
      }
    } catch (err) {
      showToast?.("Lỗi đồng bộ Qwen Instruction: " + (err.message || err), "error");
    } finally {
      setUpdatingQwenPrompt(false);
    }
  };

  const totalOutlinesFiles = useMemo(() => {
    let count = 0;
    for (const key in filesOutlines) {
      count += (filesOutlines[key] || []).length;
    }
    return count;
  }, [filesOutlines]);

  const totalTemplatesFiles = useMemo(() => {
    let count = 0;
    for (const key in filesTemplates) {
      count += (filesTemplates[key] || []).length;
    }
    return count;
  }, [filesTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.owned_by && m.owned_by.toLowerCase().includes(q))
    );
  }, [allModels, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface">
          <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-brand-500">
              tune
            </span>
            Cấu hình Trợ lý
          </h3>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0 flex items-center justify-center text-text-muted hover:bg-surface-2 rounded-xl"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-border bg-surface px-4">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0",
              activeTab === "general"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              settings
            </span>
            Cấu hình chung
          </button>
          <button
            onClick={() => setActiveTab("knowledge")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0",
              activeTab === "knowledge"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-text-muted hover:text-text-main"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              menu_book
            </span>
            Kiến thức báo cáo ({totalOutlinesFiles + totalTemplatesFiles})
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 p-5 custom-scrollbar bg-bg">
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    System Prompt
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={updatingQwenPrompt}
                      onClick={handleSyncQwenInstruction}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Đồng bộ System Prompt sang Qwen Web"
                    >
                      <span className={cn("material-symbols-outlined text-[15px]", updatingQwenPrompt && "animate-spin")}>
                        {updatingQwenPrompt ? "sync" : "cloud_upload"}
                      </span>
                      <span>{updatingQwenPrompt ? "Đang đồng bộ..." : "Cập nhật sang Qwen Web"}</span>
                    </button>

                    {systemPrompt.trim() ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20">
                          <span className="material-symbols-outlined text-[11px]">
                            edit
                          </span>
                          Tuỳ chỉnh
                        </span>
                        <button
                          onClick={() => onSystemPrompt("")}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-text-subtle hover:text-rose-500 border border-border hover:border-rose-500/40 transition-all"
                          title="Đặt lại về mặc định"
                        >
                          <span className="material-symbols-outlined text-[11px]">
                            restart_alt
                          </span>
                          Reset
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-text-subtle border border-border">
                        <span className="material-symbols-outlined text-[11px]">
                          auto_awesome
                        </span>
                        Mặc định
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => onSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder={defaultSystemPrompt}
                    className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-[10px] placeholder:text-text-subtle resize-y outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all font-sans leading-relaxed"
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap bg-brand-500/5 p-2.5 rounded-xl border border-brand-500/20">
                  <p className="text-[11px] text-text-subtle flex-1 min-w-[200px] leading-normal">
                    {systemPrompt.trim()
                      ? "Prompt tuỳ chỉnh đang được sử dụng."
                      : "Đang dùng prompt mặc định (trợ lí học tập tiếng Việt). Nhập để ghi đè."}
                  </p>
                  <button
                    type="button"
                    disabled={updatingQwenPrompt}
                    onClick={handleSyncQwenInstruction}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className={cn("material-symbols-outlined text-[16px]", updatingQwenPrompt && "animate-spin")}>
                      {updatingQwenPrompt ? "sync" : "cloud_upload"}
                    </span>
                    <span>{updatingQwenPrompt ? "Đang đồng bộ..." : "Cập nhật sang Qwen Web"}</span>
                  </button>
                </div>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Temperature
                  </label>
                  <Badge size="sm" variant="default">
                    {temperature.toFixed(1)}
                  </Badge>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => onTemperature(parseFloat(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-text-subtle">
                    Precise (0)
                  </span>
                  <span className="text-[11px] text-text-subtle">
                    Creative (2)
                  </span>
                </div>
              </div>

              {/* Provider Selection Filter */}
              {hasActiveLuna && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Phạm vi Provider khi tạo báo cáo
                    </label>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border bg-surface flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-brand-500">
                          tune
                        </span>
                        Chỉ sử dụng provider Luna khi tạo báo cáo
                      </span>
                      <p className="text-[11px] text-text-subtle">
                        {onlyCurrentProvider
                          ? "Đang bật: Chỉ cho phép dùng các model của provider Luna khi tạo báo cáo."
                          : "Đang tắt: Cho phép dùng tất cả các model khác mà không cần bật tắt tài khoản."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={onlyCurrentProvider}
                      onClick={() => onToggleOnlyCurrentProvider?.(!onlyCurrentProvider)}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        onlyCurrentProvider ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          onlyCurrentProvider ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Mode Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Chế độ hoạt động
                  </label>
                  <span className="text-xs text-text-subtle">Tự động</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="assistantOnlyMode"
                    type="checkbox"
                    checked={assistantOnlyMode}
                    disabled
                    className="accent-brand-500 opacity-60 cursor-not-allowed"
                  />
                  <label
                    htmlFor="assistantOnlyMode"
                    className="text-[12px] text-text-subtle"
                  >
                    Hệ thống tự bật Báo cáo khi có yêu cầu và tự tắt sau khi hoàn tất. Trạng thái hiện tại: {assistantOnlyMode ? "Chat" : "Báo cáo"}.
                  </label>
                </div>
              </div>

              {/* Model Management */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Available Models
                  </label>
                  <span className="text-xs text-text-subtle">
                    {enabledModelIds.size}/{allModels.length} enabled
                  </span>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models…"
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-[10px] text-text-main placeholder:text-text-subtle outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all mb-3"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {filtered.map((m) => {
                    const enabled = enabledModelIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => onToggleModel(m.id)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left transition-all border",
                          enabled
                            ? "bg-brand-50 dark:bg-brand-900/20 border-brand-500/30 text-text-main"
                            : "bg-surface border-border text-text-muted hover:bg-surface-2 hover:text-text-main"
                        )}
                      >
                        <div
                          className={cn(
                            "size-4 rounded-[4px] flex-shrink-0 flex items-center justify-center border transition-all",
                            enabled ? "bg-brand-500 border-brand-500" : "border-border bg-bg"
                          )}
                        >
                          {enabled && (
                            <span className="material-symbols-outlined text-[10px] text-white">
                              check
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {m.id.split("/").pop()}
                          </p>
                          <p className="text-[11px] text-text-subtle truncate">
                            {m.owned_by || m.id.split("/")[0]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="col-span-2 py-6 text-center text-sm text-text-subtle">
                      No models found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "knowledge" && (
            <KnowledgeManager
              subjectsOutlines={subjectsOutlines}
              filesOutlines={filesOutlines}
              loadingOutlines={loadingOutlines}
              loadOutlines={loadOutlines}
              subjectsTemplates={subjectsTemplates}
              filesTemplates={filesTemplates}
              loadingTemplates={loadingTemplates}
              loadTemplates={loadTemplates}
              username={username}
              isSupabaseConfigured={isSupabaseConfigured}
              isRestrictedUser={isRestrictedUser}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end bg-surface">
          <Button size="sm" onClick={onClose}>
            Hoàn tất
          </Button>
        </div>
      </div>
    </div>
  );
}
