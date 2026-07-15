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
};

interface CellEditorProps {
  initialValue: string;
  onCommit: (newValue: string, moveDirection: "down" | "none") => void;
  onCancel: () => void;
}

const CellEditor: React.FC<CellEditorProps> = ({ initialValue, onCommit, onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <input
      ref={inputRef}
      type="text"
      className="cell-editor"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value, "none")}
      onKeyDown={handleKeyDown}
    />
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
      className={`sheet-cell ${isSelected ? "selected" : ""} ${inRange ? "in-range" : ""}`}
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
