import React from "react";
import { Loader2 } from "lucide-react";

interface StudentImportModalProps {
  show: boolean;
  importText: string;
  setImportText: (val: string) => void;
  importing: boolean;
  onClose: () => void;
  onImport: () => void;
}

const StudentImportModal: React.FC<StudentImportModalProps> = ({
  show,
  importText,
  setImportText,
  importing,
  onClose,
  onImport,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 relative animate-scale-in">
        <h3 className="modal-heading text-base font-bold mb-2">Nhập dữ liệu sinh viên từ mảng JSON</h3>
        <p className="form-label text-xs mb-4">
          Dán mảng dữ liệu JSON có cấu trúc gồm các trường: studentId, fullName, username, course, subject, examRoom, examSession, examTime...
        </p>
        <textarea
          placeholder='[{"studentId": "2301", "fullName": "Nguyễn Văn A", ...}]'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="textarea-json w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500 font-mono text-xs mb-4 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-cancel px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={importing}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang nhập...
              </>
            ) : (
              "Nhập danh sách"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentImportModal;
