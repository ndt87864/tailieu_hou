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
      <div className="sheets-modal-card max-w-[500px]">
        <h3>Trợ giúp & Phím tắt Bảng tính</h3>
        <div className="sheets-modal-body text-[13px] gap-[10px] max-h-[300px] overflow-y-auto">
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
      <div className="sheets-modal-card max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Mở trang tính</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body max-h-[320px] overflow-y-auto">
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
      <div className="sheets-modal-card max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Nhật ký phiên bản</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body max-h-[320px] overflow-y-auto">
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
      <div className="sheets-modal-card max-w-[400px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3>Chi tiết tài liệu</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sheets-modal-body text-[13px] gap-[12px]">
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
      <div className="sheets-modal-card max-w-[400px]" onClick={(e) => e.stopPropagation()}>
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
      <div className="sheets-modal-card max-w-[400px]" onClick={(e) => e.stopPropagation()}>
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
      <div className="sheets-modal-card max-w-[420px]" onClick={(e) => e.stopPropagation()}>
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
      <div className="sheets-modal-card max-w-[450px]" onClick={(e) => e.stopPropagation()}>
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
      <div className="sheets-modal-card max-w-[400px]" onClick={(e) => e.stopPropagation()}>
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

import { Search, ChevronDown, ChevronUp, Check, ArrowUpDown } from "lucide-react";
import { ColumnFilter } from "../../../hooks/useSpreadsheetState.js";
import { CellData } from "../GridCell.js";

