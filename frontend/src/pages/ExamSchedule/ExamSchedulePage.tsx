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
import { exportToExcel, exportToPDF } from "../../utils/examExportHelper.js";
import ProxyRegistrationModal from "../../components/exam-schedule/ProxyRegistrationModal.js";
import { ExamScheduleResults } from "../../components/exam-schedule/ExamScheduleResults.js";
import "../../css/examschedule.css";

const THEME_MAP: Record<string, { primary: string; dark: string; light: string }> = {
  blue: { primary: "#2563eb", dark: "#1e40af", light: "#93c5fd" },
  lime: { primary: "#118d05", dark: "#0a6b04", light: "#15a80a" },
  red: { primary: "#e11d48", dark: "#9f1239", light: "#fda4af" },
  orange: { primary: "#ea580c", dark: "#9a3412", light: "#fdba74" },
  yellow: { primary: "#ca8a04", dark: "#854d0e", light: "#fde047" },
  mint: { primary: "#059669", dark: "#065f46", light: "#6ee7b7" },
  charcoal: { primary: "#475569", dark: "#1e293b", light: "#cbd5e1" },
  purple: { primary: "#9333ea", dark: "#6b21a8", light: "#d8b4fe" },
  // Giữ green để dự phòng/tương thích
  green: { primary: "#16a34a", dark: "#166534", light: "#86efac" },
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
        } else {
          // Check if there is a pending registration in queue
          const { data: queueData, error: queueError } = await supabase
            .from("registration_queue")
            .select("selected_ids, bill_url, status")
            .eq("student_id", first.studentId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!queueError && queueData) {
            const ids = queueData.selected_ids ? queueData.selected_ids.split(",") : [];
            setRentedIds(ids);
            setRentedBillUrls(queueData.bill_url || "");
            setRegistrationStatus("pending");
          }
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
          className={`w-full px-4 mx-auto animate-slide-up-fade transition-all duration-300 ${
            isSearched && studentData ? "max-w-7xl" : "max-w-4xl"
          }`}
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
                      placeholder="Nhập mã sinh viên/tài khoản học"
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

          {isSearched && studentData && (
            <ExamScheduleResults
              results={results}
              studentData={studentData}
              isDarkMode={isDarkMode}
              registrationStatus={registrationStatus}
              isAllRented={isAllRented}
              eligibleSubjects={eligibleSubjects}
              startProxyRegistration={startProxyRegistration}
              getConditionInfo={getConditionInfo}
            />
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
