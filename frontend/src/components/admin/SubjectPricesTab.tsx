import React, { useEffect, useState } from "react";
import { Plus, Trash2, Edit, Loader2, Search } from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/client.js";
import { useConfirm } from "../../context/ConfirmContext.js";
import { useUI } from "../../context/UIContext.js";

interface SubjectPrice {
  id: string;
  subject: string;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export const SubjectPricesTab: React.FC = () => {
  const confirm = useConfirm();
  const [prices, setPrices] = useState<SubjectPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingPrice, setEditingPrice] = useState<SubjectPrice | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [subject, setSubject] = useState("");
  const [priceVal, setPriceVal] = useState("100000");

  const { setPageLoading } = useUI();

  const fetchPrices = async () => {
    setPageLoading(true);
    try {
      const res = await apiClient.get("/api/v1/admin/subject-prices");
      setPrices(res.data.prices || []);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải danh sách giá môn học.");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const openCreateModal = () => {
    setEditingPrice(null);
    setSubject("");
    setPriceVal("100000");
    setShowModal(true);
  };

  const openEditModal = (p: SubjectPrice) => {
    setEditingPrice(p);
    setSubject(p.subject);
    setPriceVal(String(p.price));
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa giá của môn học này?");
    if (!isConfirmed) return;
    try {
      await apiClient.delete(`/api/v1/admin/subject-prices/${id}`);
      toast.success("Xóa giá môn học thành công!");
      fetchPrices();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi xóa giá môn học.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !priceVal) {
      toast.error("Vui lòng điền đầy đủ tên môn học và giá.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        subject: subject.trim(),
        price: Number(priceVal) || 0,
      };

      if (editingPrice) {
        await apiClient.put(`/api/v1/admin/subject-prices/${editingPrice.id}`, payload);
        toast.success("Cập nhật giá môn học thành công!");
      } else {
        await apiClient.post("/api/v1/admin/subject-prices", payload);
        toast.success("Thêm giá môn học mới thành công!");
      }
      setShowModal(false);
      fetchPrices();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Lỗi khi lưu thông tin giá môn học.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPrices = prices.filter((p) =>
    p.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="modal-heading text-base font-bold">Quản lý Giá Môn Học</h3>
        <div className="flex flex-1 md:justify-end gap-3 max-w-lg">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tìm kiếm môn học..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none"
            />
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            onClick={openCreateModal}
            className="btn-brand text-xs flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm giá môn học
          </button>
        </div>
      </div>

      {loading ? null : (
        <div className="table-responsive rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-2)] font-semibold">
                <th className="p-4">Tên môn học</th>
                <th className="p-4 text-right">Giá tiền</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrices.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted">
                    Không tìm thấy môn học nào.
                  </td>
                </tr>
              ) : (
                filteredPrices.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="p-4 font-medium text-[var(--fg)]">{p.subject}</td>
                    <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {p.price.toLocaleString("vi-VN")} đ
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 border border-[var(--border)] rounded-xl hover:bg-[var(--surface-2)] text-[var(--fg)] transition-colors"
                          title="Sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 border border-red-500/25 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
              <h3 className="modal-heading text-base font-bold">
                {editingPrice ? "Chỉnh sửa Giá Môn Học" : "Thêm Giá Môn Học Mới"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Tên môn học
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  placeholder="VD: Triết học Mác - Lênin"
                  required
                />
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Giá tiền (VND)
                </label>
                <input
                  type="number"
                  value={priceVal}
                  onChange={(e) => setPriceVal(e.target.value)}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  placeholder="Mặc định: 100000"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)] shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--surface-2)] text-sm font-semibold rounded-xl transition-colors cursor-pointer bg-transparent text-[var(--fg)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 btn-brand text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
