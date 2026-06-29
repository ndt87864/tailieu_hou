import React, { useEffect, useState, useMemo } from "react";
import { Search, Plus, Trash2, Edit2, Upload, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { useConfirm } from "../../../context/ConfirmContext.js";
import {
  getAllStudentInfor,
  normalizeString,
  normalizeExamTime,
  parseDateToYMD,
} from "../../../services/examScheduleService.js";

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

const emptyRoom = {
  examDate: "",
  subject: "",
  examSession: "",
  examTime: "",
  examRoom: "",
  examLink: "",
  examType: "Onsite",
  majorCode: "",
};

const extractSessionNumber = (val: string) => {
  if (!val) return "";
  const s = String(val).trim();
  const match = s.match(/\d+/);
  return match ? match[0] : s.toLowerCase().replace(/\s+/g, "");
};

const normalizeRoomName = (val: string) => {
  if (!val) return "";
  return String(val).trim().toLowerCase().replace(/\s+/g, "");
};

const isSubjectMatch = (abbr: string, full: string) => {
  if (!abbr || !full) return false;
  const norm = (s: string) =>
    s.normalize("NFD")
     .replace(/\p{Diacritic}/gu, "")
     .toLowerCase()
     .replace(/[đĐ]/g, "d")
     .replace(/\s+/g, " ")
     .trim();

  const nAbbr = norm(abbr);
  const nFull = norm(full);
  if (nAbbr === nFull) return true;

  const wordsAbbr = nAbbr.split(" ").filter(Boolean);
  const wordsFull = nFull.split(" ").filter(Boolean);

  let j = 0;
  for (let i = 0; i < wordsAbbr.length; i++) {
    const p = wordsAbbr[i];
    if (j >= wordsFull.length) return false;
    if (p === wordsFull[j]) {
      j++;
      continue;
    }
    let tempJ = j;
    let abbrMatch = true;
    for (let k = 0; k < p.length; k++) {
      if (tempJ < wordsFull.length && p[k] === wordsFull[tempJ][0]) {
        tempJ++;
      } else {
        abbrMatch = false;
        break;
      }
    }
    if (abbrMatch) j = tempJ;
    else return false;
  }
  return true;
};

const RoomsTab: React.FC = () => {
  const confirm = useConfirm();
  const [students, setStudents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchSubject, setSearchSubject] = useState("");
  const [searchRoom, setSearchRoom] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchSession, setSearchSession] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupByLink, setGroupByLink] = useState(false);

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyRoom);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 });
  const [showImportProgress, setShowImportProgress] = useState(false);

  const makeKey = (r: any) => {
    return `${parseDateToYMD(r.examDate) || ""}|${r.subject || ""}|${r.examSession || ""}|${normalizeExamTime(
      r.examTime || ""
    )}|${r.examRoom || ""}|${r.examType || ""}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllStudentInfor();
      setStudents(data || []);
      deriveRooms(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách phòng thi.");
    } finally {
      setLoading(false);
    }
  };

  const deriveRooms = (data: any[]) => {
    const roomsMap = new Map<string, Room>();
    data.forEach((s) => {
      const key = makeKey(s);
      if (!roomsMap.has(key)) {
        roomsMap.set(key, {
          id: key,
          examDate: s.examDate || "",
          subject: s.subject || "",
          examSession: s.examSession || "",
          examTime: s.examTime || "",
          examRoom: s.examRoom || "",
          examLink: s.examLink || "",
          examType: s.examType || "",
          majorCode: s.majorCode || "",
        });
      } else {
        const existing = roomsMap.get(key)!;
        const codes = existing.majorCode ? existing.majorCode.split(",").map(c => c.trim()) : [];
        if (s.majorCode && !codes.includes(s.majorCode.trim())) {
          codes.push(s.majorCode.trim());
          existing.majorCode = codes.sort().join(", ");
        }
      }
    });
    setRooms(Array.from(roomsMap.values()));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRooms = useMemo(() => {
    const sSub = normalizeString(searchSubject);
    const sRoom = normalizeString(searchRoom);
    const sSess = normalizeString(searchSession);
    const sDate = searchDate;

    return rooms.filter((r) => {
      if (sSub && !normalizeString(r.subject).includes(sSub)) return false;
      if (sRoom && !normalizeString(r.examRoom).includes(sRoom)) return false;
      if (sSess && !normalizeString(r.examSession).includes(sSess)) return false;
      if (sDate && parseDateToYMD(r.examDate) !== sDate) return false;
      return true;
    });
  }, [rooms, searchSubject, searchRoom, searchSession, searchDate]);

  const displayedRooms = useMemo(() => {
    if (!groupByLink) return filteredRooms;
    const groups = new Map<string, Room[]>();
    filteredRooms.forEach((r) => {
      const link = (r.examLink || "").trim() || "(không)";
      if (!groups.has(link)) groups.set(link, []);
      groups.get(link)!.push(r);
    });
    return Array.from(groups.values()).flat();
  }, [filteredRooms, groupByLink]);

  const handleEditClick = (r: Room) => {
    setEditingRoom(r);
    setFormData({
      examDate: r.examDate || "",
      subject: r.subject || "",
      examSession: r.examSession || "",
      examTime: r.examTime || "",
      examRoom: r.examRoom || "",
      examLink: r.examLink || "",
      examType: r.examType || "Onsite",
      majorCode: r.majorCode || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    setIsSaving(true);
    try {
      const matchingStudents = students.filter((s) => {
        const sDate = parseDateToYMD(s.examDate || "");
        const editDate = parseDateToYMD(editingRoom.examDate || "");
        return (
          sDate === editDate &&
          isSubjectMatch(editingRoom.subject || "", s.subject || "") &&
          (editingRoom.majorCode || "").split(",").map(c => c.trim()).includes(s.majorCode || "") &&
          extractSessionNumber(s.examSession) === extractSessionNumber(editingRoom.examSession) &&
          normalizeRoomName(s.examRoom) === normalizeRoomName(editingRoom.examRoom) &&
          (s.examType || "") === (editingRoom.examType || "")
        );
      });

      if (matchingStudents.length === 0) {
        toast.error("Không tìm thấy sinh viên nào khớp với phòng thi này.");
        setIsSaving(false);
        return;
      }

      const updates: any = {};
      if (formData.examDate !== editingRoom.examDate) updates.examDate = formData.examDate || null;
      if (formData.subject !== editingRoom.subject) updates.subject = formData.subject;
      if (formData.examSession !== editingRoom.examSession) updates.examSession = formData.examSession;
      if (formData.examTime !== editingRoom.examTime) updates.examTime = formData.examTime;
      if (formData.examRoom !== editingRoom.examRoom) updates.examRoom = formData.examRoom;
      if (formData.examLink !== editingRoom.examLink) updates.examLink = formData.examLink;
      if (formData.examType !== editingRoom.examType) updates.examType = formData.examType;
      if (formData.majorCode !== editingRoom.majorCode) updates.majorCode = formData.majorCode;

      const ids = matchingStudents.map((s) => s.id);
      await apiClient.post("/api/v1/admin/students/bulk-update", { ids, updates });
      toast.success(`Đã cập nhật và đồng bộ ${ids.length} sinh viên.`);
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (r: Room) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa phòng thi này và toàn bộ sinh viên bên trong?");
    if (!isConfirmed) return;
    setIsSaving(true);
    try {
      const matchingStudents = students.filter((s) => {
        const sDate = parseDateToYMD(s.examDate || "");
        const rDate = parseDateToYMD(r.examDate || "");
        return (
          sDate === rDate &&
          isSubjectMatch(r.subject || "", s.subject || "") &&
          (r.majorCode || "").split(",").map(c => c.trim()).includes(s.majorCode || "") &&
          extractSessionNumber(s.examSession) === extractSessionNumber(r.examSession) &&
          normalizeRoomName(s.examRoom) === normalizeRoomName(r.examRoom) &&
          (s.examType || "") === (r.examType || "")
        );
      });

      if (matchingStudents.length > 0) {
        const ids = matchingStudents.map((s) => s.id);
        await apiClient.post("/api/v1/admin/students/bulk-delete", { ids });
        toast.success(`Đã xóa phòng và ${ids.length} sinh viên liên quan.`);
      } else {
        toast.info("Không có sinh viên nào trong phòng này.");
      }
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const isConfirmed = await confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phòng đã chọn cùng toàn bộ sinh viên liên quan?`);
    if (!isConfirmed) return;
    setIsSaving(true);
    try {
      let totalDeleted = 0;
      const selectedRooms = rooms.filter((r) => selectedIds.includes(r.id));
      const studentIdsToDelete: string[] = [];

      selectedRooms.forEach((r) => {
        const matching = students.filter((s) => {
          const sDate = parseDateToYMD(s.examDate || "");
          const rDate = parseDateToYMD(r.examDate || "");
          return (
            sDate === rDate &&
            isSubjectMatch(r.subject || "", s.subject || "") &&
            (r.majorCode || "").split(",").map(c => c.trim()).includes(s.majorCode || "") &&
            extractSessionNumber(s.examSession) === extractSessionNumber(r.examSession) &&
            normalizeRoomName(s.examRoom) === normalizeRoomName(r.examRoom) &&
            (s.examType || "") === (r.examType || "")
          );
        });
        studentIdsToDelete.push(...matching.map((s) => s.id));
      });

      if (studentIdsToDelete.length > 0) {
        await apiClient.post("/api/v1/admin/students/bulk-delete", { ids: studentIdsToDelete });
        totalDeleted = studentIdsToDelete.length;
      }

      toast.success(`Đã xóa các phòng đã chọn và ${totalDeleted} sinh viên liên quan.`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa hàng loạt thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setShowImportProgress(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

          if (!Array.isArray(json) || json.length === 0) {
            toast.error("File Excel trống hoặc không đúng định dạng.");
            return;
          }

          setImportProgress({ processed: 0, total: json.length });
          let appliedCount = 0;

          // 1. Detect layout
          const firstRow = json[0];
          const keys = Object.keys(firstRow);
          const hasZaloFormat = keys.some(k => k.toLowerCase().includes("zalo") || k.toLowerCase().includes("nhom"));
          const hasMajorCode = keys.some(k => k.toLowerCase().includes("nganh") || k.toLowerCase().includes("major"));
          
          if (hasZaloFormat) {
            // Format ZaloGroupName: Room-Session-Subject
            for (let i = 0; i < json.length; i++) {
              const row = json[i];
              const zaloKey = keys.find(k => k.toLowerCase().includes("zalo") || k.toLowerCase().includes("nhom"))!;
              const linkKey = keys.find(k => k.toLowerCase().includes("link") || k.toLowerCase().includes("roomlink") || k.toLowerCase().includes("examlink") || k.toLowerCase().includes("url"))!;
              const zaloName = String(row[zaloKey] || "").trim();
              const examLink = linkKey ? String(row[linkKey] || "").trim() : "";

              if (zaloName) {
                const parts = zaloName.split("-").map(s => s.trim());
                if (parts.length >= 3) {
                  const examRoom = parts[0];
                  const examSession = parts[1];
                  const subjectAbbr = parts.slice(2).join("-");

                  const matching = students.filter(s => 
                    normalizeRoomName(s.examRoom) === normalizeRoomName(examRoom) &&
                    extractSessionNumber(s.examSession) === extractSessionNumber(examSession) &&
                    isSubjectMatch(subjectAbbr, s.subject || "")
                  );

                  if (matching.length > 0) {
                    const ids = matching.map(s => s.id);
                    await apiClient.post("/api/v1/admin/students/bulk-update", { ids, updates: { examLink } });
                    appliedCount += ids.length;
                  }
                }
              }
              setImportProgress({ processed: i + 1, total: json.length });
            }
            toast.success(`Đã cập nhật link Zalo cho ${appliedCount} sinh viên.`);
          } else if (hasMajorCode) {
            // Format 3-column or multi-column
            for (let i = 0; i < json.length; i++) {
              const row = json[i];
              const majorKey = keys.find(k => k.toLowerCase().includes("nganh") || k.toLowerCase().includes("major"))!;
              const roomKey = keys.find(k => k.toLowerCase().includes("phong") || k.toLowerCase().includes("room"))!;
              const linkKey = keys.find(k => k.toLowerCase().includes("link") || k.toLowerCase().includes("url"))!;
              
              const majorCode = String(row[majorKey] || "").trim();
              const examRoom = String(row[roomKey] || "").trim();
              const examLink = linkKey ? String(row[linkKey] || "").trim() : "";

              if (examRoom) {
                const matching = students.filter(s => 
                  normalizeRoomName(s.examRoom) === normalizeRoomName(examRoom) &&
                  (!majorCode || String(s.majorCode || "").trim() === majorCode)
                );
                if (matching.length > 0) {
                  const ids = matching.map(s => s.id);
                  await apiClient.post("/api/v1/admin/students/bulk-update", { ids, updates: { examLink } });
                  appliedCount += ids.length;
                }
              }
              setImportProgress({ processed: i + 1, total: json.length });
            }
            toast.success(`Đã cập nhật link phòng cho ${appliedCount} sinh viên.`);
          } else {
            // Sequential assignment
            const linkKey = keys.find(k => k.toLowerCase().includes("link") || k.toLowerCase().includes("url"));
            if (!linkKey) {
              toast.error("Không tìm thấy cột link phòng thi trong file.");
              return;
            }
            const links = json.map(row => String(row[linkKey] || "").trim()).filter(Boolean);
            const limit = Math.min(links.length, displayedRooms.length);
            for (let i = 0; i < limit; i++) {
              const link = links[i];
              const r = displayedRooms[i];
              const matching = students.filter((s) => {
                const sDate = parseDateToYMD(s.examDate || "");
                const rDate = parseDateToYMD(r.examDate || "");
                return (
                  sDate === rDate &&
                  isSubjectMatch(r.subject || "", s.subject || "") &&
                  (r.majorCode || "").split(",").map(c => c.trim()).includes(s.majorCode || "") &&
                  extractSessionNumber(s.examSession) === extractSessionNumber(r.examSession) &&
                  normalizeRoomName(s.examRoom) === normalizeRoomName(r.examRoom) &&
                  (s.examType || "") === (r.examType || "")
                );
              });
              if (matching.length > 0) {
                const ids = matching.map(s => s.id);
                await apiClient.post("/api/v1/admin/students/bulk-update", { ids, updates: { examLink: link } });
                appliedCount += ids.length;
              }
              setImportProgress({ processed: i + 1, total: limit });
            }
            toast.success(`Đã gán link tuần tự cho ${appliedCount} sinh viên.`);
          }
          loadData();
        } catch (err: any) {
          toast.error("Lỗi phân tích file Excel: " + err.message);
        } finally {
          setImporting(false);
          setShowImportProgress(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast.error("Đọc file thất bại.");
      setImporting(false);
      setShowImportProgress(false);
    }
    e.target.value = "";
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === displayedRooms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedRooms.map((r) => r.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Môn học..."
              value={searchSubject}
              onChange={(e) => setSearchSubject(e.target.value)}
              className="input-themed px-3 py-1.5 text-xs rounded-xl outline-none"
            />
            <input
              type="text"
              placeholder="Phòng..."
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="input-themed px-3 py-1.5 text-xs rounded-xl outline-none"
            />
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="input-themed px-3 py-1.5 text-xs rounded-xl outline-none"
            />
            <input
              type="text"
              placeholder="Ca thi..."
              value={searchSession}
              onChange={(e) => setSearchSession(e.target.value)}
              className="input-themed px-3 py-1.5 text-xs rounded-xl outline-none"
            />
            <button
              onClick={() => {
                setSearchSubject("");
                setSearchRoom("");
                setSearchDate("");
                setSearchSession("");
              }}
              className="btn-secondary px-3 py-1.5 text-xs rounded-xl"
            >
              Xóa bộ lọc
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isSaving}
                className="btn-danger flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa ({selectedIds.length})
              </button>
            )}
            <input
              id="room-excel-import"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportExcel}
            />
            <button
              onClick={() => document.getElementById("room-excel-import")?.click()}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Excel/CSV
            </button>
            <button
              onClick={loadData}
              className="btn-secondary p-1.5 rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs">
          <div className="cat-meta">
            Tổng số phòng: <strong>{rooms.length}</strong> | Đang hiển thị: <strong>{displayedRooms.length}</strong>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={groupByLink}
              onChange={(e) => setGroupByLink(e.target.checked)}
              className="rounded"
            />
            Nhóm theo link phòng
          </label>
        </div>
      </div>

      {/* Table view */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-themed">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={displayedRooms.length > 0 && selectedIds.length === displayedRooms.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </th>
                  <th>Môn học</th>
                  <th>Ngày thi</th>
                  <th>Phòng / Ca thi</th>
                  <th>Mã ngành</th>
                  <th>Link phòng thi</th>
                  <th className="th-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {displayedRooms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="td-empty">
                      Không tìm thấy phòng thi nào.
                    </td>
                  </tr>
                ) : (
                  displayedRooms.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={() => handleToggleSelect(r.id)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                      </td>
                      <td>
                        <div className="user-name font-semibold">{r.subject}</div>
                        <div className="cat-meta">Loại: {r.examType}</div>
                      </td>
                      <td className="td-sm-text">
                        {r.examDate ? new Date(r.examDate).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td className="td-sm-text">
                        Phòng: <strong>{r.examRoom}</strong>
                        <div className="cat-meta">Ca: {r.examSession} ({r.examTime})</div>
                      </td>
                      <td className="td-sm-text text-brand-600 font-medium">
                        {r.majorCode || "—"}
                      </td>
                      <td className="td-sm-text max-w-xs truncate">
                        {r.examLink ? (
                          <a
                            href={r.examLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exam-link underline hover:text-brand-600"
                            title={r.examLink}
                          >
                            {r.examLink}
                          </a>
                        ) : (
                          <span className="text-gray-400 font-light italic">Chưa có link</span>
                        )}
                      </td>
                      <td className="td-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(r)}
                            className="btn-icon-edit p-1.5 hover:bg-[var(--bg-2)] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(r)}
                            disabled={isSaving}
                            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <h3 className="text-base font-bold mb-4">Sửa thông tin phòng thi (Đồng bộ)</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Ngày thi</label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tên môn học</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Ca thi</label>
                  <input
                    type="text"
                    value={formData.examSession}
                    onChange={(e) => setFormData({ ...formData, examSession: e.target.value })}
                    className="input-themed w-full px-2 py-2 text-sm rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Thời gian</label>
                  <input
                    type="text"
                    value={formData.examTime}
                    onChange={(e) => setFormData({ ...formData, examTime: e.target.value })}
                    className="input-themed w-full px-2 py-2 text-sm rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Phòng thi</label>
                  <input
                    type="text"
                    value={formData.examRoom}
                    onChange={(e) => setFormData({ ...formData, examRoom: e.target.value })}
                    className="input-themed w-full px-2 py-2 text-sm rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Link phòng thi</label>
                <input
                  type="text"
                  value={formData.examLink}
                  onChange={(e) => setFormData({ ...formData, examLink: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Loại thi</label>
                  <input
                    type="text"
                    value={formData.examType}
                    onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Mã ngành</label>
                  <input
                    type="text"
                    value={formData.majorCode}
                    onChange={(e) => setFormData({ ...formData, majorCode: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary px-4 py-2 rounded-xl text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-brand px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                >
                  {isSaving ? "Đang lưu..." : "Lưu & đồng bộ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Progress Modal */}
      {showImportProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm p-6 relative animate-scale-in text-center">
            <h3 className="text-base font-bold mb-4">Đang nhập Excel/CSV</h3>
            <div className="w-full bg-[var(--bg-2)] rounded-full h-2 overflow-hidden mb-3">
              <div
                className="bg-brand-600 h-full transition-all duration-300"
                style={{
                  width: importProgress.total > 0 ? `${(importProgress.processed / importProgress.total) * 100}%` : "0%",
                }}
              />
            </div>
            <div className="text-xs cat-meta">
              Đang xử lý: {importProgress.processed} / {importProgress.total} dòng
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsTab;
