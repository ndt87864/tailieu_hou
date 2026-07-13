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
  onCellMouseEnter: (address: string, col: number, row: number) => void;
  onCellDoubleClick: (address: string) => void;
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
  onCommit,
  onCancel,
  style,
}) => {
  const cellStyle: React.CSSProperties = {
    fontWeight: cellData?.bold ? "bold" : "normal",
    fontStyle: cellData?.italic ? "italic" : "normal",
    textDecoration: cellData?.underline ? "underline" : "none",
    color: cellData?.color || "inherit",
    backgroundColor: cellData?.bg || "transparent",
    textAlign: cellData?.align || "left",
    fontFamily: cellData?.fontFamily || "inherit",
    fontSize: cellData?.fontSize || "inherit",
    ...style,
  };

  return (
    <td
      data-row={row}
      data-col={col}
      className={`sheet-cell ${isSelected ? "selected" : ""} ${inRange ? "in-range" : ""}`}
      style={cellStyle}
      onMouseDown={(e) => onCellMouseDown(address, col, row, e)}
      onMouseEnter={() => onCellMouseEnter(address, col, row)}
      onDoubleClick={() => onCellDoubleClick(address)}
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
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.inRange === nextProps.inRange &&
    prevProps.displayValue === nextProps.displayValue &&
    prevProps.cellData === nextProps.cellData &&
    prevProps.onCellMouseDown === nextProps.onCellMouseDown &&
    prevProps.onCellMouseEnter === nextProps.onCellMouseEnter &&
    prevProps.onCellDoubleClick === nextProps.onCellDoubleClick &&
    prevProps.style === nextProps.style
  );
});

GridCell.displayName = "GridCell";
