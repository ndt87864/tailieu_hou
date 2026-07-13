// frontend/src/components/admin/SheetsTab.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import { Plus, Trash2, FileSpreadsheet, Search, RefreshCw, X, Star } from "lucide-react";
import { useConfirm } from "../../context/ConfirmContext.js";
import "../../css/sheets.css";

interface SheetItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  content?: {
    sheets?: any[];
    isStarred?: boolean;
  };
}

import { useUI } from "../../context/UIContext.js";

export const SheetsTab: React.FC = () => {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { setPageLoading } = useUI();
  
  // Custom Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState("Trang tính chưa có tên");
  const [isCreating, setIsCreating] = useState(false);

  const confirm = useConfirm();

  const fetchSheets = async () => {
    setPageLoading(true);
    try {
      const res = await apiClient.get("/api/v1/spreadsheets");
      setSheets(res.data.data || []);
      setLoading(false);
    } catch (err: any) {
      toast.error("Không thể tải danh sách trang tính: " + (err.response?.data?.error || err.message));
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, []);

  const handleOpenCreateModal = () => {
    setNewSheetTitle("Trang tính chưa có tên");
    setShowCreateModal(true);
  };

  const submitCreateSheet = async () => {
    const trimmedTitle = newSheetTitle.trim();
    if (!trimmedTitle) {
      toast.warn("Tên trang tính không được để trống!");
      return;
    }

    setIsCreating(true);
    try {
      let initialSheets: any[] = [{ name: "Sheet1", cells: {}, rowCount: 500, colCount: 26 }];
      const vipTemplateStr = localStorage.getItem("hou_vip_sheet_template");
      if (vipTemplateStr) {
        try {
          const parsedVip = JSON.parse(vipTemplateStr);
          if (parsedVip && parsedVip.name) {
            initialSheets = [parsedVip];
          }
        } catch (e) {
          console.error("Lỗi đọc VIP sheet template:", e);
        }
      }

      const res = await apiClient.post("/api/v1/spreadsheets", {
        title: trimmedTitle,
        content: { sheets: initialSheets }
      });
      toast.success("Tạo trang tính thành công!");
      setShowCreateModal(false);
      // Chuyển hướng trực tiếp tới trang biên tập độc lập (full-screen)
      navigate(`/admin/sheets/${res.data.data.id}`);
    } catch (err: any) {
      toast.error("Lỗi khi tạo trang tính: " + (err.response?.data?.error || err.message));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSheet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const isConfirmed = await confirm({
      title: "Xóa trang tính",
      message: "Bạn có chắc chắn muốn xóa trang tính này không? Hành động này không thể hoàn tác.",
      confirmText: "Xóa",
      cancelText: "Hủy",
    });

    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/api/v1/spreadsheets/${id}`);
      toast.success("Xóa trang tính thành công!");
      fetchSheets();
    } catch (err: any) {
      toast.error("Lỗi khi xóa trang tính: " + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleStar = async (sheet: SheetItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStarred = !!sheet.content?.isStarred;
    const updatedContent = {
      ...(sheet.content || {}),
      isStarred: !currentStarred
    };
    try {
      await apiClient.put(`/api/v1/spreadsheets/${sheet.id}`, {
        content: updatedContent
      });
      toast.success(!currentStarred ? "Đã gắn dấu sao trang tính!" : "Đã bỏ gắn dấu sao!");
      fetchSheets();
    } catch (err: any) {
      toast.error("Lỗi khi cập nhật trạng thái dấu sao: " + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenSheet = (id: string) => {
    // Chuyển hướng trực tiếp tới trang biên tập độc lập (full-screen)
    navigate(`/admin/sheets/${id}`);
  };

  const filteredSheets = sheets
    .filter((sheet) => sheet.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aStarred = a.content?.isStarred ? 1 : 0;
      const bStarred = b.content?.isStarred ? 1 : 0;
      if (aStarred !== bStarred) {
        return bStarred - aStarred; // Starred items on TOP!
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="sheets-list-view">
      <div className="sheets-header">
        <div className="sheets-title-section">
          <h2>Trang tính quản trị</h2>
          <p>Quản lý dữ liệu, biểu mẫu, tính toán tương tự Google Sheets dành cho Admin và Management</p>
        </div>
        <button onClick={handleOpenCreateModal} className="btn-create-sheet">
          <Plus className="w-4 h-4" /> Tạo trang tính mới
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full bg-[var(--bg-2)] border border-[var(--border)] text-[var(--fg)] pl-10 pr-4 py-2 rounded-lg text-sm focus:border-[var(--accent)] focus:outline-none"
            placeholder="Tìm kiếm trang tính..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button onClick={fetchSheets} className="p-2 rounded-lg bg-[var(--bg-2)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--bg-3)]" title="Làm mới">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? null : filteredSheets.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-[var(--bg-2)] border border-[var(--border)] rounded-xl">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-base font-semibold">Chưa có trang tính nào</p>
          <p className="text-xs text-gray-400 mt-1">Bấm nút "Tạo trang tính mới" ở trên để bắt đầu.</p>
        </div>
      ) : (
        <div className="sheets-grid-list">
          {filteredSheets.map((sheet) => (
            <div
              key={sheet.id}
              className="sheet-card"
              onClick={() => handleOpenSheet(sheet.id)}
            >
              <div>
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  {sheet.content?.isStarred && (
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400 ml-auto" />
                  )}
                </div>
                <h3 className="sheet-card-title">{sheet.title}</h3>
                <p className="sheet-card-date">
                  Cập nhật: {new Date(sheet.updated_at).toLocaleString("vi-VN")}
                </p>
              </div>
              <div className="sheet-card-actions flex items-center gap-1">
                <button
                  className={`btn-icon-action ${sheet.content?.isStarred ? "text-amber-400" : "text-gray-400 hover:text-amber-400"}`}
                  onClick={(e) => handleToggleStar(sheet, e)}
                  title={sheet.content?.isStarred ? "Bỏ gắn dấu sao" : "Gắn dấu sao"}
                >
                  <Star className={`w-4 h-4 ${sheet.content?.isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>
                <button
                  className="btn-icon-action delete"
                  onClick={(e) => handleDeleteSheet(sheet.id, e)}
                  title="Xóa trang tính"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Modal Form */}
      {showCreateModal && (
        <div 
          className="sheets-modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="sheets-modal-card">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
              <h3>Tạo trang tính mới</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="sheets-modal-body">
              <label>Tên trang tính</label>
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder="Nhập tên trang tính..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    submitCreateSheet();
                  }
                }}
              />
            </div>
            <div className="sheets-modal-actions">
              <button 
                className="btn-modal-cancel" 
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                Hủy
              </button>
              <button 
                className="btn-modal-confirm" 
                onClick={submitCreateSheet}
                disabled={isCreating}
              >
                {isCreating ? "Đang tạo..." : "Tạo trang tính"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SheetsTab;
