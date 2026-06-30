import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import { Plus, Edit, Trash2, X, Loader2, Link2 } from "lucide-react";
import "../../css/contacts-tab.css";
import { useConfirm } from "../../context/ConfirmContext.js";

interface ContactLink {
  linkText: string;
  linkUrl: string;
}

interface PricingContent {
  id: string;
  number: number;
  text: string;
  links: ContactLink[];
}

export const ContactsTab: React.FC = () => {
  const confirm = useConfirm();
  const [contentList, setContentList] = useState<PricingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<PricingContent | null>(null);

  // Form states
  const [number, setNumber] = useState<number | "">("");
  const [text, setText] = useState("");
  const [links, setLinks] = useState<ContactLink[]>([]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/api/v1/pricing-content");
      setContentList(res.data.content || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể tải danh sách nội dung liên hệ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setNumber(contentList.length + 1);
    setText("");
    setLinks([]);
    setShowModal(true);
  };

  const openEditModal = (item: PricingContent) => {
    setEditingItem(item);
    setNumber(item.number);
    setText(item.text);
    setLinks(item.links || []);
    setShowModal(true);
  };

  const handleAddLink = () => {
    setLinks([...links, { linkText: "", linkUrl: "" }]);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, field: keyof ContactLink, value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    setLinks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (number === "" || !text.trim()) {
      toast.warn("Vui lòng nhập đầy đủ Số thứ tự và Nội dung.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        number,
        text,
        links: links.filter((l) => l.linkText.trim() && l.linkUrl.trim()),
      };

      if (editingItem) {
        await apiClient.put(`/api/v1/admin/pricing-content/${editingItem.id}`, payload);
        toast.success("Cập nhật nội dung liên hệ thành công!");
      } else {
        await apiClient.post("/api/v1/admin/pricing-content", payload);
        toast.success("Thêm mới nội dung liên hệ thành công!");
      }

      setShowModal(false);
      fetchContent();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Đã xảy ra lỗi khi lưu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa mục này?");
    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/api/v1/admin/pricing-content/${id}`);
      toast.success("Xóa nội dung liên hệ thành công!");
      fetchContent();
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể xóa nội dung liên hệ.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
        <span className="text-xs text-muted-foreground">Đang tải dữ liệu...</span>
      </div>
    );
  }

  return (
    <div className="contacts-tab-container">
      <div className="contacts-header">
        <h3 className="modal-heading text-base font-bold">Nội dung hướng dẫn liên hệ</h3>
        <button
          onClick={openAddModal}
          className="btn-brand text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Thêm mục mới
        </button>
      </div>

      <div className="contacts-list">
        {contentList.length === 0 ? (
          <div className="card p-6 text-center text-xs text-muted-foreground">
            Chưa có hướng dẫn liên hệ nào. Nhấp vào nút "Thêm mục mới" để bắt đầu.
          </div>
        ) : (
          contentList.map((item) => (
            <div
              key={item.id}
              className="card contact-step-card flex items-start justify-between border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="contact-step-number bg-brand-600/10 text-brand-600 flex-shrink-0">
                  {item.number}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm leading-relaxed text-[var(--fg)] break-words whitespace-pre-line">
                    {item.text}
                  </p>
                  {item.links && item.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1.5">
                      {item.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-500/5 px-2 py-0.5 rounded-md"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>{link.linkText}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="contact-step-actions ml-4 flex-shrink-0">
                <button
                  onClick={() => openEditModal(item)}
                  className="p-1.5 hover:bg-[var(--bg-2)] rounded-lg text-[var(--fg-2)] hover:text-blue-600 transition"
                  title="Chỉnh sửa"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 hover:bg-[var(--bg-2)] rounded-lg text-[var(--fg-2)] hover:text-red-600 transition"
                  title="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h4 className="font-bold text-sm text-[var(--fg)]">
                {editingItem ? "Chỉnh sửa mục hướng dẫn" : "Thêm mục hướng dẫn mới"}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-[var(--bg-2)] rounded-lg text-muted transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Số thứ tự
                </label>
                <input
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="form-label block text-xs font-semibold mb-1 text-[var(--fg)]">
                  Nội dung hướng dẫn
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none min-h-[100px] resize-y"
                  placeholder="Nhập hướng dẫn chuyển khoản hoặc liên hệ..."
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="form-label block text-xs font-semibold text-[var(--fg)]">
                    Liên kết ngoài (tùy chọn)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    + Thêm liên kết
                  </button>
                </div>

                {links.map((link, idx) => (
                  <div
                    key={idx}
                    className="link-input-group border border-[var(--border)] bg-[var(--bg-2)] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted uppercase">
                        Liên kết {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Văn bản hiển thị (VD: Zalo)"
                        value={link.linkText}
                        onChange={(e) => handleLinkChange(idx, "linkText", e.target.value)}
                        className="input-themed px-2.5 py-1.5 text-xs rounded-lg outline-none"
                      />
                      <input
                        type="url"
                        placeholder="Đường dẫn (VD: https://...)"
                        value={link.linkUrl}
                        onChange={(e) => handleLinkChange(idx, "linkUrl", e.target.value)}
                        className="input-themed px-2.5 py-1.5 text-xs rounded-lg outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-[var(--bg-2)] text-[var(--fg-2)] rounded-xl hover:opacity-90 transition"
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 text-white rounded-xl hover:opacity-90 transition flex items-center gap-1.5"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? "Lưu thay đổi" : "Tạo mới"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
