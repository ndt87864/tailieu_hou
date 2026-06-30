import React, { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, Upload, RefreshCw, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../../services/client.js";
import { useConfirm } from "../../../context/ConfirmContext.js";
import RoomTable from "./RoomTable.js";
import {
  ensureXLSX,
  mapHeaderToKey,
  parseExcelDateToYMD,
  parseDateToYMD,
  parseCSV,
} from "../../../utils/studentInforHelpers.js";

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

const RoomsTab: React.FC = () => {
  const confirm = useConfirm();
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

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/v1/admin/room-infor");
      setRooms(res.data.rooms || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách phòng thi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRooms = useMemo(() => {
    const sSub = searchSubject.toLowerCase().trim();
    const sRoom = searchRoom.toLowerCase().trim();
    const sSess = searchSession.toLowerCase().trim();
    const sDate = searchDate;

    return rooms.filter((r) => {
      if (sSub && !(r.subject || "").toLowerCase().includes(sSub)) return false;
      if (sRoom && !(r.examRoom || "").toLowerCase().includes(sRoom)) return false;
      if (sSess && !(r.examSession || "").toLowerCase().includes(sSess)) return false;
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

  const openCreateModal = () => {
    setEditingRoom(null);
    setFormData(emptyRoom);
    setShowModal(true);
  };

  const openEdit = (r: Room) => {
    setEditingRoom(r);
    setFormData({
      examDate: r.examDate ? parseDateToYMD(r.examDate) : "",
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
    setIsSaving(true);
    try {
      let savedRoom: Room;
      if (editingRoom) {
        const res = await apiClient.put(`/api/v1/admin/room-infor/${editingRoom.id}`, formData);
        savedRoom = res.data.room;
        toast.success("Cập nhật phòng thi thành công!");
      } else {
        const res = await apiClient.post("/api/v1/admin/room-infor", formData);
        savedRoom = res.data.room;
        toast.success("Tạo phòng thi mới thành công!");
      }
      setShowModal(false);
      loadData();

      // Đồng bộ link phòng thi sang danh sách sinh viên
      if (savedRoom.examLink) {
        const resSync = await apiClient.post("/api/v1/admin/students/update-by-match", {
          criteria: {
            examDate: savedRoom.examDate,
            subject: savedRoom.subject,
            examSession: savedRoom.examSession,
            examRoom: savedRoom.examRoom,
          },
          updates: { examLink: savedRoom.examLink },
        });
        if (resSync.data.count > 0) {
          toast.info(`Đã cập nhật link cho ${resSync.data.count} sinh viên tương ứng.`);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Lưu thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (r: Room) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa phòng thi này?");
    if (!isConfirmed) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/api/v1/admin/room-infor/${r.id}`);
      toast.success("Xóa phòng thi thành công!");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const isConfirmed = await confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phòng đã chọn?`);
    if (!isConfirmed) return;
    setIsSaving(true);
    try {
      for (const id of selectedIds) {
        await apiClient.delete(`/api/v1/admin/room-infor/${id}`);
      }
      toast.success(`Đã xóa thành công ${selectedIds.length} phòng thi.`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      toast.error("Xóa hàng loạt thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const isCSV = file.name.toLowerCase().endsWith(".csv");
      let rows: any[] = [];
      let date1904 = false;

      if (isCSV) {
        const text = await file.text();
        rows = parseCSV(text);
      } else {
        const XLSX = await ensureXLSX();
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
        date1904 = Boolean(
          workbook &&
          workbook.Workbook &&
          workbook.Workbook.WBProps &&
          workbook.Workbook.WBProps.date1904
        );
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }

      if (rows.length === 0) {
        toast.error("File Excel trống hoặc lỗi.");
        return;
      }

      const headerMap: any = {};
      const firstRow = rows[0];
      Object.keys(firstRow).forEach((h) => {
        const key = mapHeaderToKey(h);
        if (key) headerMap[h] = key;
      });

      const parsedRooms = rows.map((row) => {
        const item: any = {};
        Object.entries(row).forEach(([k, v]) => {
          const key = headerMap[k];
          if (key) {
            if (key === "examDate") {
              item[key] = parseExcelDateToYMD(v, { date1904 }) || null;
            } else {
              item[key] = String(v).trim();
            }
          }
        });
        return item;
      }).filter(item => item.examRoom && item.subject);

      if (parsedRooms.length === 0) {
        toast.error("Không tìm thấy dòng dữ liệu phòng thi hợp lệ.");
        return;
      }

      // Bulk create/upsert rooms via backend
      let added = 0;
      for (const pr of parsedRooms) {
        await apiClient.post("/api/v1/admin/room-infor", pr);
        added++;

        // Sync link to student_infor if present
        if (pr.examLink) {
          await apiClient.post("/api/v1/admin/students/update-by-match", {
            criteria: {
              examDate: pr.examDate,
              subject: pr.subject,
              examSession: pr.examSession,
              examRoom: pr.examRoom,
            },
            updates: { examLink: pr.examLink },
          });
        }
      }

      toast.success(`Đồng bộ thành công ${added} phòng thi và cập nhật link cho sinh viên.`);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error("Import thất bại: " + (err.message || String(err)));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
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
              className="input-themed px-3 py-1.5 text-xs rounded-xl outline-none cursor-pointer"
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
              className="btn-secondary px-3 py-1.5 text-xs rounded-xl hover:opacity-85"
            >
              Xóa bộ lọc
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
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
            <label className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Import Excel/CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportExcel}
                disabled={importing}
              />
            </label>
            <button
              onClick={openCreateModal}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm phòng thi
            </button>
            <button onClick={loadData} className="btn-secondary p-1.5 rounded-xl">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs">
          <div className="text-muted">
            Tổng số phòng: <strong>{rooms.length}</strong> | Đang hiển thị: <strong>{displayedRooms.length}</strong>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-muted font-medium">
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

      <RoomTable
        loading={loading}
        roomsCount={rooms.length}
        filteredRooms={filteredRooms}
        visibleRooms={displayedRooms}
        selectedIds={selectedIds}
        toggleSelect={handleToggleSelect}
        selectAllVisible={handleToggleSelectAll}
        clearSelection={() => setSelectedIds([])}
        openEdit={openEdit}
        handleDeleteRoom={handleDeleteRoom}
        groupByLink={groupByLink}
        isSaving={isSaving}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h3 className="modal-heading text-base font-bold">
                {editingRoom ? "Chỉnh sửa phòng thi" : "Thêm phòng thi mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Môn thi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Phòng thi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.examRoom}
                    onChange={(e) => setFormData({ ...formData, examRoom: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Ngày thi
                  </label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Ca thi
                  </label>
                  <input
                    type="text"
                    value={formData.examSession}
                    onChange={(e) => setFormData({ ...formData, examSession: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: Ca 1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Thời gian
                  </label>
                  <input
                    type="text"
                    value={formData.examTime}
                    onChange={(e) => setFormData({ ...formData, examTime: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: 07:30 - 09:30"
                  />
                </div>
                <div>
                  <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                    Mã ngành
                  </label>
                  <input
                    type="text"
                    value={formData.majorCode}
                    onChange={(e) => setFormData({ ...formData, majorCode: e.target.value })}
                    className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                    placeholder="VD: A, B, D"
                  />
                </div>
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Link phòng thi (URL)
                </label>
                <input
                  type="text"
                  value={formData.examLink}
                  onChange={(e) => setFormData({ ...formData, examLink: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--border)] hover:bg-[var(--bg-2)] text-[var(--fg-2)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:opacity-90 flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingRoom ? "Lưu thay đổi" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsTab;