// 10. FilterModal
interface FilterModalProps {
  show: boolean;
  onClose: () => void;
  colLetter: string;
  cells: Record<string, CellData>;
  rowCount: number;
  currentFilter?: ColumnFilter;
  onConfirm: (filter: ColumnFilter | null) => void;
  onSort: (dir: "asc" | "desc") => void;
}
export const FilterModal: React.FC<FilterModalProps> = ({ 
  show, 
  onClose, 
  colLetter,
  cells,
  rowCount,
  currentFilter,
  onConfirm,
  onSort
}) => {
  const [conditionType, setConditionType] = React.useState("none");
  const [conditionValue, setConditionValue] = React.useState("");
  const [conditionValue2, setConditionValue2] = React.useState("");
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showConditions, setShowConditions] = React.useState(false);
  const [showValues, setShowValues] = React.useState(true);
  
  const [isConditionSelectOpen, setIsConditionSelectOpen] = React.useState(false);
  const conditionSelectRef = React.useRef<HTMLDivElement>(null);

  const conditions = [
    { value: "none", label: "Không có" },
    { value: "empty", label: "Trống" },
    { value: "not_empty", label: "Không trống" },
    { value: "contains", label: "Văn bản bao gồm" },
    { value: "not_contains", label: "Văn bản không bao gồm" },
    { value: "starts", label: "Văn bản bắt đầu bằng" },
    { value: "ends", label: "Văn bản kết thúc bằng" },
    { value: "exact", label: "Văn bản chính xác" },
    { value: "date_is", label: "Ngày là" },
    { value: "date_before", label: "Ngày trước" },
    { value: "date_after", label: "Ngày sau" },
    { value: "greater_than", label: "Lớn hơn" },
    { value: "greater_than_or_equal", label: "Lớn hơn hoặc bằng" },
    { value: "less_than", label: "Nhỏ hơn" },
    { value: "less_than_or_equal", label: "Nhỏ hơn hoặc bằng" },
    { value: "equal", label: "Bằng" },
    { value: "not_equal", label: "Không bằng" },
    { value: "between", label: "Ở giữa" },
    { value: "not_between", label: "Nằm ngoài khoảng" },
  ];

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (conditionSelectRef.current && !conditionSelectRef.current.contains(e.target as Node)) {
        setIsConditionSelectOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Extract all unique values from this column (from row 2 onwards)
  const uniqueValues = React.useMemo(() => {
    const vals = new Set<string>();
    for (let r = 2; r <= rowCount; r++) {
      const v = (cells[`${colLetter}${r}`]?.value || "").trim();
      vals.add(v);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [cells, colLetter, rowCount]);

  React.useEffect(() => {
    if (show) {
      setConditionType(currentFilter?.conditionType || "none");
      setConditionValue(currentFilter?.conditionValue || "");
      setConditionValue2(currentFilter?.conditionValue2 || "");
      setSelectedValues(currentFilter?.selectedValues || uniqueValues);
      setSearchQuery("");
      setShowConditions(!!(currentFilter?.conditionType && currentFilter.conditionType !== "none"));
      setIsConditionSelectOpen(false);
    }
  }, [show, currentFilter, uniqueValues]);

  if (!show) return null;

  const handleToggleValue = (val: string) => {
    setSelectedValues(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const handleSelectAll = () => {
    setSelectedValues(uniqueValues);
  };

  const handleClearAll = () => {
    setSelectedValues([]);
  };

  const filteredUniqueValues = uniqueValues.filter(v => 
    v.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApply = () => {
    const hasCondition = conditionType !== "none";
    const hasValueFilter = selectedValues.length !== uniqueValues.length;

    if (!hasCondition && !hasValueFilter) {
      // Clear filter
      onConfirm(null);
    } else {
      onConfirm({
        conditionType,
        conditionValue,
        conditionValue2,
        selectedValues
      });
    }
    onClose();
  };

  return (
    <div className="sheets-modal-overlay" onClick={onClose}>
      <div className="sheets-modal-card sheets-filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-emerald-500" />
            Bộ lọc cột {colLetter}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="sheets-modal-body sheets-filter-modal-body">
          {/* 1. Sorting Section */}
          <div className="filter-sort-section">
            <button className="filter-sort-btn" onClick={() => { onSort("asc"); onClose(); }}>
              Sắp xếp A đến Z
            </button>
            <button className="filter-sort-btn" onClick={() => { onSort("desc"); onClose(); }}>
              Sắp xếp Z đến A
            </button>
          </div>

          <div className="border-t border-[var(--border)] my-2" />

          {/* 2. Filter by Condition */}
          <div className="filter-accordion-section">
            <button 
              className="filter-accordion-header"
              onClick={() => setShowConditions(!showConditions)}
            >
              <span>Lọc theo điều kiện</span>
              {showConditions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showConditions && (
              <div className="filter-accordion-content" ref={conditionSelectRef}>
                <div className="custom-filter-select-wrapper">
                  <div 
                    className="custom-filter-select-trigger"
                    onClick={() => setIsConditionSelectOpen(!isConditionSelectOpen)}
                  >
                    <span>{conditions.find(c => c.value === conditionType)?.label || "Không có"}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  
                  {isConditionSelectOpen && (
                    <div className="custom-filter-select-options">
                      {conditions.map((cond) => (
                        <div 
                          key={cond.value}
                          className={`custom-filter-select-option ${conditionType === cond.value ? "selected" : ""}`}
                          onClick={() => {
                            setConditionType(cond.value);
                            setIsConditionSelectOpen(false);
                          }}
                        >
                          {cond.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {conditionType !== "none" && conditionType !== "empty" && conditionType !== "not_empty" && (
                  <div className="filter-condition-inputs mt-2">
                    <input 
                      type="text"
                      className="filter-input-text"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      placeholder={
                        conditionType.startsWith("date") ? "dd/mm/yyyy hoặc yyyy-mm-dd" :
                        conditionType === "between" || conditionType === "not_between" ? "Giá trị đầu" : "Nhập giá trị lọc..."
                      }
                    />
                    {(conditionType === "between" || conditionType === "not_between") && (
                      <input 
                        type="text"
                        className="filter-input-text mt-2"
                        value={conditionValue2}
                        onChange={(e) => setConditionValue2(e.target.value)}
                        placeholder="Giá trị cuối"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] my-2" />

          {/* 3. Filter by Value */}
          <div className="filter-accordion-section">
            <button 
              className="filter-accordion-header"
              onClick={() => setShowValues(!showValues)}
            >
              <span>Lọc theo giá trị</span>
              {showValues ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showValues && (
              <div className="filter-accordion-content">
                <div className="flex justify-between items-center text-xs text-blue-500 mb-2">
                  <button className="hover:underline" onClick={handleSelectAll}>Chọn tất cả</button>
                  <button className="hover:underline" onClick={handleClearAll}>Xóa</button>
                </div>

                <div className="filter-search-wrapper mb-2">
                  <Search className="w-3.5 h-3.5 filter-search-icon" />
                  <input 
                    type="text"
                    className="filter-search-input"
                    placeholder="Tìm kiếm giá trị..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-checkbox-list">
                  {filteredUniqueValues.length === 0 ? (
                    <div className="text-xs text-gray-500 py-4 text-center">Không tìm thấy giá trị</div>
                  ) : (
                    filteredUniqueValues.map((val, idx) => {
                      const isChecked = selectedValues.includes(val);
                      return (
                        <label key={idx} className="filter-checkbox-item">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleValue(val)}
                          />
                          <span className="truncate">{val === "" ? "(Trống)" : val}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sheets-modal-actions mt-4 border-t border-[var(--border)] pt-3">
          <button onClick={onClose} className="btn-modal-cancel">Hủy</button>
          <button 
            onClick={handleApply}
            className="btn-modal-confirm bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
