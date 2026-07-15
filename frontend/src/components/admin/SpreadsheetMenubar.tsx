import React, { useState } from "react";
import { ChevronRight, Check, Edit2, Trash2 } from "lucide-react";
import { parseCellAddress, colLetterToNumber } from "../../utils/formulaEvaluator.js";

interface SpreadsheetMenubarProps {
  activeMenu: string | null;
  setActiveMenu: (m: string | null) => void;
  menubarRef: React.RefObject<HTMLDivElement>;
  
  onNewSpreadsheet: () => void;
  onOpenSpreadsheet: () => void;
  onImportExcelClick: () => void;
  onMakeCopy: () => void;
  onDownload: (type: "csv" | "tsv" | "xlsx" | "pdf") => void;
  onRename: () => void;
  onMoveToTrash: () => void;
  onShowDetails: () => void;
  
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onPasteSpecial: (option: "value" | "format") => void;
  onToggleFindReplace: () => void;
  
  sheets: any[];
  onUnhideSheet: (idx: number) => void;
  
  showFormulaBar: boolean;
  setShowFormulaBar: (v: boolean) => void;
  showGridlines: boolean;
  setShowGridlines: (v: boolean) => void;
  showFormulas: boolean;
  setShowFormulas: (v: boolean) => void;
  
  freezeRows: number;
  setFreezeRows: (r: number) => void;
  freezeCols: number;
  setFreezeCols: (c: number) => void;
  
  onInsertRow: (pos: "above" | "below") => void;
  onInsertCol: (pos: "left" | "right") => void;
  onInsertFormula: (func: string) => void;
  onApplyStyle: (style: "bold" | "italic" | "underline" | "strikethrough") => void;
  
  onSortSheet: (dir: "asc" | "desc") => void;
  onTrimWhitespace: () => void;
  onRemoveEmptyRows: () => void;
  onOpenHelp: () => void;
  selectedCell: string | null;
  onDeleteRow: (row: number) => void;
  onDeleteCol: (colLetter: string) => void;
  onClearValues: () => void;
  onFormatSelection: (type: "currency" | "percent" | "decimal-inc" | "decimal-dec" | "time" | "date") => void;
  onRemoveDuplicates: () => void;
  onClearFormatting: () => void;
  commonFormulas: Array<{ id: string; name: string; formula: string; description?: string }>;
  addCommonFormula: (name: string, formula: string, description?: string) => Promise<boolean>;
  updateCommonFormula: (id: string, name: string, formula: string, description?: string) => Promise<boolean>;
  deleteCommonFormula: (id: string) => Promise<boolean>;
  applyCommonFormula: (formula: string) => void;
}

