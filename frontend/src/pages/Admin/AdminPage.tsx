import React, { useEffect, useState } from "react";
import apiClient from "../../services/client.js";
import LoadingSpinner from "../../components/common/LoadingSpinner.js";
import { useAuth } from "../../context/AuthContext.js";
import { toast } from "react-toastify";
import { Shield, RefreshCw } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  updated_at: string;
}

const ROLE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  admin:      { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  management: { bg: "#fef3c7", color: "#b45309", border: "#fcd34d" },
  ultra:      { bg: "#f3e8ff", color: "#7c3aed", border: "#c4b5fd" },
  pro:        { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
  plus:       { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  free:       { bg: "var(--bg-2)", color: "var(--muted)", border: "var(--border)" },
};

const AdminPage: React.FC = () => {
  const { user, role: myRole } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUsers = () => {
    setLoading(true);
    apiClient
      .get("/api/v1/admin/users")
      .then((res) => { setUsers(res.data.users || []); setLoading(false); })
      .catch((err) => { console.error(err); toast.error("Không thể tải danh sách tài khoản."); setLoading(false); });
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await apiClient.put(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      toast.success("Cập nhật phân quyền thành công!");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
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

  const myStyle = ROLE_STYLES[myRole] ?? ROLE_STYLES.free;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="card flex items-center gap-3 mb-6 p-5">
        <div
          style={{ background: "color-mix(in srgb, var(--brand-600) 12%, transparent)", borderRadius: "0.625rem", padding: "0.625rem" }}
        >
          <Shield className="w-6 h-6" style={{ color: "var(--brand-600)" }} />
        </div>
        <div>
          <h1 style={{ color: "var(--fg)", fontSize: "1.25rem", fontWeight: 700 }}>Trang Quản Trị Hệ Thống</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
            Quyền hạn hiện tại:{" "}
            <span
              style={{ ...myStyle, fontSize: "0.7rem", fontWeight: 700, padding: "1px 6px", borderRadius: 99, border: `1px solid ${myStyle.border}`, display: "inline-block" }}
            >
              {myRole.toUpperCase()}
            </span>
          </p>
        </div>
      </div>

      {/* Users table card */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)", padding: "1rem 1.25rem" }}
          className="flex items-center justify-between"
        >
          <h3 style={{ color: "var(--fg)", fontWeight: 700, fontSize: "0.875rem" }}>
            Danh Sách Người Dùng & Phân Quyền
          </h3>
          <button
            onClick={fetchUsers}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)", fontSize: "0.75rem", fontWeight: 500, borderRadius: "0.5rem", padding: "0.25rem 0.75rem" }}
            className="flex items-center gap-1.5 hover:bg-[var(--bg-2)] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Làm mới
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-themed">
            <thead>
              <tr>
                <th>Email</th>
                <th>Họ Tên</th>
                <th>Vai Trò</th>
                <th style={{ textAlign: "right" }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--meta)" }}>
                    Chưa có tài khoản đăng ký nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isMe = user && u.id === user.id;
                  const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.free;
                  return (
                    <tr
                      key={u.id}
                      style={isMe ? { background: "color-mix(in srgb, var(--brand-600) 5%, transparent)" } : undefined}
                    >
                      <td style={{ color: "var(--fg)", fontWeight: 500 }}>
                        {u.email}
                        {isMe && (
                          <span
                            style={{ background: "color-mix(in srgb, var(--brand-600) 15%, transparent)", color: "var(--brand-600)", fontSize: "0.625rem", fontWeight: 700, padding: "1px 5px", borderRadius: 4, marginLeft: 6 }}
                          >
                            Tôi
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{u.full_name || "Chưa thiết lập"}</td>
                      <td>
                        <span
                          style={{ ...rs, fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99, border: `1px solid ${rs.border}`, display: "inline-block" }}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.5rem",
                            background: "var(--surface)",
                            color: "var(--fg)",
                            outline: "none",
                          }}
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
