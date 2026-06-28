import React, { useEffect, useState } from "react";
import apiClient from "../../../services/client.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner.js";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext.js";
import { Search, Plus, Trash2, RefreshCw, BookOpen } from "lucide-react";
import { useConfirm } from "../../../context/ConfirmContext.js";
import UserPermissionModal from "./UserPermissionModal.js";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  avatar_url: string | null;
}

const ROLE_OPTIONS = ["free", "plus", "pro", "ultra", "management", "admin"];

const UsersTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", full_name: "", phone: "", role: "free" });

  // States for permission selection (plus / pro)
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<Profile | null>(null);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [userDocUnlocks, setUserDocUnlocks] = useState<string[]>([]);
  const [userCatUnlocks, setUserCatUnlocks] = useState<string[]>([]);
  const [loadingUnlocks, setLoadingUnlocks] = useState(false);
  const [savingUnlocks, setSavingUnlocks] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  const fetchAllDocuments = async () => {
    try {
      const res = await apiClient.get("/api/v1/documents");
      setAllDocuments(res.data.documents || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách tài liệu.");
    }
  };

  const fetchAllCategories = async () => {
    try {
      const res = await apiClient.get("/api/v1/admin/categories");
      setAllCategories(res.data.categories || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách danh mục.");
    }
  };

  const handleOpenPermissionModal = async (user: Profile) => {
    setSelectedUserForAccess(user);
    setLoadingUnlocks(true);
    setUserDocUnlocks([]);
    setUserCatUnlocks([]);
    setDocSearch("");
    try {
      if (user.role === "plus" && allDocuments.length === 0) {
        await fetchAllDocuments();
      } else if (user.role === "pro" && allCategories.length === 0) {
        await fetchAllCategories();
      }
      const res = await apiClient.get(`/api/v1/admin/users/${user.id}/premium-access`);
      setUserDocUnlocks(res.data.documentIds || []);
      setUserCatUnlocks(res.data.categoryIds || []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải tài liệu/danh mục được phân quyền.");
    } finally {
      setLoadingUnlocks(false);
    }
  };

  const handleToggleDocUnlock = (docId: string) => {
    setUserDocUnlocks((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleToggleCatUnlock = (catId: string) => {
    setUserCatUnlocks((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSaveUnlocks = async () => {
    if (!selectedUserForAccess) return;
    setSavingUnlocks(true);
    try {
      await apiClient.put(`/api/v1/admin/users/${selectedUserForAccess.id}/premium-access`, {
        documentIds: selectedUserForAccess.role === "plus" ? userDocUnlocks : [],
        categoryIds: selectedUserForAccess.role === "pro" ? userCatUnlocks : [],
      });
      toast.success("Cập nhật quyền truy cập thành công!");
      setSelectedUserForAccess(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Cập nhật quyền truy cập thất bại.");
    } finally {
      setSavingUnlocks(false);
    }
  };

  const fetchUsers = () => {
    setLoading(true);
    apiClient
      .get("/api/v1/admin/users")
      .then((res) => {
        setUsers(res.data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Không thể tải danh sách tài khoản.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await apiClient.put(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      toast.success("Cập nhật phân quyền thành công!");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cập nhật thất bại.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (currentUser && currentUser.id === userId) {
      toast.error("Bạn không thể tự xóa tài khoản của mình!");
      return;
    }
    const isConfirmed = await confirm("Bạn có chắc chắn muốn xóa tài khoản này không?");
    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/api/v1/admin/users/${userId}`);
      toast.success("Xóa tài khoản thành công!");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xóa thất bại.");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post("/api/v1/admin/users", formData);
      toast.success("Tạo tài khoản thành công!");
      setUsers((prev) => [res.data.user, ...prev]);
      setShowAddModal(false);
      setFormData({ email: "", password: "", full_name: "", phone: "", role: "free" });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Tạo tài khoản thất bại.");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 input-search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm tài khoản..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-themed w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Thêm tài khoản
          </button>
          <button
            onClick={fetchUsers}
            className="btn-secondary p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-themed">
            <thead>
              <tr>
                <th>Hồ sơ / Email</th>
                <th>Điện thoại</th>
                <th>Phân quyền</th>
                <th className="th-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="td-empty">
                    Không tìm thấy tài khoản nào.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isMe = currentUser && u.id === currentUser.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="user-avatar-initial w-8 h-8 rounded-full bg-brand-500/15 flex items-center justify-center font-bold text-xs">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (u.full_name || u.email).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="user-name font-semibold text-sm">
                              {u.full_name || "Chưa thiết lập"}
                              {isMe && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-brand-600/10 text-[var(--brand-600)]">Tôi</span>}
                            </div>
                            <div className="user-email-text">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="user-phone">{u.phone || "—"}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="input-themed px-2.5 py-1 text-xs rounded-lg outline-none cursor-pointer"
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          {u.role === "plus" && (
                            <button
                              onClick={() => handleOpenPermissionModal(u)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-brand-500/10 text-[var(--brand-600)] hover:bg-brand-500/20 transition-colors flex items-center gap-1"
                              title="Cấp quyền tài liệu cho tài khoản Plus"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Tài liệu
                            </button>
                          )}
                          {u.role === "pro" && (
                            <button
                              onClick={() => handleOpenPermissionModal(u)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-[var(--brand-600)] hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                              title="Cấp quyền danh mục cho tài khoản Pro"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Danh mục
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="td-right">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 relative animate-scale-in">
            <h3 className="modal-heading text-base font-bold mb-4">Thêm tài khoản mới</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="form-label block text-xs font-semibold mb-1">Phân quyền</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-cancel px-4 py-2 text-sm font-medium rounded-xl hover:opacity-90"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 text-sm font-medium rounded-xl hover:bg-brand-700"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Modal */}
      <UserPermissionModal
        selectedUserForAccess={selectedUserForAccess}
        docSearch={docSearch}
        setDocSearch={setDocSearch}
        loadingUnlocks={loadingUnlocks}
        allDocuments={allDocuments}
        userDocUnlocks={userDocUnlocks}
        handleToggleDocUnlock={handleToggleDocUnlock}
        allCategories={allCategories}
        userCatUnlocks={userCatUnlocks}
        handleToggleCatUnlock={handleToggleCatUnlock}
        savingUnlocks={savingUnlocks}
        onClose={() => setSelectedUserForAccess(null)}
        onSave={handleSaveUnlocks}
      />
    </div>
  );
};

export default UsersTab;
