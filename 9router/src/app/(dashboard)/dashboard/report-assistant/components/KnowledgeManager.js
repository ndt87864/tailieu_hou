import { useState, useCallback, useMemo } from "react";
import { Button, Badge } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "../utils/helpers";
import { clearAllKnowledgeContentCaches } from "../utils/knowledgeCache";

export function KnowledgeManager({
  subjectsOutlines,
  filesOutlines,
  loadingOutlines,
  loadOutlines,
  subjectsTemplates,
  filesTemplates,
  loadingTemplates,
  loadTemplates,
  username,
  isSupabaseConfigured,
  isRestrictedUser,
}) {
  const [activeSubTab, setActiveSubTab] = useState("outlines"); // 'outlines' or 'templates'
  const [selectedSubject, setSelectedSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const subjects = activeSubTab === "outlines" ? subjectsOutlines : subjectsTemplates;
  const filesBySubject = activeSubTab === "outlines" ? filesOutlines : filesTemplates;
  const loading = activeSubTab === "outlines" ? loadingOutlines : loadingTemplates;
  const reload = activeSubTab === "outlines" ? loadOutlines : loadTemplates;

  const currentSubjectList = useMemo(() => {
    return [...subjects].sort();
  }, [subjects]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setErrorMsg("");
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Vui lòng chọn file trước khi tải lên.");
      return;
    }

    const finalSubject = selectedSubject === "new" ? customSubject.trim() : selectedSubject;
    if (!finalSubject) {
      setErrorMsg("Vui lòng chọn hoặc nhập chủ đề.");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filename", file.name);
      formData.append("subject", finalSubject);
      formData.append("type", activeSubTab);
      formData.append("username", "global");

      const res = await fetch("/api/report-assistant/knowledge", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Không thể tải lên file.");
      }

      setFile(null);
      if (selectedSubject === "new") {
        setSelectedSubject(finalSubject);
        setCustomSubject("");
      }
      // Invalidate frontend cache
      clearAllKnowledgeContentCaches();
      await reload();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (subject, filename) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa file ${filename} không?`)) return;
    setDeletingFile(`${subject}/${filename}`);
    setErrorMsg("");

    try {
      const params = new URLSearchParams({
        username: "global",
        subject,
        filename,
        type: activeSubTab,
      });
      const res = await fetch(`/api/report-assistant/knowledge?${params.toString()}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Không thể xóa file.");
      }
      clearAllKnowledgeContentCaches();
      await reload();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Selector */}
      <div className="flex bg-surface-2 p-0.5 rounded-lg border border-border">
        <button
          onClick={() => {
            setActiveSubTab("outlines");
            setErrorMsg("");
          }}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
            activeSubTab === "outlines"
              ? "bg-bg text-text-main shadow-sm"
              : "text-text-muted hover:text-text-main"
          )}
        >
          Tài liệu tham khảo
        </button>
        <button
          onClick={() => {
            setActiveSubTab("templates");
            setErrorMsg("");
          }}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
            activeSubTab === "templates"
              ? "bg-bg text-text-main shadow-sm"
              : "text-text-muted hover:text-text-main"
          )}
        >
          Mẫu chương/bài viết
        </button>
      </div>

      {/* Upload Box */}
      {isSupabaseConfigured ? (
        <form onSubmit={handleUpload} className="bg-bg border border-border rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
            Tải lên tài liệu mới
          </h4>

          {errorMsg && (
            <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                Chủ đề / Mã môn học
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full text-xs bg-surface border border-border rounded-lg p-2 outline-none"
              >
                <option value="">-- Chọn chủ đề --</option>
                {currentSubjectList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {!isRestrictedUser && <option value="new">+ Nhập chủ đề mới...</option>}
              </select>
            </div>

            {selectedSubject === "new" && (
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                  Tên chủ đề mới
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: sl06, sl07..."
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full text-xs bg-surface border border-border rounded-lg p-2 outline-none placeholder:text-text-subtle"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
              Chọn tệp tin (.pdf, .docx, .txt, .md)
            </label>
            <input
              type="file"
              required
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={handleFileChange}
              className="text-xs w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600 hover:file:bg-brand-500/20 cursor-pointer"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={uploading || !file || (!selectedSubject && selectedSubject !== "new")}
            >
              {uploading ? "Đang tải lên..." : "Tải lên"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-xs text-text-subtle p-3 text-center bg-surface border border-dashed border-border rounded-xl">
          Supabase chưa được cấu hình. Không thể quản lý tri thức.
        </div>
      )}

      {/* Subject list and Files */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
          Kho lưu trữ hiện có
        </h4>

        {loading ? (
          <div className="text-xs text-text-subtle text-center py-4">Đang tải danh sách tài liệu...</div>
        ) : subjects.length === 0 ? (
          <div className="text-xs text-text-subtle text-center py-4">Chưa có tài liệu nào.</div>
        ) : (
          <div className="space-y-3">
            {currentSubjectList.map((subject) => {
              const fileList = filesBySubject[subject] || [];
              return (
                <div key={subject} className="border border-border rounded-xl p-3 bg-bg">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/40">
                    <span className="text-xs font-bold text-text-main uppercase tracking-wide">
                      {subject}
                    </span>
                    <Badge size="sm" variant="info">
                      {fileList.length} file
                    </Badge>
                  </div>
                  {fileList.length === 0 ? (
                    <div className="text-[11px] text-text-subtle italic">Chưa có file nào trong chủ đề này.</div>
                  ) : (
                    <ul className="space-y-1.5">
                      {fileList.map((f) => {
                        const isDeleting = deletingFile === `${subject}/${f.name}`;
                        return (
                          <li
                            key={f.name}
                            className="flex items-center justify-between text-xs text-text-muted hover:text-text-main"
                          >
                            <span className="truncate max-w-[70%]" title={f.name}>
                              {f.name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] text-text-subtle">
                                {formatBytes(f.metadata?.size || f.size || 0)}
                              </span>
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-500 hover:underline"
                              >
                                Xem
                              </a>
                              {!isRestrictedUser && (
                                <button
                                  onClick={() => handleDelete(subject, f.name)}
                                  disabled={isDeleting}
                                  className="text-rose-500 hover:text-rose-600 disabled:opacity-50"
                                >
                                  {isDeleting ? "..." : "Xóa"}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