export const SpreadsheetMenubar: React.FC<SpreadsheetMenubarProps> = ({
  activeMenu,
  setActiveMenu,
  menubarRef,
  onNewSpreadsheet,
  onOpenSpreadsheet,
  onImportExcelClick,
  onMakeCopy,
  onDownload,
  onRename,
  onMoveToTrash,
  onShowDetails,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onPasteSpecial,
  onToggleFindReplace,
  sheets,
  onUnhideSheet,
  showFormulaBar,
  setShowFormulaBar,
  showGridlines,
  setShowGridlines,
  showFormulas,
  setShowFormulas,
  freezeRows,
  setFreezeRows,
  freezeCols,
  setFreezeCols,
  onInsertRow,
  onInsertCol,
  onInsertFormula,
  onApplyStyle,
  onSortSheet,
  onTrimWhitespace,
  onRemoveEmptyRows,
  onOpenHelp,
  selectedCell,
  onDeleteRow,
  onDeleteCol,
  onClearValues,
  onFormatSelection,
  onAlignChange,
  onRemoveDuplicates,
  onClearFormatting,
  commonFormulas,
  addCommonFormula,
  updateCommonFormula,
  deleteCommonFormula,
  applyCommonFormula,
}) => {
  const [showAddFormulaModal, setShowAddFormulaModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState<any | null>(null);
  const [newFormulaName, setNewFormulaName] = useState("");
  const [newFormulaContent, setNewFormulaContent] = useState("");
  const [newFormulaDesc, setNewFormulaDesc] = useState("");

  const handleAddFormulaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormulaName || !newFormulaContent) return;
    
    let success = false;
    if (editingFormula) {
      success = await updateCommonFormula(editingFormula.id, newFormulaName, newFormulaContent, newFormulaDesc);
    } else {
      success = await addCommonFormula(newFormulaName, newFormulaContent, newFormulaDesc);
    }

    if (success) {
      setNewFormulaName("");
      setNewFormulaContent("");
      setNewFormulaDesc("");
      setEditingFormula(null);
      setShowAddFormulaModal(false);
    }
  };

  const selectedCellParsed = selectedCell ? parseCellAddress(selectedCell) : null;
  const currentRow = selectedCellParsed ? selectedCellParsed.row : 1;
  const currentColLetter = selectedCellParsed ? selectedCellParsed.col : "A";
  const currentColIdx = selectedCellParsed ? colLetterToNumber(currentColLetter) : 1;

  return (
    <div className="sheet-google-menubar" ref={menubarRef}>
      <div 
        className={`menu-item-dropdown ${activeMenu === "file" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("file"); }}
      >
        Tệp
        <div className="menu-dropdown-content" onClick={() => setActiveMenu(null)}>
          {/* Mới (New) Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Mới</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[160px]">
              <button onClick={() => { onNewSpreadsheet(); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Bảng tính mới</button>
            </div>
          </div>

          <button onClick={onOpenSpreadsheet} className="dropdown-action-btn">
            Mở (Ctrl+O)
          </button>

          <button onClick={onImportExcelClick} className="dropdown-action-btn">
            Nhập
          </button>

          <button onClick={onMakeCopy} className="dropdown-action-btn">
            Tạo bản sao
          </button>

          <div className="menu-dropdown-divider"></div>

          {/* Tải xuống Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Tải xuống</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              <button onClick={() => { onDownload("xlsx"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Microsoft Excel (.xlsx)</button>
              <button onClick={() => { onDownload("pdf"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Tài liệu PDF (.pdf)</button>
              <button onClick={() => { onDownload("csv"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Giá trị phân tách bằng dấu phẩy (.csv)</button>
              <button onClick={() => { onDownload("tsv"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Giá trị phân tách bằng dấu tab (.tsv)</button>
            </div>
          </div>

          <div className="menu-dropdown-divider"></div>

          <button onClick={onRename} className="dropdown-action-btn">
            Đổi tên
          </button>

          <button onClick={onMoveToTrash} className="dropdown-action-btn text-red-500 hover:bg-red-500/10">
            Chuyển vào thùng rác
          </button>

          <div className="menu-dropdown-divider"></div>

          <button onClick={onShowDetails} className="dropdown-action-btn">
            Chi tiết
          </button>

          <div className="menu-dropdown-divider"></div>

          <button onClick={() => window.print()} className="dropdown-action-btn">
            In (Ctrl+P)
          </button>
        </div>
      </div>

      <div 
        className={`menu-item-dropdown ${activeMenu === "edit" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "edit" ? null : "edit")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("edit"); }}
      >
        Chỉnh sửa
        <div className="menu-dropdown-content" onClick={() => setActiveMenu(null)}>
          <button onClick={onUndo} className="dropdown-action-btn flex justify-between w-full">
            <span>Hoàn tác</span>
            <span className="text-xs text-gray-400 font-normal">Ctrl+Z</span>
          </button>
          <button onClick={onRedo} className="dropdown-action-btn flex justify-between w-full">
            <span>Làm lại</span>
            <span className="text-xs text-gray-400 font-normal">Ctrl+Y</span>
          </button>
          <div className="menu-dropdown-divider"></div>
          <button onClick={onCut} className="dropdown-action-btn flex justify-between w-full">
            <span>Cắt</span>
            <span className="text-xs text-gray-400 font-normal">Ctrl+X</span>
          </button>
          <button onClick={onCopy} className="dropdown-action-btn flex justify-between w-full">
            <span>Sao chép</span>
            <span className="text-xs text-gray-400 font-normal">Ctrl+C</span>
          </button>
          <button onClick={onPaste} className="dropdown-action-btn flex justify-between w-full">
            <span>Dán</span>
            <span className="text-xs text-gray-400 font-normal">Ctrl+V</span>
          </button>
          
          {/* Dán đặc biệt Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Dán đặc biệt</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              <button onClick={() => { onPasteSpecial("value"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Chỉ dán giá trị</button>
              <button onClick={() => { onPasteSpecial("format"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Chỉ dán định dạng</button>
            </div>
          </div>
          
          <div className="menu-dropdown-divider"></div>
          {/* Xóa Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Xóa</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              <button onClick={() => { onDeleteRow(currentRow); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Hàng {currentRow}</button>
              <button onClick={() => { onDeleteCol(currentColLetter); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Cột {currentColLetter}</button>
              <button onClick={() => { onClearValues(); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Các giá trị</button>
            </div>
          </div>

          <div className="menu-dropdown-divider"></div>
          <button onClick={onToggleFindReplace} className="dropdown-action-btn flex justify-between w-full">
            <span>Tìm kiếm & Thay thế</span>
            <span className="text-xs text-gray-400 font-normal">Ctrl+H</span>
          </button>
        </div>
      </div>

      <div 
        className={`menu-item-dropdown ${activeMenu === "view" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("view"); }}
      >
        Xem
        <div className="menu-dropdown-content" onClick={() => setActiveMenu(null)}>
          {/* Hiển thị Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Hiển thị</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              <button onClick={() => setShowFormulaBar(!showFormulaBar)} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Thanh công thức</span>
                {showFormulaBar && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => setShowGridlines(!showGridlines)} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Đường lưới</span>
                {showGridlines && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => setShowFormulas(!showFormulas)} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Hiển thị công thức</span>
                {showFormulas && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
            </div>
          </div>

          {/* Cố định Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Cố định</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[220px]">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Hàng</div>
              <button onClick={() => { setFreezeRows(0); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Không có hàng nào</span>
                {freezeRows === 0 && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => { setFreezeRows(1); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>1 hàng</span>
                {freezeRows === 1 && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => { setFreezeRows(2); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>2 hàng</span>
                {freezeRows === 2 && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => { setFreezeRows(currentRow); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Đến hàng hiện tại ({currentRow})</span>
                {freezeRows === currentRow && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              
              <div className="menu-dropdown-divider"></div>
              
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cột</div>
              <button onClick={() => { setFreezeCols(0); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Không có cột nào</span>
                {freezeCols === 0 && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => { setFreezeCols(1); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>1 cột</span>
                {freezeCols === 1 && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => { setFreezeCols(2); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>2 cột</span>
                {freezeCols === 2 && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
              <button onClick={() => { setFreezeCols(currentColIdx); setActiveMenu(null); }} className="dropdown-action-btn w-full flex justify-between items-center text-left">
                <span>Đến cột hiện tại ({currentColLetter})</span>
                {freezeCols === currentColIdx && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
              </button>
            </div>
          </div>

          <div className="menu-dropdown-divider"></div>
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Trang tính đã ẩn</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              {sheets.filter((s) => s.isHidden).length === 0 ? (
                <span className="px-4 py-2 text-xs text-gray-400 italic">Không có trang tính ẩn</span>
              ) : (
                sheets.map((sheet, idx) => (
                  sheet.isHidden && (
                    <button 
                      key={idx} 
                      onClick={() => { onUnhideSheet(idx); setActiveMenu(null); }} 
                      className="dropdown-action-btn w-full text-left"
                    >
                      {sheet.name}
                    </button>
                  )
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div 
        className={`menu-item-dropdown ${activeMenu === "insert" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "insert" ? null : "insert")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("insert"); }}
      >
        Chèn
        <div className="menu-dropdown-content" onClick={() => setActiveMenu(null)}>
          {/* Hàng Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Hàng</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[220px]">
              <button onClick={() => { onInsertRow("above"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Chèn 1 hàng lên trên</button>
              <button onClick={() => { onInsertRow("below"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Chèn 1 hàng xuống dưới</button>
            </div>
          </div>

          {/* Cột Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Cột</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[220px]">
              <button onClick={() => { onInsertCol("left"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Chèn 1 cột sang bên trái</button>
              <button onClick={() => { onInsertCol("right"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Chèn 1 cột sang bên phải</button>
            </div>
          </div>

          <div className="menu-dropdown-divider"></div>
          
          {/* Hàm Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Hàm</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[160px]">
              <button onClick={() => { onInsertFormula("SUM"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">SUM</button>
              <button onClick={() => { onInsertFormula("AVERAGE"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">AVERAGE</button>
              <button onClick={() => { onInsertFormula("MIN"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">MIN</button>
              <button onClick={() => { onInsertFormula("MAX"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">MAX</button>
            </div>
          </div>
        </div>
      </div>

      <div 
        className={`menu-item-dropdown ${activeMenu === "format" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "format" ? null : "format")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("format"); }}
      >
        Định dạng
        <div className="menu-dropdown-content" onClick={() => setActiveMenu(null)}>
          {/* Số Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Số</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              <button onClick={() => { onFormatSelection("decimal-dec"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Số thường</button>
              <button onClick={() => { onFormatSelection("percent"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Phần trăm</button>
              <button onClick={() => { onFormatSelection("currency"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Tiền tệ</button>
              <button onClick={() => { onFormatSelection("time"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Thời gian</button>
              <button onClick={() => { onFormatSelection("date"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Ngày tháng</button>
              <button onClick={() => { onFormatSelection("decimal-inc"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Số thập phân</button>
            </div>
          </div>

          {/* Văn bản Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Văn bản</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[200px]">
              <button onClick={() => { onApplyStyle("bold"); setActiveMenu(null); }} className="dropdown-action-btn w-full font-bold text-left">In đậm (B)</button>
              <button onClick={() => { onApplyStyle("italic"); setActiveMenu(null); }} className="dropdown-action-btn w-full italic text-left">In nghiêng (I)</button>
              <button onClick={() => { onApplyStyle("underline"); setActiveMenu(null); }} className="dropdown-action-btn w-full underline text-left">Gạch chân (U)</button>
              <button onClick={() => { onApplyStyle("strikethrough"); setActiveMenu(null); }} className="dropdown-action-btn w-full line-through text-left">Gạch ngang (S)</button>
            </div>
          </div>

          {/* Căn chỉnh Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Căn chỉnh</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[160px]">
              <button onClick={() => { onAlignChange("left"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Trái</button>
              <button onClick={() => { onAlignChange("center"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Giữa</button>
              <button onClick={() => { onAlignChange("right"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Phải</button>
            </div>
          </div>

          <div className="menu-dropdown-divider"></div>
          <button onClick={() => { onClearFormatting(); setActiveMenu(null); }} className="dropdown-action-btn flex justify-between w-full">
            <span>Xóa định dạng</span>
          </button>
        </div>
      </div>

      <div 
        className={`menu-item-dropdown ${activeMenu === "data" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "data" ? null : "data")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("data"); }}
      >
        Dữ liệu
        <div className="menu-dropdown-content" onClick={() => setActiveMenu(null)}>
          {/* Sắp xếp trang tính Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Sắp xếp trang tính</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[260px]">
              <button onClick={() => { onSortSheet("asc"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Sắp xếp trang tính theo cột {currentColLetter} (A - Z)</button>
              <button onClick={() => { onSortSheet("desc"); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Sắp xếp trang tính theo cột {currentColLetter} (Z - A)</button>
            </div>
          </div>

          <div className="menu-dropdown-divider"></div>
          
          {/* Dọn sạch dữ liệu Submenu */}
          <div className="dropdown-action-btn relative group/sub flex justify-between items-center pr-2" onClick={(e) => e.stopPropagation()}>
            <span>Dọn sạch dữ liệu</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <div className="absolute left-full ml-[-4px] top-[-6px] hidden group-hover/sub:flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 z-[100] min-w-[220px]">
              <button onClick={() => { onTrimWhitespace(); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Dọn dẹp khoảng trắng thừa</button>
              <button onClick={() => { onRemoveDuplicates(); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left">Loại bỏ các hàng trùng lặp</button>
              <button onClick={() => { onRemoveEmptyRows(); setActiveMenu(null); }} className="dropdown-action-btn w-full text-left text-red-500">Loại bỏ các hàng trống</button>
            </div>
          </div>
        </div>
      </div>

      <div 
        className={`menu-item-dropdown ${activeMenu === "formulas" ? "active" : ""}`}
        onClick={() => setActiveMenu(activeMenu === "formulas" ? null : "formulas")}
        onMouseEnter={() => { if (activeMenu) setActiveMenu("formulas"); }}
      >
        Công thức mẫu
        <div className="menu-dropdown-content min-w-[320px]" onClick={() => setActiveMenu(null)}>
          <div className="max-h-[300px] overflow-y-auto">
            {commonFormulas.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-500 italic">Chưa có công thức nào</div>
            ) : (
              commonFormulas.map((form) => (
                <div key={form.id} className="dropdown-action-btn w-full flex items-center justify-between py-1.5 px-3 hover:bg-[var(--bg-3)] group/item" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { applyCommonFormula(form.formula); setActiveMenu(null); }}
                    className="flex flex-col items-start gap-0.5 flex-1 text-left"
                  >
                    <span className="font-medium text-sm text-[var(--fg)]">{form.name}</span>
                    <code className="text-xs text-[var(--accent)] font-mono">{form.formula}</code>
                    {form.description && (
                      <span className="text-[10px] text-gray-400 line-clamp-1">{form.description}</span>
                    )}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFormula(form);
                        setNewFormulaName(form.name);
                        setNewFormulaContent(form.formula);
                        setNewFormulaDesc(form.description || "");
                        setShowAddFormulaModal(true);
                        setActiveMenu(null);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-[var(--accent)]"
                      title="Sửa công thức"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc chắn muốn xóa công thức "${form.name}"?`)) {
                          await deleteCommonFormula(form.id);
                        }
                      }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-950 rounded text-gray-500 hover:text-red-500"
                      title="Xóa công thức"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="menu-dropdown-divider"></div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setEditingFormula(null);
              setNewFormulaName("");
              setNewFormulaContent("");
              setNewFormulaDesc("");
              setShowAddFormulaModal(true);
              setActiveMenu(null);
            }}
            className="dropdown-action-btn w-full text-left text-[var(--accent)] font-medium text-center justify-center py-2"
          >
            + Thêm công thức mới...
          </button>
        </div>
      </div>

      <div className="menu-item-dropdown" onClick={() => { onOpenHelp(); setActiveMenu(null); }}>Trợ giúp</div>

      {showAddFormulaModal && (
        <div className="sheets-modal-overlay z-[10002]" onClick={() => { setShowAddFormulaModal(false); setEditingFormula(null); }}>
          <div className="sheets-modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="sheets-modal-header">
              <h3 className="text-base font-semibold text-[var(--fg)]">
                {editingFormula ? "Sửa công thức mẫu" : "Thêm công thức mới"}
              </h3>
            </div>
            <form onSubmit={handleAddFormulaSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--fg)]">Tên công thức:</label>
                <input 
                  type="text" 
                  value={newFormulaName}
                  onChange={e => setNewFormulaName(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded-xl bg-[var(--bg-2)] text-[var(--fg)] text-sm outline-none focus:border-[var(--accent)]"
                  placeholder="Ví dụ: Tính tổng doanh thu"
                  required
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--fg)]">Công thức:</label>
                <input 
                  type="text" 
                  value={newFormulaContent}
                  onChange={e => setNewFormulaContent(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded-xl bg-[var(--bg-2)] text-[var(--fg)] text-sm font-mono outline-none focus:border-[var(--accent)]"
                  placeholder="Ví dụ: =SUM(A1:A5)"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--fg)]">Mô tả ngắn (Không bắt buộc):</label>
                <textarea 
                  value={newFormulaDesc}
                  onChange={e => setNewFormulaDesc(e.target.value)}
                  className="w-full p-2 border border-[var(--border)] rounded-xl bg-[var(--bg-2)] text-[var(--fg)] text-sm outline-none focus:border-[var(--accent)] resize-none h-16"
                  placeholder="Ví dụ: Dùng để tính tổng toàn bộ cột doanh thu"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowAddFormulaModal(false); setEditingFormula(null); }}
                  className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 rounded-xl"
                >
                  Lưu công thức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
