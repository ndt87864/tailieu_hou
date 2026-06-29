// Shared helpers for StudentInfor pages

declare global {
  interface Window {
    XLSX: any;
  }
}

export const ensureXLSX = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined")
      return reject(new Error("Browser environment required"));
    if (window.XLSX) return resolve(window.XLSX);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("XLSX failed to load"));
    };
    script.onerror = () => reject(new Error("Failed to load XLSX library"));
    document.head.appendChild(script);
  });
};

export const normalizeHeader = (s: any = ""): string => {
  if (!s && s !== 0) return "";
  try {
    let str = String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

    // Specially handle Vietnamese 'đ' / 'Đ'
    str = str.replace(/[đĐ]/g, "d");

    // Lowercase and remove all non-alphanumeric characters
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  } catch (e) {
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }
};

export const mapHeaderToKey = (h: string): string | null => {
  const n = normalizeHeader(h);
  if (!n) return null;
  if (n === "stt") return null;
  if (/(masv|mssv|msv|sbd|sobadanh|sobd|sobaodanh|sinhvien|mssinhvien)/.test(n))
    return "studentId";
  if (
    n === "hoten" ||
    n === "hovaten" ||
    n === "hotenvaten" ||
    n === "fullname"
  )
    return "fullName";
  if (
    n.includes("tentaikhoan") ||
    n.includes("taikhoan") ||
    n === "username" ||
    n === "account"
  )
    return "username";
  if (
    n === "ho" ||
    n === "hodem" ||
    n === "holot" ||
    n === "hovadem" ||
    n === "hodemvalot" ||
    n === "lastname"
  )
    return "lastName";
  if (n === "ten" || n === "firstname") return "firstName";
  if (n.includes("tenmon") || n.includes("mon") || n.includes("monhoc"))
    return "subject";
  if (n.includes("ngaythi") || (n.includes("ngay") && n.includes("thi")))
    return "examDate";
  if (n.includes("cathi") || (n.includes("ca") && n.includes("thi")))
    return "examSession";
  if (n === "thi" || n === "ca") return "examSession";
  if (n.includes("thoigian") || n.includes("thoi") || n.includes("gian"))
    return "examTime";
  if (n.includes("link") && n.includes("phong")) return "examLink";
  if (n.includes("tennhomzalo") || (n.includes("ten") && n.includes("nhom") && n.includes("zalo")))
    return "zaloGroupName";
  if (n.includes("phong")) return "examRoom";
  if (n.includes("khoa")) return "course";
  if (n.includes("manganh") || (n.includes("ma") && n.includes("nganh")))
    return "majorCode";
  if (n.includes("hinhthuc") || n.includes("hinh")) return "examType";
  if (
    n.includes("dieuken") ||
    n.includes("dieu") ||
    n.includes("ken") ||
    n.includes("status") ||
    n.includes("trangthai") ||
    n.includes("ghichu")
  )
    return "status";
  if (n.includes("link")) return "examLink";
  if (n.includes("ngaysinh") || n.includes("dob") || n.includes("date"))
    return "dob";
  return null;
};

export const normalizeForSearch = (s: string = ""): string => {
  try {
    let str = String(s || "");
    str = str.normalize("NFKC");
    str = str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    str = str.replace(/[\u2012\u2013\u2014\u2212\u2010\u2011]/g, "-");
    str = str.replace(/\s*:\s*/g, "h");
    str = str.replace(/\s+/g, " ").trim();
    str = str.replace(/\s*-\s*/g, "-").replace(/\s+/g, "");
    return str.toLowerCase();
  } catch (e) {
    return String(s).toLowerCase();
  }
};

export const normalizeExamTime = (val: any): string => {
  if (val === undefined || val === null) return "";
  try {
    let s = String(val || "");
    s = s.normalize("NFKC");
    s = s.replace(/[\u2012\u2013\u2014\u2212\u2010\u2011]/g, "-");
    s = s.replace(/\s*:\s*/g, "h");
    s = s.replace(/\s*-\s*/g, "-");
    s = s.replace(/\s+/g, "");
    s = s.replace(/\b0+(\d)h/gi, "$1h");
    s = s.toLowerCase();
    return s;
  } catch (e) {
    return String(val || "").trim();
  }
};

