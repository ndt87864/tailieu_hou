import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext.js";
import { Search, Plus, Trash2, RefreshCw, BookOpen } from "lucide-react";
import { useConfirm } from "../../context/ConfirmContext.js";
import UserPermissionModal from "./UserPermissionModal.js";
import { useUI } from "../../context/UIContext.js";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  is_excel_enabled?: boolean;
  excel_percentage?: number;
  premium_user?: { category_id: string | null; document_id: string | null }[];
}

const ROLE_OPTIONS = ["free", "plus", "pro", "ultra", "management", "admin"];

const UsersTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { setPageLoading } = useUI();
  const [searchTerm, setSearchTerm] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [questionRatios, setQuestionRatios] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", full_name: "", phone: "", role: "free" });
  const [tempPercentages, setTempPercentages] = useState<Record<string, string>>({});
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<Profile | null>(null);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [userDocUnlocks, setUserDocUnlocks] = useState<string[]>([]);
  const [userCatUnlocks, setUserCatUnlocks] = useState<string[]>([]);
  const [loadingUnlocks, setLoadingUnlocks] = useState(false);
  const [savingUnlocks, setSavingUnlocks] = useState(false);

  const fetchQuestionRatios = async () => {
    try {
      const res = await apiClient.get("/api/v1/admin/question-ratios");
      setQuestionRatios(res.data?.ratios || []);
    } catch (err) {
      console.error("Error loading question ratios:", err);
    }
  };

  const getRoleDefaultExcelPercentage = (role: string) => {
    const ratio = questionRatios.find((r) => r.role === role);
    if (ratio) {
      const unpaid = ratio.excel_ratio_unpaid !== undefined ? ratio.excel_ratio_unpaid : 100;
      const paid = ratio.excel_ratio_paid !== undefined ? ratio.excel_ratio_paid : 100;
      if (unpaid === paid) return `${unpaid}`;
      return `${unpaid}/${paid}`;
    }
    if (role === "plus") return "50/100";
    if (role === "free") return "0";
    return "100";
  };

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
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Cập nhật quyền truy cập thất bại.");
    } finally {
      setSavingUnlocks(false);
    }
  };

  const fetchUsers = () => {
    setPageLoading(true);
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
      })
      .finally(() => {
        setPageLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
    fetchAllDocuments();
    fetchAllCategories();
    fetchQuestionRatios();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await apiClient.put(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      toast.success("Cập nhật phân quyền thành công!");
      const updatedProfile = res.data.profile;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: updatedProfile.role,
                excel_percentage: updatedProfile.excel_percentage,
                is_excel_enabled: updatedProfile.is_excel_enabled,
              }
            : u
        )
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cập nhật thất bại.");
    }
  };

  const handleToggleExcelPermission = async (userId: string, currentStatus: boolean) => {
    try {
      await apiClient.patch(`/api/v1/admin/users/${userId}`, { is_excel_enabled: !currentStatus });
      toast.success(`Quyền tải Excel đã được ${!currentStatus ? "bật" : "tắt"} thành công!`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_excel_enabled: !currentStatus } : u))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cập nhật quyền tải Excel thất bại.");
    }
  };

  const handleExcelPercentageChange = async (userId: string, percentage: number | null) => {
    try {
      await apiClient.patch(`/api/v1/admin/users/${userId}`, { excel_percentage: percentage });
      toast.success(percentage === null ? "Đã đặt lại tỷ lệ tải Excel về mặc định của role!" : `Tỷ lệ tải Excel đã được cập nhật thành ${percentage}%!`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, excel_percentage: percentage ?? undefined } : u))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cập nhật tỷ lệ tải Excel thất bại.");
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

  if (loading) return null;

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
            onClick={() => {
              fetchUsers();
              fetchQuestionRatios();
            }}
            className="btn-secondary p-2 rounded-xl hover:bg-[var(--bg-2)] transition-colors shadow-sm"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Users table - Desktop View */}
      <div className="admin-table-card-wrapper hidden md:block">
        <div className="overflow-x-auto">
          <table className="table-themed">
            <thead>
              <tr>
                <th>Hồ sơ / Email</th>
                <th>Điện thoại</th>
                <th>Phân quyền</th>
                <th>Tải Excel</th>
                <th className="th-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td-empty">
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
                        <div className="flex flex-col gap-1 items-start">
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

                          {u.role === "pro" && (
                            (() => {
                              const userCats = u.premium_user?.map(pu => pu.category_id).filter(Boolean) || [];
                              const catNames = userCats.map(id => allCategories.find(c => c.id === id)?.title).filter(Boolean);
                              const displayNames = catNames.slice(0, 2);
                              const extraCount = catNames.length - 2;
                              return (
                                <div className="flex flex-col gap-1 mt-1">
                                  <button
                                    onClick={() => handleOpenPermissionModal(u)}
                                    className="text-[10px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-semibold hover:underline"
                                    title="Chỉnh sửa danh mục cấp quyền"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    Danh mục ({catNames.length})
                                  </button>
                                  {catNames.length > 0 && (
                                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                                      {displayNames.map((name, idx) => (
                                        <span key={idx} className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-[95px]" title={name}>
                                          {name}
                                        </span>
                                      ))}
                                      {extraCount > 0 && (
                                        <span className="px-1 py-0.5 text-[9px] rounded bg-gray-100 text-gray-600 border border-gray-200">
                                          +{extraCount}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}

                          {u.role === "plus" && (
                            (() => {
                              const userDocs = u.premium_user?.map(pu => pu.document_id).filter(Boolean) || [];
                              const docNames = userDocs.map(id => allDocuments.find(d => d.id === id)?.title).filter(Boolean);
                              const displayNames = docNames.slice(0, 2);
                              const extraCount = docNames.length - 2;
                              return (
                                <div className="flex flex-col gap-1 mt-1">
                                  <button
                                    onClick={() => handleOpenPermissionModal(u)}
                                    className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-1 font-semibold hover:underline"
                                    title="Chỉnh sửa tài liệu cấp quyền"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    Tài liệu ({docNames.length})
                                  </button>
                                  {docNames.length > 0 && (
                                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                                      {displayNames.map((name, idx) => (
                                        <span key={idx} className="px-1.5 py-0.5 text-[9px] rounded bg-brand-50 text-brand-700 border border-brand-200 truncate max-w-[95px]" title={name}>
                                          {name}
                                        </span>
                                      ))}
                                      {extraCount > 0 && (
                                        <span className="px-1 py-0.5 text-[9px] rounded bg-gray-100 text-gray-600 border border-gray-200">
                                          +{extraCount}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1.5 items-start">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={u.is_excel_enabled !== false}
                              onChange={() => handleToggleExcelPermission(u.id, u.is_excel_enabled !== false)}
                              className="rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                            />
                            <span>Cho phép</span>
                          </label>
                          {u.is_excel_enabled !== false && (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder={getRoleDefaultExcelPercentage(u.role)}
                                value={
                                  tempPercentages[u.id] !== undefined
                                    ? tempPercentages[u.id]
                                    : (u.excel_percentage !== undefined && u.excel_percentage !== null ? String(u.excel_percentage) : "")
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTempPercentages((prev) => ({ ...prev, [u.id]: val }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const rawVal = tempPercentages[u.id];
                                    if (rawVal !== undefined) {
                                      const trimmed = rawVal.trim();
                                      const percentage = trimmed === "" ? null : Math.min(Math.max(parseInt(trimmed) || 0, 0), 100);
                                      handleExcelPercentageChange(u.id, percentage);
                                      setTempPercentages((prev) => {
                                        const copy = { ...prev };
                                        delete copy[u.id];
                                        return copy;
                                      });
                                    }
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                onBlur={() => {
                                  setTempPercentages((prev) => {
                                    const copy = { ...prev };
                                    delete copy[u.id];
                                    return copy;
                                  });
                                }}
                                className="input-themed w-16 px-1.5 py-0.5 text-center text-xs rounded-lg outline-none"
                              />
                              <span className="text-[11px] text-[var(--muted)]">%</span>
                            </div>
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

      {/* Users List - Mobile View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredUsers.length === 0 ? (
          <div className="card p-6 text-center text-sm text-[var(--fg-2)]">
            Không tìm thấy tài khoản nào.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isMe = currentUser && u.id === currentUser.id;
            return (
              <div key={u.id} className="admin-mobile-card">
                <div className="flex items-center gap-3">
                  <div className="user-avatar-initial w-10 h-10 rounded-full bg-brand-500/15 flex items-center justify-center font-bold text-sm shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (u.full_name || u.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate flex items-center gap-1">
                      <span>{u.full_name || "Chưa thiết lập"}</span>
                      {isMe && <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-bold bg-brand-600/10 text-[var(--brand-600)]">Tôi</span>}
                    </div>
                    <div className="text-xs text-[var(--muted)] truncate">{u.email}</div>
                  </div>
                </div>

                <div className="admin-mobile-card-body">
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Điện thoại:</span>
                    <span className="admin-mobile-card-value">{u.phone || "—"}</span>
                  </div>
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Phân quyền:</span>
                    <div className="flex flex-col items-end gap-1">
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
                      {u.role === "pro" && (
                        (() => {
                          const userCats = u.premium_user?.map(pu => pu.category_id).filter(Boolean) || [];
                          const catNames = userCats.map(id => allCategories.find(c => c.id === id)?.title).filter(Boolean);
                          const displayNames = catNames.slice(0, 2);
                          const extraCount = catNames.length - 2;
                          return (
                            <div className="flex flex-col items-end gap-1 mt-1">
                              <button
                                onClick={() => handleOpenPermissionModal(u)}
                                className="text-[10px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-semibold hover:underline"
                              >
                                <BookOpen className="w-3 h-3" />
                                Danh mục ({catNames.length})
                              </button>
                              {catNames.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1 max-w-[180px]">
                                  {displayNames.map((name, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-[120px]" title={name}>
                                      {name}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="px-1 py-0.5 text-[9px] rounded bg-gray-100 text-gray-600 border border-gray-200">
                                      +{extraCount}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                      {u.role === "plus" && (
                        (() => {
                          const userDocs = u.premium_user?.map(pu => pu.document_id).filter(Boolean) || [];
                          const docNames = userDocs.map(id => allDocuments.find(d => d.id === id)?.title).filter(Boolean);
                          const displayNames = docNames.slice(0, 2);
                          const extraCount = docNames.length - 2;
                          return (
                            <div className="flex flex-col items-end gap-1 mt-1">
                              <button
                                onClick={() => handleOpenPermissionModal(u)}
                                className="text-[10px] text-brand-600 hover:text-brand-700 flex items-center gap-1 font-semibold hover:underline"
                              >
                                <BookOpen className="w-3 h-3" />
                                Tài liệu ({docNames.length})
                              </button>
                              {docNames.length > 0 && (
                                <div className="flex flex-wrap justify-end gap-1 max-w-[180px]">
                                  {displayNames.map((name, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 text-[9px] rounded bg-brand-50 text-brand-700 border border-brand-200 truncate max-w-[120px]" title={name}>
                                      {name}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="px-1 py-0.5 text-[9px] rounded bg-gray-100 text-gray-600 border border-gray-200">
                                      +{extraCount}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                  <div className="admin-mobile-card-row">
                    <span className="admin-mobile-card-label">Tải Excel:</span>
                    <div className="flex flex-col items-end gap-1">
                      <label className="flex items-center gap-1 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={u.is_excel_enabled !== false}
                          onChange={() => handleToggleExcelPermission(u.id, u.is_excel_enabled !== false)}
                          className="rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                        />
                        <span>Cho phép</span>
                      </label>
                      {u.is_excel_enabled !== false && (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder={getRoleDefaultExcelPercentage(u.role)}
                            value={
                              tempPercentages[u.id] !== undefined
                                ? tempPercentages[u.id]
                                : (u.excel_percentage !== undefined && u.excel_percentage !== null ? String(u.excel_percentage) : "")
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempPercentages((prev) => ({ ...prev, [u.id]: val }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const rawVal = tempPercentages[u.id];
                                if (rawVal !== undefined) {
                                  const trimmed = rawVal.trim();
                                  const percentage = trimmed === "" ? null : Math.min(Math.max(parseInt(trimmed) || 0, 0), 100);
                                  handleExcelPercentageChange(u.id, percentage);
                                  setTempPercentages((prev) => {
                                    const copy = { ...prev };
                                    delete copy[u.id];
                                    return copy;
                                  });
                                }
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            onBlur={() => {
                                setTempPercentages((prev) => {
                                  const copy = { ...prev };
                                  delete copy[u.id];
                                  return copy;
                                });
                            }}
                            className="input-themed w-16 px-1 py-0.5 text-center text-xs rounded-lg outline-none"
                          />
                          <span className="text-[11px] text-[var(--muted)]">%</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                 <div className="admin-mobile-card-footer justify-end">
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-auto"
                    title="Xóa tài khoản"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
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
