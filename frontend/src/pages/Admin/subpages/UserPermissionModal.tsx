import React from "react";
import { Loader2, Search } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  avatar_url: string | null;
}

interface UserPermissionModalProps {
  selectedUserForAccess: Profile | null;
  docSearch: string;
  setDocSearch: (val: string) => void;
  loadingUnlocks: boolean;
  allDocuments: any[];
  userDocUnlocks: string[];
  handleToggleDocUnlock: (docId: string) => void;
  allCategories: any[];
  userCatUnlocks: string[];
  handleToggleCatUnlock: (catId: string) => void;
  savingUnlocks: boolean;
  onClose: () => void;
  onSave: () => void;
}

const UserPermissionModal: React.FC<UserPermissionModalProps> = ({
  selectedUserForAccess,
  docSearch,
  setDocSearch,
  loadingUnlocks,
  allDocuments,
  userDocUnlocks,
  handleToggleDocUnlock,
  allCategories,
  userCatUnlocks,
  handleToggleCatUnlock,
  savingUnlocks,
  onClose,
  onSave,
}) => {
  if (!selectedUserForAccess) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 relative animate-scale-in max-h-[85vh] flex flex-col">
        <h3 className="modal-heading text-base font-bold mb-2">
          Phân quyền {selectedUserForAccess.role === "plus" ? "tài liệu" : "danh mục"} hiển thị 100% câu hỏi
        </h3>
        <p className="text-xs text-muted mb-4">
          Tài khoản: <span className="font-semibold text-fg">{selectedUserForAccess.email}</span> ({selectedUserForAccess.full_name || "Chưa thiết lập"})
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
          <input
            type="text"
            placeholder={selectedUserForAccess.role === "plus" ? "Tìm kiếm tài liệu..." : "Tìm kiếm danh mục..."}
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] border border-[var(--border)] rounded-xl p-3 space-y-2">
          {loadingUnlocks ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted text-sm gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              Đang tải danh sách...
            </div>
          ) : selectedUserForAccess.role === "plus" ? (
            // PLUS user: Show documents list
            allDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">
                Không có tài liệu nào trong hệ thống.
              </div>
            ) : (
              (() => {
                const filteredDocs = allDocuments.filter(doc =>
                  doc.title.toLowerCase().includes(docSearch.toLowerCase()) ||
                  (doc.category?.title || "").toLowerCase().includes(docSearch.toLowerCase())
                );

                if (filteredDocs.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted text-sm">
                      Không tìm thấy tài liệu phù hợp.
                    </div>
                  );
                }

                return filteredDocs.map((doc) => {
                  const isChecked = userDocUnlocks.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-2)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDocUnlock(doc.id)}
                        className="mt-1 rounded border-themed text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-fg truncate">
                          {doc.title}
                        </div>
                        {doc.category && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-500/10 text-[var(--brand-600)]">
                            {doc.category.title}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                });
              })()
            )
          ) : (
            // PRO user: Show categories list
            allCategories.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">
                Không có danh mục nào trong hệ thống.
              </div>
            ) : (
              (() => {
                const filteredCats = allCategories.filter(cat =>
                  cat.title.toLowerCase().includes(docSearch.toLowerCase())
                );

                if (filteredCats.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted text-sm">
                      Không tìm thấy danh mục phù hợp.
                    </div>
                  );
                }

                return filteredCats.map((cat) => {
                  const isChecked = userCatUnlocks.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--bg-2)] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCatUnlock(cat.id)}
                        className="mt-1 rounded border-themed text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-fg truncate">
                          {cat.title}
                        </div>
                      </div>
                    </label>
                  );
                });
              })()
            )
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)] mt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-cancel px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
            disabled={savingUnlocks}
          >
            Hủy
          </button>
          <button
            onClick={onSave}
            disabled={savingUnlocks || loadingUnlocks}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 flex items-center gap-1.5"
          >
            {savingUnlocks && <Loader2 className="w-4 h-4 animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPermissionModal;
