import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { toast } from "react-toastify";
import { Shield, UserCog, UserCheck } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  updated_at: string;
}

const AdminPage: React.FC = () => {
  const { user, role: myRole } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
      // Tự update lại local state để hiển thị
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      // Nếu tự update role của chính mình, thông báo reload để check
      if (user && userId === user.id) {
        toast.info("Đang tự đổi quyền của bạn. Hệ thống sẽ đồng bộ lại...");
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Cập nhật thất bại.");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 bg-white p-5 rounded-lg border border-gray-100 shadow-sm">
        <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Trang Quản Trị Hệ Thống</h1>
          <p className="text-xs text-gray-500">
            Quyền hạn hiện tại: <span className="font-semibold text-indigo-600">{myRole.toUpperCase()}</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-sm">Danh Sách Người Dùng & Phân Quyền</h3>
          <button
            onClick={fetchUsers}
            className="text-xs bg-white border px-3 py-1 rounded hover:bg-gray-50 font-medium"
          >
            Làm mới danh sách
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100/50 text-gray-400 font-semibold uppercase text-xs border-b">
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Họ Tên</th>
                <th className="px-6 py-3">Vai Trò</th>
                <th className="px-6 py-3 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400">
                    Chưa có tài khoản đăng ký nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isMe = user && u.id === user.id;

                  return (
                    <tr key={u.id} className={isMe ? "bg-indigo-50/20" : ""}>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {u.email} {isMe && <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Tôi</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{u.full_name || "Chưa thiết lập"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            u.role === "admin"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : u.role === "management"
                              ? "bg-amber-50 text-amber-600 border border-amber-200"
                              : u.role === "ultra"
                              ? "bg-purple-50 text-purple-600 border border-purple-200"
                              : u.role === "pro"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-gray-50 text-gray-500 border"
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          className="border rounded text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="free">FREE</option>
                          <option value="plus">PLUS</option>
                          <option value="pro">PRO</option>
                          <option value="ultra">ULTRA</option>
                          <option value="management">MANAGEMENT</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
