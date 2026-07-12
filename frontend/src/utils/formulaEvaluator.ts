// frontend/src/utils/formulaEvaluator.ts

type CellData = {
  value: string;
  formula: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
};

type CellsMap = Record<string, CellData>;

// Chuyển địa chỉ ô như A1 -> { colIndex: 0, rowIndex: 0 }
export function parseCellAddress(address: string): { col: string; row: number } | null {
  const match = address.match(/^([A-Z]+)([0-9]+)$/i);
  if (!match) return null;
  return {
    col: match[1].toUpperCase(),
    row: parseInt(match[2], 10),
  };
}

// Chuyển tên cột dạng chữ (A, B, C...) thành chỉ số index (0, 1, 2...)
export function colLetterToNumber(letter: string): number {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num - 1;
}

// Chuyển chỉ số index (0, 1, 2...) thành tên cột dạng chữ (A, B, C...)
export function numberToColLetter(num: number): string {
  let letter = "";
  let temp = num;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Lấy danh sách địa chỉ ô trong một vùng chọn ví dụ: A1:B3 -> A1, A2, A3, B1, B2, B3
export function getCellRange(rangeStr: string): string[] {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return [rangeStr];

  const start = parseCellAddress(parts[0]);
  const end = parseCellAddress(parts[1]);
  if (!start || !end) return [];

  const startColIdx = colLetterToNumber(start.col);
  const endColIdx = colLetterToNumber(end.col);
  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);

  const minCol = Math.min(startColIdx, endColIdx);
  const maxCol = Math.max(startColIdx, endColIdx);

  const addresses: string[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    const colLetter = numberToColLetter(c);
    for (let r = startRow; r <= endRow; r++) {
      addresses.push(`${colLetter}${r}`);
    }
  }
  return addresses;
}

// Đánh giá giá trị của một ô cụ thể
export function evaluateFormula(formula: string, cells: CellsMap, visited: Set<string> = new Set()): string {
  if (!formula.startsWith("=")) {
    return formula;
  }

  // Loại bỏ dấu "=" và khoảng trắng
  const expression = formula.slice(1).trim();

  // Kiểm tra lỗi vòng lặp
  // Để tránh đệ quy vô hạn khi các ô tham chiếu chéo nhau.

  try {
    // 1. Phân tích các hàm toán học: SUM, AVERAGE, MIN, MAX, COUNT
    const functionRegex = /^(SUM|AVERAGE|MIN|MAX|COUNT)\(([^)]+)\)$/i;
    const funcMatch = expression.match(functionRegex);

    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const rangeArg = funcMatch[2].trim();
      const targetCells = rangeArg.includes(":") ? getCellRange(rangeArg) : [rangeArg];

      const values = targetCells.map((addr) => {
        if (visited.has(addr)) return 0; // Tránh vòng lặp
        const cell = cells[addr];
        if (!cell) return 0;
        
        const nextVisited = new Set(visited).add(addr);
        const evaluatedVal = evaluateFormula(cell.formula || cell.value, cells, nextVisited);
        const num = parseFloat(evaluatedVal);
        return isNaN(num) ? 0 : num;
      });

      switch (funcName) {
        case "SUM":
          return values.reduce((sum, v) => sum + v, 0).toString();
        case "AVERAGE":
          return values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : "0";
        case "MIN":
          return values.length ? Math.min(...values).toString() : "0";
        case "MAX":
          return values.length ? Math.max(...values).toString() : "0";
        case "COUNT":
          return targetCells.filter((addr) => {
            const cell = cells[addr];
            if (!cell) return false;
            const evaluatedVal = evaluateFormula(cell.formula || cell.value, cells, new Set(visited).add(addr));
            return !isNaN(parseFloat(evaluatedVal)) && evaluatedVal.trim() !== "";
          }).length.toString();
        default:
          return "#ERROR!";
      }
    }

    // 2. Phép tính cơ bản (+, -, *, /) và các tham chiếu trực tiếp đến các ô đơn lẻ
    // Thay thế các mã ô (như A1, B5) bằng giá trị số của chúng
    let evaluatedExpr = expression;
    const cellRefRegex = /[A-Z]+[0-9]+/g;
    let match;
    const refs = new Set<string>();

    while ((match = cellRefRegex.exec(expression)) !== null) {
      refs.add(match[0]);
    }

    for (const ref of refs) {
      if (visited.has(ref)) {
        return "#CYCLE!";
      }
      const cell = cells[ref];
      let val = "0";
      if (cell) {
        const nextVisited = new Set(visited).add(ref);
        val = evaluateFormula(cell.formula || cell.value, cells, nextVisited);
      }
      const numVal = parseFloat(val);
      const replacement = isNaN(numVal) ? "0" : numVal.toString();
      // Thay thế chính xác tên ô bằng giá trị của nó
      evaluatedExpr = evaluatedExpr.replace(new RegExp(`\\b${ref}\\b`, "g"), replacement);
    }

    // Đánh giá biểu thức số học
    // An toàn hơn eval: Chỉ cho phép số, khoảng trắng và các ký tự toán học
    if (!/^[0-9.+\-*/() ]+$/.test(evaluatedExpr)) {
      return "#VALUE!";
    }

    // Sử dụng hàm Function để đánh giá chuỗi biểu thức toán học
    const result = new Function(`return (${evaluatedExpr})`)();
    return typeof result === "number" ? (Number.isInteger(result) ? result.toString() : result.toFixed(2)) : "#ERROR!";
  } catch (err) {
    console.error("Formula parsing error:", err);
    return "#ERROR!";
  }
}
