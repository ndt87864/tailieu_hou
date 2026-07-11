import React from "react";

interface ExamScheduleResultsProps {
  results: any[];
  studentData: any;
  isDarkMode: boolean;
  registrationStatus: string | null;
  isAllRented: boolean;
  eligibleSubjects: any[];
  startProxyRegistration: () => void;
  getConditionInfo: (status: string) => { key: string; label: string };
}

export const ExamScheduleResults: React.FC<ExamScheduleResultsProps> = ({
  results,
  studentData,
  isDarkMode,
  registrationStatus,
  isAllRented,
  eligibleSubjects,
  startProxyRegistration,
  getConditionInfo,
}) => {
  return (
    <div className="space-y-6 animate-slide-up-fade" style={{ animationDelay: "0.2s" }}>
      {/* Student Info Card */}
      <div className="lt-info-card hidden md:block">
        <div className="lt-info-grid">
          <div className="lt-info-profile-pane">
            <p className="lt-info-kicker text-orange-500">Hồ sơ sinh viên</p>
            <h2 className={`text-2xl md:text-3xl font-extrabold ${isDarkMode ? "text-white" : "text-slate-800"} mb-2`}>
              {studentData.fullName}
            </h2>
            <p className={`text-sm md:text-base font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              {Array.isArray(studentData.major)
                ? `Mã ngành: ${studentData.major.join(", ")}`
                : `Mã ngành: ${studentData.major || "-"}`}
            </p>

            {registrationStatus && (
              <div className="mt-2 flex">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500`}>
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
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-tighter bg-green-500/10 text-green-500`}>
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
  );
};
