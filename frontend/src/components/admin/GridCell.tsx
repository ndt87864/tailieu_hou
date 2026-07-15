// frontend/src/components/admin/GridCell.tsx
import React, { useState, useEffect, useRef } from "react";

export type CellData = {
  value: string;
  formula: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: string;
  link?: string;
};

const parseDateString = (str: string): Date => {
  const parts = str.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

const formatDateString = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const parseTimeString = (str: string) => {
  const parts = str.split(":");
  return {
    hour: parts[0] ? parseInt(parts[0], 10) : 0,
    minute: parts[1] ? parseInt(parts[1], 10) : 0,
    second: parts[2] ? parseInt(parts[2], 10) : 0,
  };
};

interface CellEditorProps {
  initialValue: string;
  onCommit: (newValue: string, moveDirection: "down" | "none") => void;
  onCancel: () => void;
}

const CellEditor: React.FC<CellEditorProps> = ({ initialValue, onCommit, onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInteracting = useRef(false);

  const isDateCell = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(initialValue.trim());
  const isTimeCell = /^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(initialValue.trim());
  const [showCalendar, setShowCalendar] = useState(isDateCell);
  const [showTimePicker, setShowTimePicker] = useState(isTimeCell);
  
  const initialDate = isDateCell ? parseDateString(initialValue) : new Date();
  const [viewDate, setViewDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const parsedTime = isTimeCell ? parseTimeString(initialValue) : { hour: 12, minute: 0, second: 0 };
  const [hour, setHour] = useState(parsedTime.hour);
  const [minute, setMinute] = useState(parsedTime.minute);
  const [second, setSecond] = useState(parsedTime.second);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(value, "down");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  let startDayOffset = firstDayOfMonth.getDay(); 
  if (startDayOffset === 0) startDayOffset = 7;
  startDayOffset -= 1;
  
  const daysInMonth = lastDayOfMonth.getDate();
  
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };
  
  const handleSelectDay = (day: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newD = new Date(year, month, day);
    setSelectedDate(newD);
    const newStr = formatDateString(newD);
    setValue(newStr);
    onCommit(newStr, "none");
  };

  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const today = new Date();
    setSelectedDate(today);
    setViewDate(today);
    const newStr = formatDateString(today);
    setValue(newStr);
    onCommit(newStr, "none");
  };

  const handleApplyTime = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
    setValue(newStr);
    onCommit(newStr, "none");
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        className="cell-editor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (isInteracting.current) {
            inputRef.current?.focus();
          } else {
            onCommit(value, "none");
          }
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (isDateCell) setShowCalendar(true);
          if (isTimeCell) setShowTimePicker(true);
        }}
      />
      {showCalendar && (
        <div 
          className="sheets-datepicker-dropdown" 
          onMouseDown={e => e.preventDefault()}
          onMouseEnter={() => { isInteracting.current = true; }}
          onMouseLeave={() => { isInteracting.current = false; }}
        >
          <div className="datepicker-header">
            <span>tháng {month + 1} năm {year}</span>
            <div className="datepicker-nav">
              <button onClick={handlePrevMonth}>&lt;</button>
              <button onClick={handleNextMonth}>&gt;</button>
            </div>
          </div>
          <div className="datepicker-weekdays">
            <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
          </div>
          <div className="datepicker-days">
            {Array.from({ length: startDayOffset }).map((_, idx) => (
              <span key={`empty-${idx}`} className="datepicker-day empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const isSelected = selectedDate.getDate() === dayNum && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
              return (
                <span 
                  key={`day-${dayNum}`} 
                  className={`datepicker-day ${isSelected ? "selected" : ""}`}
                  onClick={(e) => handleSelectDay(dayNum, e)}
                >
                  {dayNum}
                </span>
              );
            })}
          </div>
          <div className="datepicker-footer">
            <button onClick={handleToday}>Hôm nay</button>
          </div>
        </div>
      )}

      {showTimePicker && (
        <div 
          className="sheets-datepicker-dropdown" 
          onMouseDown={e => e.preventDefault()} 
          style={{ minWidth: "180px" }}
          onMouseEnter={() => { isInteracting.current = true; }}
          onMouseLeave={() => { isInteracting.current = false; }}
        >
          <div className="datepicker-header">
            <span>Chọn thời gian</span>
          </div>
          <div className="flex items-center gap-1 py-3 justify-center">
            <select 
              value={hour} 
              onChange={e => setHour(parseInt(e.target.value, 10))}
              className="p-1 border rounded bg-[var(--bg-2)] text-[var(--fg)] text-xs w-[50px] text-center"
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <span className="font-bold text-xs">:</span>
            <select 
              value={minute} 
              onChange={e => setMinute(parseInt(e.target.value, 10))}
              className="p-1 border rounded bg-[var(--bg-2)] text-[var(--fg)] text-xs w-[50px] text-center"
            >
              {Array.from({ length: 60 }).map((_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <span className="font-bold text-xs">:</span>
            <select 
              value={second} 
              onChange={e => setSecond(parseInt(e.target.value, 10))}
              className="p-1 border rounded bg-[var(--bg-2)] text-[var(--fg)] text-xs w-[50px] text-center"
            >
              {Array.from({ length: 60 }).map((_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div className="datepicker-footer flex justify-end gap-2 mt-2">
            <button onClick={handleApplyTime}>Áp dụng</button>
          </div>
        </div>
      )}
    </div>
  );
};

interface GridCellProps {
  address: string;
  row: number;
  col: number;
  displayValue: string;
  cellData: CellData | undefined;
  isSelected: boolean;
  isEditing: boolean;
  inRange: boolean;
  onCellMouseDown: (address: string, col: number, row: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (address: string, col: number, row: number, e: React.MouseEvent) => void;
  onCellDoubleClick: (address: string) => void;
  onCellContextMenu?: (address: string, col: number, row: number, e: React.MouseEvent) => void;
  onCommit: (newValue: string, moveDirection: "down" | "none") => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}

export const GridCell: React.FC<GridCellProps> = React.memo(({
  address,
  row,
  col,
  displayValue,
  cellData,
  isSelected,
  isEditing,
  inRange,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onCellContextMenu,
  onCommit,
  onCancel,
  style,
}) => {
  const isLink = !!cellData?.link;
  const cellStyle: React.CSSProperties = {
    fontWeight: cellData?.bold ? "bold" : "normal",
    fontStyle: cellData?.italic ? "italic" : "normal",
    textDecoration: isLink ? "underline" : (cellData?.underline ? "underline" : "none"),
    color: isLink ? "#1a73e8" : (cellData?.color || "inherit"),
    backgroundColor: cellData?.bg || "transparent",
    textAlign: cellData?.align || "left",
    fontFamily: cellData?.fontFamily || "inherit",
    fontSize: cellData?.fontSize || "inherit",
    cursor: isLink ? "pointer" : "default",
    ...style,
  };

  return (
    <td
      data-row={row}
      data-col={col}
      className={`sheet-cell ${isSelected ? "selected" : ""} ${inRange ? "in-range" : ""} ${isEditing ? "editing" : ""}`}
      style={cellStyle}
      onMouseDown={(e) => onCellMouseDown(address, col, row, e)}
      onMouseEnter={(e) => onCellMouseEnter(address, col, row, e)}
      onDoubleClick={() => onCellDoubleClick(address)}
      onContextMenu={(e) => onCellContextMenu && onCellContextMenu(address, col, row, e)}
    >
      {isEditing ? (
        <CellEditor
          initialValue={cellData?.formula || cellData?.value || ""}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : (
        displayValue
      )}
    </td>
  );
}, (prevProps, nextProps) => {
  // So sánh sâu đối tượng style để tránh render lại cell khi component cha tạo style object mới nhưng giữ nguyên thuộc tính
  const styleEqual = 
    (!prevProps.style && !nextProps.style) ||
    (!!prevProps.style && !!nextProps.style &&
     prevProps.style.position === nextProps.style.position &&
     prevProps.style.top === nextProps.style.top &&
     prevProps.style.left === nextProps.style.left &&
     prevProps.style.zIndex === nextProps.style.zIndex);

  // So sánh sâu cellData để tránh render lại không cần thiết khi đối tượng data thay đổi tham chiếu nhưng giữ nguyên giá trị
  const cellDataEqual =
    prevProps.cellData === nextProps.cellData ||
    (!!prevProps.cellData && !!nextProps.cellData &&
     prevProps.cellData.value === nextProps.cellData.value &&
     prevProps.cellData.formula === nextProps.cellData.formula &&
     prevProps.cellData.bold === nextProps.cellData.bold &&
     prevProps.cellData.italic === nextProps.cellData.italic &&
     prevProps.cellData.underline === nextProps.cellData.underline &&
     prevProps.cellData.color === nextProps.cellData.color &&
     prevProps.cellData.bg === nextProps.cellData.bg &&
     prevProps.cellData.align === nextProps.cellData.align &&
     prevProps.cellData.fontFamily === nextProps.cellData.fontFamily &&
     prevProps.cellData.fontSize === nextProps.cellData.fontSize);

  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.inRange === nextProps.inRange &&
    prevProps.displayValue === nextProps.displayValue &&
    cellDataEqual &&
    prevProps.onCellMouseDown === nextProps.onCellMouseDown &&
    prevProps.onCellMouseEnter === nextProps.onCellMouseEnter &&
    prevProps.onCellDoubleClick === nextProps.onCellDoubleClick &&
    styleEqual
  );
});

GridCell.displayName = "GridCell";
