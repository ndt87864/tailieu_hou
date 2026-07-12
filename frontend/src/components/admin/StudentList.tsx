import React from "react";
import { Edit2, Trash2, ExternalLink } from "lucide-react";

interface Student {
  id: string;
  studentId: string;
  fullName: string;
  username: string;
  majorCode: string;
  course: string;
  subject: string;
  examDate: string | null;
  examSession: string;
  examTime: string;
  examRoom: string;
  examType: string;
  examLink: string;
  status: string;
}

interface StudentListProps {
  students: Student[];
  selectedStudentIds: string[];
  toggleSelectStudent: (id: string) => void;
  toggleSelectAll: () => void;
  allSelectedOnPage: boolean;
  handleEditClick: (std: Student) => void;
  handleDelete: (id: string) => void;
  formatDate: (dateStr: string) => string;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  selectedStudentIds,
  toggleSelectStudent,
  toggleSelectAll,
  allSelectedOnPage,
  handleEditClick,
  handleDelete,
  formatDate,
}) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <table className="table-themed">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelectedOnPage}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
              </th>
              <th>Sinh viên</th>
              <th>Môn thi</th>
              <th>Thời gian thi</th>
              <th>Phòng / Ca</th>
              <th className="text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  Không tìm thấy lịch thi nào.
                </td>
              </tr>
            ) : (
              students.map((std) => (
                <tr key={std.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(std.id)}
                      onChange={() => toggleSelectStudent(std.id)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                  <td>
                    <div className="font-semibold text-sm">{std.fullName}</div>
                    <div className="text-xs text-[var(--fg-2)]">
                      MSV: {std.studentId} | Khóa: {std.course}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm font-medium">{std.subject}</div>
                    {std.majorCode && (
                      <div className="text-xs text-[var(--fg-2)]">Ngành: {std.majorCode}</div>
                    )}
                  </td>
                  <td>
                    <div className="text-sm">{std.examDate ? formatDate(std.examDate) : "—"}</div>
                    <div className="text-xs text-[var(--fg-2)]">{std.examTime}</div>
                  </td>
                  <td>
                    <div className="text-sm">Phòng: {std.examRoom} | Ca: {std.examSession}</div>
                    {std.examLink && (
                      <a
                        href={std.examLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-500 hover:underline block max-w-[200px] truncate"
                      >
                        {std.examLink}
                      </a>
                    )}
                  </td>
                  <td className="text-right space-x-2">
                    <button
                      onClick={() => handleEditClick(std)}
                      className="btn-action hover:text-[var(--brand-600)] inline-flex items-center p-1 rounded hover:bg-[var(--brand-600)]/10"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(std.id)}
                      className="btn-action hover:text-red-500 inline-flex items-center p-1 rounded hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {students.length === 0 ? (
          <div className="card p-6 text-center text-sm text-[var(--fg-2)]">
            Không tìm thấy lịch thi nào.
          </div>
        ) : (
          students.map((std) => (
            <div key={std.id} className="admin-mobile-card">
              <div className="admin-mobile-card-header">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(std.id)}
                    onChange={() => toggleSelectStudent(std.id)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{std.fullName}</div>
                    <div className="text-[10px] text-[var(--muted)]">
                      MSV: {std.studentId} • Khóa: {std.course}
                    </div>
                  </div>
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold ${
                  std.status === "Đủ điều kiện"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-red-500/10 text-red-600"
                }`}>
                  {std.status}
                </span>
              </div>

              <div className="admin-mobile-card-body">
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Môn thi:</span>
                  <span className="admin-mobile-card-value">{std.subject}</span>
                </div>
                {std.majorCode && (
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Mã ngành:</span>
                    <span className="admin-mobile-card-value">{std.majorCode}</span>
                  </div>
                )}
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Ngày thi:</span>
                  <span className="admin-mobile-card-value">
                    {std.examDate ? formatDate(std.examDate) : "—"}
                  </span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Giờ / Ca:</span>
                  <span className="admin-mobile-card-value">
                    {std.examTime} (Ca: {std.examSession})
                  </span>
                </div>
                <div className="admin-mobile-card-row">
                  <span className="admin-mobile-card-label">Phòng thi:</span>
                  <span className="admin-mobile-card-value">{std.examRoom}</span>
                </div>
                {std.examLink && (
                  <div className="admin-mobile-card-row pt-1">
                    <span className="admin-mobile-card-label">Link thi:</span>
                    <a
                      href={std.examLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-500 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Vào phòng thi <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="admin-mobile-card-footer">
                <button
                  onClick={() => handleEditClick(std)}
                  className="px-3 py-1.5 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--bg-2)] transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa
                </button>
                <button
                  onClick={() => handleDelete(std.id)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default StudentList;