export const formatDate = (value: any): string => {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    }
  } catch (e) {}
  return value;
};

export const formatDateTime = (value: any): string => {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  } catch (e) {}
  return value;
};

export const isValidUrl = (value: any): boolean => {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (e) {
    return false;
  }
};

export const parseDateToYMD = (v: any): string => {
  if (!v && v !== 0) return "";
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch (e) {
    return "";
  }
};

export const excelSerialToDate = (serial: any, options: any = {}): Date | null => {
  if (serial === null || serial === undefined) return null;
  const s = Number(serial);
  if (isNaN(s)) return null;
  const use1904 = Boolean(options && options.date1904);
  const offset = use1904 ? 24107 : 25569;
  const ms = Math.round((s - offset) * 86400 * 1000);
  return new Date(ms);
};

export const parseExcelDateToYMD = (v: any, options: any = {}): string => {
  if (v === null || v === undefined || v === "") return "";
  try {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (v instanceof Date) {
      return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(
        v.getUTCDate(),
      )}`;
    }

    if (typeof v === "number") {
      const d = excelSerialToDate(v, options);
      if (!d) return "";
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
        d.getUTCDate(),
      )}`;
    }
    if (typeof v === "string") {
      const s = v.trim().replace(/\u00A0/g, " ");
      const dmMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dmMatch) {
        let dd = Number(dmMatch[1]);
        let mm = Number(dmMatch[2]);
        let yy = Number(dmMatch[3]);
        if (yy < 100) yy += 2000;
        const dt = new Date(Date.UTC(yy, mm - 1, dd));
        if (!isNaN(dt.getTime())) {
          return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
        }
      }

      const iso = new Date(s);
      if (!isNaN(iso.getTime())) return parseDateToYMD(iso);
      return "";
    }
    return parseDateToYMD(v);
  } catch (e) {
    return "";
  }
};

export const parseCSV = (text: string): any[] => {
  if (!text && text !== "") return [];
  const s = String(text).replace(/^\uFEFF/, "");
  const rows: any[][] = [];

  let cur = "";
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;
  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];
    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\r") {
        // ignore
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else {
        cur += ch;
      }
    }
    i += 1;
  }
  if (cur !== "" || inQuotes || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => (h == null ? "" : String(h).trim()));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const arr = rows[r];
    if (arr.length === 1 && arr[0] === "") continue;
    const obj: any = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col${c}`;
      obj[key] = c < arr.length && arr[c] != null ? String(arr[c]) : "";
    }
    out.push(obj);
  }
  return out;
};

export const computePendingLinkUpdates = (records: any[]): any[] => {
  const groups: any = {};
  for (const r of records) {
    const dateYMD = parseDateToYMD(r.examDate || "");
    const key = [
      dateYMD,
      (r.subject || "").trim(),
      (r.examSession || "").trim(),
      (r.examTime || "").trim(),
      (r.examRoom || "").trim(),
      (r.examType || "").trim(),
    ]
      .map((s) => String(s || "").toLowerCase())
      .join("||");
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const updates: any[] = [];
  Object.values(groups).forEach((group: any) => {
    const provider = group.find((x: any) => x.examLink && String(x.examLink).trim());
    if (!provider) return;
    const link = String(provider.examLink).trim();
    group.forEach((rec: any) => {
      if (!rec.examLink || String(rec.examLink).trim() === "") {
        updates.push({ id: rec.id, examLink: link });
      }
    });
  });

  return updates;
};

export const getStatusLabel = (status: string): string => {
  if (!status) return "-";
  if (status === "unverified") return "Không xác định";
  return status;
};

export const getStatusColor = (status: string, isDarkMode: boolean = false): string => {
  if (!status) return "";
  switch (status) {
    case "Đủ điều kiện":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "Thiếu điều kiện":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "Cấm thi":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "Thi lại":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "Thi cải thiện":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    default:
      return isDarkMode
        ? "bg-gray-700 text-gray-300"
        : "bg-gray-100 text-gray-800";
  }
};
