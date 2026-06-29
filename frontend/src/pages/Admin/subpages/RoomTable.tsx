import React from "react";
import { formatDate } from "../../../utils/studentInforHelpers.js";

interface Room {
  id: string;
  examDate: string;
  subject: string;
  examSession: string;
  examTime: string;
  examRoom: string;
  examLink: string;
  examType: string;
  majorCode: string;
}

interface RoomTableProps {
  loading: boolean;
  roomsCount: number;
  filteredRooms: Room[];
  visibleRooms: Room[];
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  openEdit: (r: Room) => void;
  handleDeleteRoom: (r: Room) => void;
  groupByLink: boolean;
  isSaving: boolean;
}

const RoomTable: React.FC<RoomTableProps> = ({
  loading,
  roomsCount,
  filteredRooms,
  visibleRooms,
  selectedIds,
  toggleSelect,
  selectAllVisible,
  clearSelection,
  openEdit,
  handleDeleteRoom,
  groupByLink,
  isSaving,
}) => {
  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="card overflow-hidden p-1 md:p-0">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-xs text-[var(--fg-2)]">Tổng: <strong>{roomsCount}</strong> phòng thi</div>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block">
          <table className="table-themed">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={(filteredRooms || []).length > 0 && selectedIds.length === (filteredRooms || []).length}
                    onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th>Ngày thi</th>
                <th>Tên môn học</th>
                <th>Mã ngành</th>
                <th>Ca thi</th>
                <th>Thời gian</th>
                <th>Phòng</th>
                <th>Link phòng</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {visibleRooms.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-[var(--fg-2)]">Không có dữ liệu</td>
                </tr>
              ) : groupByLink ? (
                (() => {
                  const groups = new Map<string, Room[]>();
                  const normalizeLink = (s: any) => (s || "").toString().trim();
                  (filteredRooms || []).forEach((r) => {
                    const key = normalizeLink(r.examLink) || "(no-link)";
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(r);
                  });

                  const rows: React.ReactNode[] = [];
                  let rowIndex = 0;
                  groups.forEach((members, link) => {
                    rows.push(
                      <tr key={`group-${link}`} className="bg-[var(--bg-2)]">
                        <td colSpan={9} className="px-4 py-2 text-xs font-semibold text-[var(--fg)] border-y border-[var(--border)]">
                          Link: {link === "(no-link)" ? <span className="text-muted">(không có link)</span> : <a href={link} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">{link}</a>} — Số phòng: {members.length}
                        </td>
                      </tr>
                    );

                    members.forEach((r) => {
                      rows.push(
                        <tr key={r.id} className="hover:bg-[var(--bg-2)]/50">
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(r.id)} 
                              onChange={() => toggleSelect(r.id)} 
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                          </td>
                          <td>{r.examDate ? formatDate(r.examDate) : <span className="text-muted">chưa cập nhật</span>}</td>
                          <td className="font-semibold">{r.subject || "-"}</td>
                          <td>{r.majorCode || "-"}</td>
                          <td>{r.examSession || "-"}</td>
                          <td>{r.examTime || "-"}</td>
                          <td>{r.examRoom || "-"}</td>
                          <td className="max-w-[200px] truncate text-xs">
                            {r.examLink ? (
                              <a href={r.examLink} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">{r.examLink}</a>
                            ) : (
                              <span className="text-muted">(không)</span>
                            )}
                          </td>
                          <td className="text-right space-x-2">
                            <button onClick={() => openEdit(r)} className="btn-action hover:text-blue-500 inline-flex items-center p-1 rounded hover:bg-blue-500/10">Sửa</button>
                            <button onClick={() => handleDeleteRoom(r)} disabled={isSaving} className="btn-action hover:text-red-500 inline-flex items-center p-1 rounded hover:bg-red-500/10">Xóa</button>
                          </td>
                        </tr>
                      );
                      rowIndex++;
                    });
                  });
                  return rows;
                })()
              ) : (
                filteredRooms.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--bg-2)]/50">
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(r.id)} 
                        onChange={() => toggleSelect(r.id)} 
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td>{r.examDate ? formatDate(r.examDate) : <span className="text-muted">chưa cập nhật</span>}</td>
                    <td className="font-semibold">{r.subject || "-"}</td>
                    <td>{r.majorCode || "-"}</td>
                    <td>{r.examSession || "-"}</td>
                    <td>{r.examTime || "-"}</td>
                    <td>{r.examRoom || "-"}</td>
                    <td className="max-w-[200px] truncate text-xs">
                      {r.examLink ? (
                        <a href={r.examLink} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">{r.examLink}</a>
                      ) : (
                        <span className="text-muted">(không)</span>
                      )}
                    </td>
                    <td className="text-right space-x-2">
                      <button onClick={() => openEdit(r)} className="btn-action hover:text-blue-500 inline-flex items-center p-1 rounded hover:bg-blue-500/10">Sửa</button>
                      <button onClick={() => handleDeleteRoom(r)} disabled={isSaving} className="btn-action hover:text-red-500 inline-flex items-center p-1 rounded hover:bg-red-500/10">Xóa</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="grid grid-cols-1 gap-3 md:hidden p-2">
          {visibleRooms.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--fg-2)]">Không có dữ liệu</div>
          ) : (
            visibleRooms.map((r) => (
              <div key={r.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(r.id)} 
                      onChange={() => toggleSelect(r.id)} 
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer w-4 h-4 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{r.subject || "-"}</div>
                      {r.majorCode && (
                        <div className="text-[10px] text-[var(--muted)]">
                          Ngành: {r.majorCode}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="admin-mobile-card-body">
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Ngày thi:</span>
                    <span className="admin-mobile-card-value">
                      {r.examDate ? formatDate(r.examDate) : "chưa cập nhật"}
                    </span>
                  </div>
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Ca thi:</span>
                    <span className="admin-mobile-card-value">{r.examSession || "-"}</span>
                  </div>
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Thời gian:</span>
                    <span className="admin-mobile-card-value font-semibold">{r.examTime || "-"}</span>
                  </div>
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Phòng thi:</span>
                    <span className="admin-mobile-card-value">{r.examRoom || "-"}</span>
                  </div>
                  {r.examLink && (
                    <div className="admin-mobile-card-row pt-1 border-t border-[var(--border)] border-dashed">
                      <span className="admin-mobile-card-label">Link:</span>
                      <a
                        href={r.examLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-500 hover:underline max-w-[70%] truncate block font-medium"
                      >
                        {r.examLink}
                      </a>
                    </div>
                  )}
                </div>

                <div className="admin-mobile-card-footer">
                  <button 
                    onClick={() => openEdit(r)} 
                    className="px-3 py-1.5 bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--bg-2)] transition-colors"
                  >
                    Sửa
                  </button>
                  <button 
                    onClick={() => handleDeleteRoom(r)} 
                    disabled={isSaving} 
                    className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors ml-auto"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomTable;
