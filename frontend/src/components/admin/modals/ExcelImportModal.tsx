// frontend/src/components/admin/modals/ExcelImportModal.tsx
import React from "react";
import { X } from "lucide-react";

interface ExcelImportModalProps {
  show: boolean;
  onClose: () => void;
  importOption: "new_doc" | "new_sheet" | "replace_current";
  setImportOption: (opt: "new_doc" | "new_sheet" | "replace_current") => void;
  onExecuteImport: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  show,
  onClose,
  importOption,
  setImportOption,
  onExecuteImport,
}) => {
  if (!show) return null;

  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card max-w-[450px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-4">
          <h3 className="text-lg font-bold">Nhập dữ liệu từ Excel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body py-2 space-y-4 text-[14px]">
          <p className="text-sm text-[var(--fg-muted)] mb-3">
            Chọn vị trí bạn muốn nhập dữ liệu từ tệp tin Excel này:
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]">
              <input 
                type="radio" 
                name="importOption" 
                value="new_doc" 
                checked={importOption === "new_doc"} 
                onChange={() => setImportOption("new_doc")} 
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold block text-left">Tạo trang tính mới</span>
                <span className="text-xs text-gray-400 text-left block">Tạo một tài liệu bảng tính hoàn toàn mới trên hệ thống</span>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]">
              <input 
                type="radio" 
                name="importOption" 
                value="new_sheet" 
                checked={importOption === "new_sheet"} 
                onChange={() => setImportOption("new_sheet")} 
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold block text-left">Chèn trang sheet mới</span>
                <span className="text-xs text-gray-400 text-left block">Tạo thêm tab sheet mới vào tài liệu hiện tại</span>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)]">
              <input 
                type="radio" 
                name="importOption" 
                value="replace_current" 
                checked={importOption === "replace_current"} 
                onChange={() => setImportOption("replace_current")} 
                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold block text-left">Thay thế trang sheet hiện tại</span>
                <span className="text-xs text-gray-400 text-left block">Ghi đè hoàn toàn dữ liệu của tab hiện tại bằng dữ liệu mới</span>
              </div>
            </label>
          </div>
        </div>
        <div className="sheets-modal-actions mt-6">
          <button onClick={onClose} className="btn-modal-cancel">Hủy bỏ</button>
          <button
            onClick={onExecuteImport}
            className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Nhập dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
};
