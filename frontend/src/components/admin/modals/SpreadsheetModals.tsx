import React from "react";
import { toast } from "react-toastify";
import { X, Clock, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Sheet } from "../../../hooks/useSpreadsheetState.js";

// 1. HelpShortcutsModal
interface HelpShortcutsModalProps {
  show: boolean;
  onClose: () => void;
}
export const HelpShortcutsModal: React.FC<HelpShortcutsModalProps> = ({ show, onClose }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay">
      <div className="sheets-modal-card" style={{ maxWidth: "500px" }}>
        <h3>Trợ giúp & Phím tắt Bảng tính</h3>
        <div className="sheets-modal-body" style={{ fontSize: "13px", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
          <p><strong>Thao tác ô tính:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nhấp đúp chuột vào ô để sửa dữ liệu hoặc nhập công thức bắt đầu bằng dấu <code>=</code> (Ví dụ: <code>=SUM(A1:A5)</code>).</li>
            <li>Kéo chuột trái từ ô này sang ô khác để chọn vùng dữ liệu (Range Selection).</li>
            <li>Ấn phím <strong>Enter</strong> để lưu chỉnh sửa và di chuyển xuống ô dưới.</li>
            <li>Ấn phím <strong>Escape</strong> để hủy bỏ chỉnh sửa hiện tại.</li>
          </ul>
          <p className="mt-2"><strong>Phím tắt hữu ích:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>Ctrl + Z</code>: Hoàn tác hành động gần nhất.</li>
            <li><code>Ctrl + C</code>: Sao chép nội dung vùng chọn.</li>
            <li><code>Ctrl + V</code>: Dán nội dung từ clipboard.</li>
            <li><code>Ctrl + A</code>: Chọn toàn bộ bảng tính.</li>
            <li><code>Ctrl + H</code>: Tìm kiếm & Thay thế.</li>
          </ul>
        </div>
        <div className="sheets-modal-actions">
          <button onClick={onClose} className="btn-modal-confirm">Đóng</button>
        </div>
      </div>
    </div>
  );
};

// 2. OpenSpreadsheetModal
interface OpenSpreadsheetModalProps {
  show: boolean;
  onClose: () => void;
  loading: boolean;
  list: any[];
}
export const OpenSpreadsheetModal: React.FC<OpenSpreadsheetModalProps> = ({ show, onClose, loading, list }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Mở trang tính</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body" style={{ maxHeight: "320px", overflowY: "auto" }}>
          {loading ? (
            <div className="text-center py-8">Đang tải danh sách...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Chưa có trang tính nào khác trên hệ thống.</div>
          ) : (
            <div className="space-y-2">
              {list.map((item) => (
                <a
                  key={item.id}
                  href={`/admin/sheets/${item.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)] transition-colors cursor-pointer text-[var(--fg)] text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium truncate max-w-[280px]">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <span>Mở</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 3. VersionHistoryModal
interface VersionHistoryModalProps {
  show: boolean;
  onClose: () => void;
  history: Array<{ timestamp: string; sheets: Sheet[] }>;
  onRestore: (sheets: Sheet[], timestamp: string) => void;
}
export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ show, onClose, history, onRestore }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Nhật ký phiên bản</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body" style={{ maxHeight: "320px", overflowY: "auto" }}>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 text-gray-400" />
              <p>Chưa có thay đổi nào trong phiên làm việc này.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)] transition-colors text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">Phiên bản sửa đổi lúc {entry.timestamp}</span>
                  </div>
                  <button
                    onClick={() => onRestore(entry.sheets, entry.timestamp)}
                    className="btn-modal-confirm py-1 px-2.5 text-xs"
                  >
                    Khôi phục
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 4. DocumentDetailsModal
interface DocumentDetailsModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  sheetsCount: number;
  cellsCount: number;
}
export const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({ show, onClose, title, sheetsCount, cellsCount }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Chi tiết tài liệu</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body" style={{ fontSize: "13px", gap: "12px" }}>
          <div>
            <span className="text-gray-400 block text-[11px] uppercase tracking-wider">Tên tài liệu</span>
            <span className="font-semibold text-sm">{title}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400 block text-[11px] uppercase tracking-wider">Số trang tính (Sheet)</span>
              <span className="font-medium">{sheetsCount}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[11px] uppercase tracking-wider">Tổng số ô dữ liệu</span>
              <span className="font-medium">{cellsCount}</span>
            </div>
          </div>
        </div>
        <div className="sheets-modal-actions">
          <button onClick={onClose} className="btn-modal-confirm">Đóng</button>
        </div>
      </div>
    </div>
  );
};

// 5. RenameSheetModal
interface RenameSheetModalProps {
  show: boolean;
  onClose: () => void;
  name: string;
  setName: (name: string) => void;
  onConfirm: () => void;
}
export const RenameSheetModal: React.FC<RenameSheetModalProps> = ({ show, onClose, name, setName, onConfirm }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Đổi tên trang tính</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body">
          <label htmlFor="rename-sheet-input-el">Tên trang tính mới</label>
          <input
            id="rename-sheet-input-el"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên trang tính..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onConfirm();
              }
            }}
          />
        </div>
        <div className="sheets-modal-actions">
          <button onClick={onClose} className="btn-modal-cancel">Hủy</button>
          <button
            disabled={!name.trim()}
            onClick={onConfirm}
            className="btn-modal-confirm"
          >
            Cập nhật
          </button>
        </div>
      </div>
    </div>
  );
};

// 6. DeleteSheetModal
interface DeleteSheetModalProps {
  show: boolean;
  onClose: () => void;
  name: string;
  onConfirm: () => void;
}
export const DeleteSheetModal: React.FC<DeleteSheetModalProps> = ({ show, onClose, name, onConfirm }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Xóa trang tính?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body py-2">
          <p className="text-sm text-[var(--fg-muted)]">
            Bạn có chắc chắn muốn xóa trang tính <strong>"{name}"</strong> không? 
            Hành động này không thể hoàn tác trực tiếp.
          </p>
        </div>
        <div className="sheets-modal-actions">
          <button onClick={onClose} className="btn-modal-cancel">Hủy bỏ</button>
          <button
            onClick={onConfirm}
            className="btn-modal-confirm bg-red-500 hover:bg-red-600 text-white"
          >
            Đồng ý xóa
          </button>
        </div>
      </div>
    </div>
  );
};

// 7. NewDocModal
interface NewDocModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  name: string;
  setName: (name: string) => void;
  onConfirm: () => void;
}
export const NewDocModal: React.FC<NewDocModalProps> = ({ show, onClose, title, name, setName, onConfirm }) => {
  if (!show) return null;
  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body py-2">
          <label htmlFor="new-doc-name-input">Tên trang tính</label>
          <input
            id="new-doc-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên trang tính..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onConfirm();
              }
            }}
          />
        </div>
        <div className="sheets-modal-actions mt-4">
          <button onClick={onClose} className="btn-modal-cancel">Hủy</button>
          <button
            disabled={!name.trim()}
            onClick={onConfirm}
            className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

// 8. SelectVipSheetsModal
interface SelectVipSheetsModalProps {
  show: boolean;
  onClose: () => void;
  templates: any[];
  onConfirm: (selectedTemplates: any[]) => void;
  onCancelCreation: () => void;
}
export const SelectVipSheetsModal: React.FC<SelectVipSheetsModalProps> = ({ show, onClose, templates, onConfirm, onCancelCreation }) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (show && templates) {
      setSelectedIds(templates.map(t => t.id || t.name));
    }
  }, [show, templates]);

  if (!show) return null;

  const handleToggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirm = () => {
    const selected = templates.filter(t => selectedIds.includes(t.id || t.name));
    onConfirm(selected);
  };

  const handleCreateNormal = () => {
    onConfirm([]); // No VIP templates selected, means create normal empty sheet
  };

  return (
    <div className="sheets-modal-overlay" onClick={onCancelCreation}>
      <div className="sheets-modal-card" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3 className="text-base font-bold">Tạo trang tính VIP?</h3>
          <button onClick={onCancelCreation} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body py-2">
          {templates.length === 1 ? (
            <p className="text-sm text-[var(--fg)] mb-3">
              Bạn có muốn tạo trang tính mới kèm Sheet VIP <strong>"{templates[0].name}"</strong> không?
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--fg-muted)] mb-3">
                Bạn có muốn tạo trang tính mới kèm các Sheet VIP mẫu không?
              </p>
              {templates.length > 0 ? (
                <div className="vip-checkbox-list">
                  {templates.map((t, idx) => {
                    const id = t.id || t.name;
                    const isChecked = selectedIds.includes(id);
                    return (
                      <label key={idx} className="vip-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(id)}
                        />
                        <span>{t.name} (VIP)</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-amber-500">Chưa có Sheet VIP nào được gán làm mẫu.</p>
              )}
            </>
          )}
        </div>
        <div className="sheets-modal-actions mt-4">
          <button onClick={handleCreateNormal} className="btn-modal-cancel">Không (Tạo thường)</button>
          <button
            onClick={handleConfirm}
            className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Có (Tạo kèm VIP)
          </button>
        </div>
      </div>
    </div>
  );
};

// 9. LinkInsertModal
interface LinkInsertModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: (text: string, url: string) => void;
  defaultText?: string;
}
export const LinkInsertModal: React.FC<LinkInsertModalProps> = ({ show, onClose, onConfirm, defaultText = "" }) => {
  const [text, setText] = React.useState(defaultText);
  const [url, setUrl] = React.useState("");

  React.useEffect(() => {
    if (show) {
      setText(defaultText);
      setUrl("");
    }
  }, [show, defaultText]);

  if (!show) return null;

  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3 className="text-base font-bold">Chèn đường liên kết</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body py-2 space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--fg-muted)]">Văn bản</label>
            <input 
              type="text" 
              value={text} 
              onChange={e => setText(e.target.value)} 
              placeholder="Nhập văn bản hiển thị"
              className="w-full p-2 border border-[var(--border)] rounded bg-[var(--bg-2)] text-[var(--fg)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--fg-muted)]">Đường liên kết (URL)</label>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://example.com"
              className="w-full p-2 border border-[var(--border)] rounded bg-[var(--bg-2)] text-[var(--fg)]"
            />
          </div>
        </div>
        <div className="sheets-modal-actions mt-4">
          <button onClick={onClose} className="btn-modal-cancel">Hủy</button>
          <button 
            onClick={() => {
              if (!url.trim()) {
                toast.warn("Đường liên kết không được để trống!");
                return;
              }
              onConfirm(text.trim(), url.trim());
              onClose();
            }} 
            className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};

// 10. FilterModal
interface FilterModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: (val: string) => void;
  colLetter: string;
}
export const FilterModal: React.FC<FilterModalProps> = ({ show, onClose, onConfirm, colLetter }) => {
  const [val, setVal] = React.useState("");

  React.useEffect(() => {
    if (show) {
      setVal("");
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3 className="text-base font-bold">Tạo bộ lọc cột {colLetter}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body py-2 space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--fg-muted)]">
              Nhập giá trị lọc cho cột {colLetter} (Để trống để hiển thị lại toàn bộ dòng)
            </label>
            <input 
              type="text" 
              value={val} 
              onChange={e => setVal(e.target.value)} 
              placeholder="Nhập từ khóa tìm kiếm..."
              className="w-full p-2 border border-[var(--border)] rounded bg-[var(--bg-2)] text-[var(--fg)]"
              autoFocus
            />
          </div>
        </div>
        <div className="sheets-modal-actions mt-4">
          <button onClick={onClose} className="btn-modal-cancel">Hủy</button>
          <button 
            onClick={() => {
              onConfirm(val.trim());
              onClose();
            }} 
            className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Lọc
          </button>
        </div>
      </div>
    </div>
  );
};
