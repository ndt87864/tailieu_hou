// frontend/src/hooks/useGridResize.ts
import { useEffect, useRef } from "react";

export const useGridResize = (
  containerRef: React.RefObject<HTMLDivElement>,
  colWidths: Record<string, number> | undefined,
  rowHeights: Record<number, number> | undefined,
  onUpdateColWidth: (colLetter: string, width: number) => void,
  onUpdateRowHeight: (rowNum: number, height: number) => void
) => {
  const resizingColRef = useRef<{ colLetter: string; startX: number; startWidth: number } | null>(null);
  const resizingRowRef = useRef<{ rowNum: number; startY: number; startHeight: number } | null>(null);
  const guideColRef = useRef<HTMLDivElement | null>(null);
  const guideRowRef = useRef<HTMLDivElement | null>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const rafColId = useRef<number>(0);
  const rafRowId = useRef<number>(0);

  const onUpdateColWidthRef = useRef(onUpdateColWidth);
  const onUpdateRowHeightRef = useRef(onUpdateRowHeight);
  useEffect(() => { onUpdateColWidthRef.current = onUpdateColWidth; }, [onUpdateColWidth]);
  useEffect(() => { onUpdateRowHeightRef.current = onUpdateRowHeight; }, [onUpdateRowHeight]);

  const getZoom = (): number => {
    const el = document.documentElement;
    const rect = el.getBoundingClientRect();
    return el.offsetWidth ? (rect.width / el.offsetWidth) : 1;
  };

  useEffect(() => {
    const colEl = document.createElement("div");
    colEl.className = "resize-guide-line col-guide";
    colEl.style.display = "none";
    document.body.appendChild(colEl);
    guideColRef.current = colEl;

    const rowEl = document.createElement("div");
    rowEl.className = "resize-guide-line row-guide";
    rowEl.style.display = "none";
    document.body.appendChild(rowEl);
    guideRowRef.current = rowEl;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColRef.current && colEl && cachedRectRef.current) {
        const zoom = getZoom();
        const x = Math.max(cachedRectRef.current.left, Math.min(e.clientX, cachedRectRef.current.right)) / zoom;
        cancelAnimationFrame(rafColId.current);
        rafColId.current = requestAnimationFrame(() => { colEl.style.left = `${x}px`; });
      }
      if (resizingRowRef.current && rowEl && cachedRectRef.current) {
        const zoom = getZoom();
        const y = Math.max(cachedRectRef.current.top, Math.min(e.clientY, cachedRectRef.current.bottom)) / zoom;
        cancelAnimationFrame(rafRowId.current);
        rafRowId.current = requestAnimationFrame(() => { rowEl.style.top = `${y}px`; });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      cancelAnimationFrame(rafColId.current);
      cancelAnimationFrame(rafRowId.current);
      if (resizingColRef.current) {
        const dx = e.clientX - resizingColRef.current.startX;
        const newWidth = Math.max(30, resizingColRef.current.startWidth + dx);
        onUpdateColWidthRef.current(resizingColRef.current.colLetter, newWidth);
        resizingColRef.current = null;
        colEl.style.display = "none";
      }
      if (resizingRowRef.current) {
        const dy = e.clientY - resizingRowRef.current.startY;
        const newHeight = Math.max(15, resizingRowRef.current.startHeight + dy);
        onUpdateRowHeightRef.current(resizingRowRef.current.rowNum, newHeight);
        resizingRowRef.current = null;
        rowEl.style.display = "none";
      }
      cachedRectRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (document.body.contains(colEl)) document.body.removeChild(colEl);
      if (document.body.contains(rowEl)) document.body.removeChild(rowEl);
    };
  }, []);

  const startColResize = (e: React.MouseEvent, colLetter: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) cachedRectRef.current = containerRef.current.getBoundingClientRect();
    const startWidth = colWidths?.[colLetter] || 100;
    resizingColRef.current = { colLetter, startX: e.clientX, startWidth };
    const colEl = guideColRef.current;
    if (colEl && cachedRectRef.current) {
      const zoom = getZoom();
      colEl.style.left = `${e.clientX / zoom}px`;
      colEl.style.top = `${cachedRectRef.current.top / zoom}px`;
      colEl.style.height = `${cachedRectRef.current.height / zoom}px`;
      colEl.style.display = "block";
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const startRowResize = (e: React.MouseEvent, rowNum: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) cachedRectRef.current = containerRef.current.getBoundingClientRect();
    const startHeight = rowHeights?.[rowNum] || 25;
    resizingRowRef.current = { rowNum, startY: e.clientY, startHeight };
    const rowEl = guideRowRef.current;
    if (rowEl && cachedRectRef.current) {
      const zoom = getZoom();
      rowEl.style.top = `${e.clientY / zoom}px`;
      rowEl.style.left = `${cachedRectRef.current.left / zoom}px`;
      rowEl.style.width = `${cachedRectRef.current.width / zoom}px`;
      rowEl.style.display = "block";
    }
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  return {
    startColResize,
    startRowResize
  };
};
