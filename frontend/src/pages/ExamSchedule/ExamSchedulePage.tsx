import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useUI } from "../../context/UIContext.js";
import { supabase } from "../../context/AuthContext.js";
import {
  searchStudentInfor,
  getStudentsBySessionsOptimized,
  getAllSubjectPrices,
} from "../../services/examScheduleService.js";
import { exportToExcel, exportToPDF } from "./examExportHelper.js";
import ProxyRegistrationModal from "./ProxyRegistrationModal.js";
import "../../css/examschedule.css";

const THEME_MAP: Record<string, { primary: string; dark: string; light: string }> = {
  green: { primary: "#118d05", dark: "#0a6b04", light: "#15a80a" },
  blue: { primary: "#0066cc", dark: "#0055aa", light: "#0d74e7" },
  red: { primary: "#cc0000", dark: "#990000", light: "#ff3333" },
  purple: { primary: "#6600cc", dark: "#440099", light: "#9933ff" },
  yellow: { primary: "#ccbb00", dark: "#998800", light: "#ffea00" },
  brown: { primary: "#996633", dark: "#663300", light: "#cc9966" },
  black: { primary: "#333333", dark: "#111111", light: "#666666" },
};

const ExamSchedulePage: React.FC = () => {
  const [localQuery, setLocalQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [studentData, setStudentData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSearched, setIsSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [subjectPriceMap, setSubjectPriceMap] = useState<Record<string, number>>({});
  const [rentedIds, setRentedIds] = useState<any[]>([]);
  const [rentedBillUrls, setRentedBillUrls] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);

  const { themeMode, primaryColor } = useUI();
  const isDarkMode =
    themeMode === "dark" ||
    (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const currentTheme = THEME_MAP[primaryColor] || THEME_MAP.green;

  const hexToRgb = (hex: string): string => {
    if (!hex || typeof hex !== "string") return "0, 0, 0";
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "0, 0, 0";
  };

  const themeVariables: React.CSSProperties = {
    // @ts-ignore
    "--theme-primary": currentTheme.primary,
    "--theme-primary-rgb": hexToRgb(currentTheme.primary),
    "--theme-dark": currentTheme.dark,
    "--theme-dark-rgb": hexToRgb(currentTheme.dark),
    "--theme-light": currentTheme.light,
    "--theme-light-rgb": hexToRgb(currentTheme.light),
  };

  const handleError = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const isZalo =
      searchParams.get("utm_source") === "zalo" &&
      searchParams.get("utm_medium") === "zalo" &&
      searchParams.get("utm_campaign") === "zalo";

    if (isZalo) {
      toast.error("Vui lòng truy cập bằng web ngoài zalo và thực hiện lại");
    } else {
      toast.error("Không kết nối được đến máy chủ");
    }
  };

  // Load subject prices map
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getAllSubjectPrices();
        if (!mounted) return;
        const map: Record<string, number> = {};
        (list || []).forEach((item: any) => {
          if (item && item.subject) {
            const normalized = item.subject.trim();
            map[normalized] = Number(item.price) || 0;
            map[item.subject] = Number(item.price) || 0;
          }
        });
        setSubjectPriceMap(map);
      } catch (e) {
        console.error("Failed to load subject prices", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getConditionInfo = (status: string) => {
    const raw = (status || "").toString().trim();
    const key = raw.toLowerCase();

    if (key === "eligible" || raw === "Đủ điều kiện") {
      return { key: "eligible", label: "Đủ điều kiện" };
    }
    if (
      key === "ineligible" ||
      raw === "Không đủ điều kiện" ||
      raw === "Thiếu điều kiện" ||
      raw === "Cấm thi"
    ) {
      return {
        key: "ineligible",
        label: raw === "Thiếu điều kiện" || raw === "Cấm thi" ? raw : "Không đủ điều kiện",
      };
    }
    if (raw === "Thi lại" || raw === "Thi cải thiện") {
      return { key: "unverified", label: raw };
    }
    return { key: "unverified", label: raw || "Không xác định" };
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const q = localQuery.trim();
    if (!q) {
      toast.info("Vui lòng nhập mã sinh viên hoặc tài khoản học");
      return;
    }

    setLoading(true);
    setRentedIds([]);
    setRentedBillUrls("");

    try {
      const data = await searchStudentInfor(q);

      if (data && data.length > 0) {
        setResults(data);
        const first = data[0];
        const matchedBy = first.__matchedBy || null;

        setStudentData({
          fullName: first.fullName,
          studentId: first.studentId,
          username: first.username,
          major: first.majorCode,
          course: first.course,
          totalExams: data.length,
          matchedBy,
        });

        // Fetch proxy registration data
        const { data: proxyData, error: proxyError } = await supabase
          .from("proxy_registrations")
          .select("selected_ids, bill_url, status")
          .eq("student_id", first.studentId)
          .maybeSingle();

        if (!proxyError && proxyData) {
          const ids = proxyData.selected_ids ? proxyData.selected_ids.split(",") : [];
          setRentedIds(ids);
          setRentedBillUrls(proxyData.bill_url || "");
          setRegistrationStatus(proxyData.status || "pending");
        }

        setIsSearched(true);
      } else {
        setResults([]);
        setStudentData(null);
        setIsSearched(false);
        toast.warn("Không tìm thấy thông tin lịch thi cho mã sinh viên này.");
      }
    } catch (err) {
      console.error("Search error:", err);
      handleError();
    } finally {
      setLoading(false);
    }
  };

  const startProxyRegistration = () => {
    setIsProxyModalOpen(true);
  };

  const handleExportAllSubjects = async (format: "excel" | "pdf") => {
    if (!results || results.length === 0) {
      toast.info("Không có dữ liệu lịch thi để tải.");
      return;
    }

    setLoading(true);
    try {
      toast.info("Đang truy vấn danh sách thí sinh từ server...");

      const sessions = results.map((row) => ({
        subject: row.subject,
        examDate: row.examDate,
        examSession: row.examSession,
        examRoom: row.examRoom,
        majorCode: Array.isArray(row.majorCode) ? row.majorCode.join(",") : row.majorCode,
      }));

      const allCombinedStudents = await getStudentsBySessionsOptimized(sessions);

      if (!allCombinedStudents || allCombinedStudents.length === 0) {
        toast.warn("Không tìm thấy danh sách thí sinh cho các môn này.");
        setLoading(false);
        return;
      }

      const uniqueStudents = Array.from(
        new Map(allCombinedStudents.map((s: any) => [s.id, s])).values()
      );

      const fileNameBase = `DSTS_TongHop_${studentData?.studentId}_${Date.now()}`;
      if (format === "excel") {
        exportToExcel(uniqueStudents, studentData, rentedIds, subjectPriceMap, uniqueStudents, `${fileNameBase}.xlsx`, true);
      } else {
        exportToPDF(uniqueStudents, studentData, rentedIds, currentTheme, uniqueStudents, `${fileNameBase}.pdf`, true);
      }
    } catch (error) {
      console.error("Export all subjects error:", error);
      handleError();
    } finally {
      setLoading(false);
    }
  };

  const eligibleSubjects = results.filter((row) => {
    const condition = getConditionInfo(row.status);
    const hasLink = row.examLink && row.examLink.trim() !== "";
    return (condition.key === "eligible" || condition.key === "unverified") && hasLink;
  });
  const availableToRent = eligibleSubjects.filter((sub) => !rentedIds.includes(sub.id));
  const isAllRented = eligibleSubjects.length > 0 && availableToRent.length === 0;

  const BrandIcon = () => (
    <div className="lt-glass-icon w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:rotate-12 duration-300">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center px-0 pt-8 md:pt-16 pb-0 transition-colors duration-500 lt-container ${
        isDarkMode ? "dark-mode" : "light-mode"
      }`}
      style={themeVariables}
    >
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar style={{ zIndex: 10000 }} />

      {/* Main Content */}
      <div className="flex-1 w-full flex flex-col">
        <div
          className="w-full max-w-7xl px-4 mx-auto animate-slide-up-fade"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="lt-glass-panel w-full p-6 md:p-10 mb-8">
            <div className="flex flex-col gap-8 items-center justify-center text-center w-full">
              <div className="flex flex-col items-center gap-4">
                <BrandIcon />
                <div>
                  <h1
                    className={`text-3xl md:text-4xl font-extrabold tracking-tight ${
                      isDarkMode ? "text-white" : "text-slate-800"
                    } mb-2`}
                  >
                    TRA CỨU LỊCH THI
                  </h1>
                  <p className={`${isDarkMode ? "text-slate-400" : "text-slate-500"} font-medium max-w-md mx-auto`}>
                    Hệ thống tra cứu lịch thi sinh viên trực tuyến nhanh chóng & chính xác.
                  </p>
                </div>
              </div>

              {/* Search Component */}
              <div className="w-full max-w-2xl">
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={localQuery}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      onChange={(e) => setLocalQuery(e.target.value)}
                      placeholder="Nhập mã sinh viên hoặc tài khoản học..."
                      className={`lt-input w-full px-6 py-4 outline-none font-semibold text-base ${
                        isFocused ? "focused" : ""
                      }`}
                    />
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="lt-search-btn w-full py-4 font-bold text-base flex justify-center items-center gap-2"
                  >
                    Tra Cứu
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Not Found Alert */}
          {isSearched && studentData === null && (
            <div className="lt-not-found-box p-6 mb-8 text-center animate-slide-up-fade" style={{ animationDelay: "0.2s" }}>
              <p className="font-semibold text-red-600 dark:text-red-400">
                Không tìm thấy kết quả phù hợp cho mã sinh viên này.
              </p>
            </div>
          )}

          {/* Results Area */}
          {isSearched && studentData && (
            <div className="space-y-6 animate-slide-up-fade" style={{ animationDelay: "0.2s" }}>
              {/* Student Info Card */}
              <div className="lt-info-card hidden md:block">
                <div className="lt-info-grid">
                  <div className="lt-info-profile-pane">
                    <p className="lt-info-kicker text-orange-500">Hồ sơ sinh viên</p>
                    <h2
                      className={`text-2xl md:text-3xl font-extrabold ${isDarkMode ? "text-white" : "text-slate-800"} mb-2`}
                    >
                      {studentData.fullName}
                    </h2>
                    <p className={`text-sm md:text-base font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {Array.isArray(studentData.major)
                        ? `Mã ngành: ${studentData.major.join(", ")}`
                        : `Mã ngành: ${studentData.major || "-"}`}
                    </p>

                    {registrationStatus && (
                      <div className="mt-2 flex">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            registrationStatus === "approved"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}
                        >
                          Đăng ký: {registrationStatus === "approved" ? "Đã duyệt" : "Đang chờ duyệt"}
                        </span>
                      </div>
                    )}

                    <div className="lt-info-meta-grid">
                      <div className="lt-info-meta-item">
                        <div className="lt-info-meta-label">Mã sinh viên</div>
                        <div className={`lt-info-meta-value ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                          {studentData.studentId || "-"}
                        </div>
                      </div>
                      <div className="lt-info-meta-item">
                        <div className="lt-info-meta-label">Tài khoản học</div>
                        <div className={`lt-info-meta-value ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                          {studentData.username || "-"}
                        </div>
                      </div>
                      <div className="lt-info-meta-item">
                        <div className="lt-info-meta-label">Khóa</div>
                        <div className={`lt-info-meta-value ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                          {studentData.course || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      {isAllRented ? (
                        <button
                          onClick={startProxyRegistration}
                          className="lt-search-btn px-8 py-3.5 font-bold uppercase tracking-widest flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Kiểm tra môn đã đăng kí
                        </button>
                      ) : eligibleSubjects.length > 0 ? (
                        <button
                          onClick={startProxyRegistration}
                          className="lt-search-btn px-8 py-3.5 font-bold uppercase tracking-widest flex items-center gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Đăng kí giải đề
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex items-center gap-3 text-slate-500">
                          <span className="font-bold uppercase tracking-widest text-sm">Chưa có môn nào có link phòng thi</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lt-info-stat-pane">
                    <div className="lt-info-stat-head">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className={`lt-info-stat-number ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      {String(studentData.totalExams).padStart(2, "0")}
                    </div>
                    <div className="lt-info-stat-label">Môn cần thi</div>
                    <div className="lt-info-stat-desc">Lịch thi đã công bố</div>
                  </div>
                </div>

                {studentData.matchedBy && (
                  <p className={`lt-info-footnote ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Kết quả được khớp theo: {studentData.matchedBy === "studentId" ? "Mã sinh viên" : "Tài khoản học"}
                  </p>
                )}
              </div>

              {/* Timetable glass table (Desktop) */}
              <div className="lt-table-container hidden md:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="lt-table-header px-6 py-4 w-16 text-center">#</th>
                      <th className="lt-table-header px-6 py-4 w-64 text-center">Môn Thi</th>
                      <th className="lt-table-header px-6 py-4 text-center min-w-[120px]">Mã ngành</th>
                      <th className="lt-table-header px-6 py-4 text-center">Ngày Thi</th>
                      <th className="lt-table-header px-6 py-4 text-center">Ca Thi</th>
                      <th className="lt-table-header px-6 py-4 text-center">Hình thức thi</th>
                      <th className="lt-table-header px-6 py-4 text-center">Giờ Thi</th>
                      <th className="lt-table-header px-6 py-4 text-center">Phòng</th>
                      <th className="lt-table-header px-6 py-4 text-center">Điều kiện thi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => {
                      const condition = getConditionInfo(row.status);
                      return (
                        <tr key={idx} className="lt-table-row">
                          <td className={`px-6 py-5 font-bold text-center ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                            {idx + 1}
                          </td>
                          <td className={`px-6 py-5 font-bold text-center ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                            {row.subject}
                          </td>
                          <td className={`px-6 py-5 font-medium text-center ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {Array.isArray(row.majorCode) ? row.majorCode.join(", ") : row.majorCode || "-"}
                          </td>
                          <td className={`px-6 py-5 font-semibold text-center ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {row.examDate ? new Date(row.examDate).toLocaleDateString("vi-VN") : "-"}
                          </td>
                          <td className={`px-6 py-5 font-medium text-center ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                            {row.examSession}
                          </td>
                          <td className={`px-6 py-5 font-semibold text-center ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                            {row.examType || row.examForm || "Onsite"}
                          </td>
                          <td className={`px-6 py-5 font-mono font-bold text-center ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                            {row.examTime}
                          </td>
                          <td className={`px-6 py-5 font-bold text-center ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                            {row.examRoom}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`lt-condition-pill lt-condition-${condition.key}`}>
                              {condition.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {results.length > 0 && eligibleSubjects.length > 0 && (
                <div className="hidden md:flex mt-8 justify-center">
                  <button
                    onClick={startProxyRegistration}
                    className="lt-search-btn px-10 py-4 font-bold uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95"
                  >
                    {isAllRented ? "Kiểm tra môn đã đăng kí" : "Đăng kí giải đề"}
                  </button>
                </div>
              )}

              {/* Mobile Cards */}
              <div className="md:hidden">
                <div className="lt-mobile-shell">
                  <div className="lt-mobile-shell-header">
                    <h3 className={`lt-mobile-shell-title ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      Lịch Thi
                    </h3>
                    <div className="lt-mobile-shell-total">
                      {String(studentData.totalExams).padStart(2, "0")}
                    </div>
                  </div>

                  <div className="lt-mobile-student-strip">
                    <div className="lt-mobile-avatar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9.988 9.988 0 0112 15c2.269 0 4.362.754 6.04 2.025M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold leading-tight ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                        {studentData.fullName}
                      </p>
                      <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                        Mã SV {studentData.studentId || "-"} • Khóa: {studentData.course || "-"}
                      </p>
                      {registrationStatus && (
                        <div className="mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-tighter ${
                              registrationStatus === "approved"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-yellow-500/10 text-yellow-500"
                            }`}
                          >
                            {registrationStatus === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                          </span>
                        </div>
                      )}
                    </div>
                    {isAllRented ? (
                      <button onClick={startProxyRegistration} className="lt-search-btn p-3 rounded-xl shadow-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    ) : eligibleSubjects.length > 0 ? (
                      <button onClick={startProxyRegistration} className="lt-search-btn p-3 rounded-xl shadow-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    {results.map((row, idx) => {
                      const condition = getConditionInfo(row.status);
                      return (
                        <div key={idx} className="lt-mobile-card lt-mobile-schedule-card">
                          <div className="lt-mobile-card-head">
                            <div className="min-w-0">
                              <p className="lt-mobile-subject-code">Môn #{idx + 1}</p>
                              <h3 className={`font-extrabold text-lg leading-tight ${isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
                                {row.subject}
                              </h3>
                              <p className={`lt-mobile-session ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                                Ca thi: {row.examSession || "Ca thi chưa cập nhật"}
                                {row.majorCode
                                  ? ` - Mã ngành: ${Array.isArray(row.majorCode) ? row.majorCode.join(", ") : row.majorCode}`
                                  : ""}
                              </p>
                            </div>
                            <span className={`lt-mobile-status-chip lt-condition-pill lt-condition-${condition.key}`}>
                              {condition.label}
                            </span>
                          </div>

                          <div className="lt-mobile-detail-grid">
                            <div className="lt-mobile-detail-item">
                              <div className="lt-mobile-detail-label">Ngày thi</div>
                              <div className={`lt-mobile-detail-value ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                                {row.examDate ? new Date(row.examDate).toLocaleDateString("vi-VN") : "-"}
                              </div>
                            </div>
                            <div className="lt-mobile-detail-item">
                              <div className="lt-mobile-detail-label">Giờ thi</div>
                              <div className={`lt-mobile-detail-value ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                                {row.examTime || "-"}
                              </div>
                            </div>
                            <div className="lt-mobile-detail-item">
                              <div className="lt-mobile-detail-label">Phòng</div>
                              <div className={`lt-mobile-detail-value ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                                {row.examRoom || "-"}
                              </div>
                            </div>
                            <div className="lt-mobile-detail-item">
                              <div className="lt-mobile-detail-label">Hình thức</div>
                              <div className={`lt-mobile-detail-value ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                                {row.examType || row.examForm || "Onsite"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {results.length > 0 && eligibleSubjects.length > 0 && (
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={startProxyRegistration}
                        className="lt-search-btn px-10 py-4 font-bold uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95"
                      >
                        {isAllRented ? "Kiểm tra môn đã đăng kí" : "Đăng kí giải đề"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="mb-16"></div>
      </div>
      {/* Floating Action Menu for downloads */}
      {isSearched && studentData && results.length > 0 && (
        <div className="lt-fab-group fixed bottom-8 right-8 z-50">
          <div className="relative">
            {isExportOpen && (
              <div className="lt-fab-popup animate-pop-up">
                <div className="lt-fab-pop-item-wrapper">
                  <span className="lt-fab-label">Lịch của tôi (Excel)</span>
                  <button
                    onClick={() => {
                      exportToExcel(results, studentData, rentedIds, subjectPriceMap);
                      setIsExportOpen(false);
                    }}
                    className="lt-fab-pop-item excel"
                    title="Xuất Excel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
                <div className="lt-fab-pop-item-wrapper">
                  <span className="lt-fab-label">Lịch của tôi (PDF)</span>
                  <button
                    onClick={() => {
                      exportToPDF(results, studentData, rentedIds, currentTheme);
                      setIsExportOpen(false);
                    }}
                    className="lt-fab-pop-item pdf"
                    title="Xuất PDF"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <div className="lt-fab-pop-item-wrapper">
                  <span className="lt-fab-label">Tải DSTS Toàn bộ (Excel)</span>
                  <button
                    onClick={() => {
                      handleExportAllSubjects("excel");
                      setIsExportOpen(false);
                    }}
                    className="lt-fab-pop-item excel"
                    title="Tải DSTS Excel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
                <div className="lt-fab-pop-item-wrapper">
                  <span className="lt-fab-label">Tải DSTS Toàn bộ (PDF)</span>
                  <button
                    onClick={() => {
                      handleExportAllSubjects("pdf");
                      setIsExportOpen(false);
                    }}
                    className="lt-fab-pop-item pdf"
                    title="Tải DSTS PDF"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className={`lt-fab-btn primary ${isExportOpen ? "active" : ""}`}
              title="Tải xuống"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Proxy Registration modal */}
      <ProxyRegistrationModal
        isOpen={isProxyModalOpen}
        onClose={() => setIsProxyModalOpen(false)}
        studentData={studentData}
        results={results}
        rentedIds={rentedIds}
        rentedBillUrls={rentedBillUrls}
        subjectPriceMap={subjectPriceMap}
        setRentedIds={setRentedIds}
        setRentedBillUrls={setRentedBillUrls}
        registrationStatus={registrationStatus}
        setRegistrationStatus={setRegistrationStatus}
        isDarkMode={isDarkMode}
        themeVariables={themeVariables}
      />
    </div>
  );
};

export default ExamSchedulePage;
