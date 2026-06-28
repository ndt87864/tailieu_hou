import React, { useState } from "react";
import { Plus, Calendar, Lock } from "lucide-react";

// 1. Quản lý phòng thi (Rooms)
export const RoomsTab: React.FC = () => {
  const [rooms] = useState([
    { id: 1, name: "Phòng thi trực tuyến Zoom 01", capacity: 40, status: "active" },
    { id: 2, name: "Phòng thi trực tuyến Zoom 02", capacity: 40, status: "active" },
    { id: 3, name: "Phòng thi trực tuyến Google Meet 01", capacity: 50, status: "active" },
    { id: 4, name: "Phòng thi Tự do 05", capacity: 100, status: "inactive" },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="modal-heading text-base font-bold">Quản lý phòng thi</h3>
        <button className="btn-brand text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm phòng</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table-themed">
          <thead>
            <tr>
              <th>Tên phòng thi</th>
              <th>Sức chứa</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id}>
                <td className="font-medium user-name">{r.name}</td>
                <td className="td-fg2">{r.capacity} sinh viên</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                    {r.status === "active" ? "HOẠT ĐỘNG" : "KHÓA"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 2. Quản lý ca thi (Sessions)
export const SessionsTab: React.FC = () => {
  const [sessions] = useState([
    { id: 1, code: "C1", time: "07:30 - 09:30", note: "Ca thi sáng" },
    { id: 2, code: "C2", time: "09:45 - 11:45", note: "Ca thi sáng muộn" },
    { id: 3, code: "C3", time: "13:30 - 15:30", note: "Ca thi chiều" },
    { id: 4, code: "C4", time: "15:45 - 17:45", note: "Ca thi chiều muộn" },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="modal-heading text-base font-bold">Quản lý ca thi</h3>
        <button className="btn-brand text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm ca thi</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table-themed">
          <thead>
            <tr>
              <th>Mã ca thi</th>
              <th>Khung giờ</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold mock-session-code">{s.code}</td>
                <td className="mock-session-time">{s.time}</td>
                <td className="mock-session-note">{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 3. Quản lý giá môn học (Pricing)
export const PricingTab: React.FC = () => {
  const [prices] = useState([
    { id: 1, name: "Gói ôn thi 1 Tháng", cost: "99.000đ", savings: "Cơ bản" },
    { id: 2, name: "Gói ôn thi 3 Tháng", cost: "249.000đ", savings: "Tiết kiệm 20%" },
    { id: 3, name: "Gói ôn thi 6 Tháng", cost: "399.000đ", savings: "Bán chạy nhất (Tiết kiệm 33%)" },
  ]);

  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Quản lý giá &amp; Gói dịch vụ</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {prices.map((p) => (
          <div key={p.id} className="card p-5 space-y-3 relative overflow-hidden border-t-4 border-t-emerald-500">
            <h4 className="font-bold text-sm card-title">{p.name}</h4>
            <div className="text-2xl font-black text-emerald-600">{p.cost}</div>
            <p className="text-xs mock-pricing-note">{p.savings}</p>
            <button className="mock-pricing-btn w-full py-2 text-xs font-semibold rounded-xl hover:opacity-85">Chỉnh sửa gói</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. Quản lý lịch (Reminders)
export const RemindersTab: React.FC = () => {
  return (
    <div className="card p-6 flex flex-col items-center justify-center text-center space-y-4">
      <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl"><Calendar className="w-8 h-8" /></div>
      <div className="max-w-sm space-y-1">
        <h4 className="font-bold text-sm mock-tab-title">Lịch nhắc ôn thi tự động</h4>
        <p className="mock-session-note">Tự động nhắc nhở ôn luyện cho sinh viên 2 ngày trước ca thi chính thức qua email và hệ thống.</p>
      </div>
      <button className="btn-brand text-xs">Cấu hình thông báo</button>
    </div>
  );
};

// 5. Quản lý tài khoản cao cấp (Premium)
export const PremiumTab: React.FC = () => {
  return (
    <div className="card p-6 flex flex-col items-center justify-center text-center space-y-4">
      <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl"><Lock className="w-8 h-8" /></div>
      <div className="max-w-sm space-y-1">
        <h4 className="font-bold text-sm mock-tab-title">Quản lý Đặc quyền Premium</h4>
        <p className="mock-session-note">Cấu hình số câu hỏi tối đa được xem miễn phí, giá nâng cấp tài khoản VIP và các quyền lợi đi kèm.</p>
      </div>
      <div className="flex gap-4 text-xs font-semibold border-t mock-premium-border pt-4 w-full justify-around mt-4">
        <div>Quyền Free: <span className="text-amber-500">10 câu/ngày</span></div>
        <div>Quyền Plus: <span className="text-purple-500">100 câu/ngày</span></div>
        <div>Quyền Pro: <span className="text-emerald-500">Không giới hạn</span></div>
      </div>
    </div>
  );
};

// 6. Quản lý footer (Footer)
export const FooterTab: React.FC = () => {
  const [footerText, setFooterText] = useState("© 2026 — Nền tảng ôn thi trực tuyến đại học HOU chất lượng cao");

  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Cấu hình thông tin Footer</h3>
      <div className="card p-5 space-y-4">
        <div>
          <label className="form-label block text-xs font-semibold mb-1">Bản quyền chân trang</label>
          <input
            type="text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className="input-themed w-full px-3 py-2 text-sm rounded-xl outline-none"
          />
        </div>
        <button className="btn-brand text-xs">Lưu thay đổi</button>
      </div>
    </div>
  );
};

// 7. Quản lý nội dung liên hệ (Contacts)
export const ContactsTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Nội dung hỗ trợ &amp; liên hệ</h3>
      <div className="card p-6 text-center text-xs mock-contacts-empty">
        Hiện chưa có yêu cầu hỗ trợ hoặc tin nhắn liên hệ nào từ người dùng.
      </div>
    </div>
  );
};

// 8. Tỷ lệ câu hỏi (Question ratio)
export const QuestionRatioTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Phân tích tỷ lệ câu hỏi</h3>
      <div className="card p-5 space-y-4">
        <h4 className="font-bold text-xs mock-qratio-label">Tỷ lệ phủ đáp án đúng (A / B / C / D)</h4>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Đáp án A</span><span>26%</span></div>
            <div className="w-full bg-[var(--bg-2)] h-2 rounded-full overflow-hidden"><div className="bg-brand-500 h-full w-[26%]"></div></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Đáp án B</span><span>24%</span></div>
            <div className="w-full bg-[var(--bg-2)] h-2 rounded-full overflow-hidden"><div className="bg-brand-500 h-full w-[24%]"></div></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Đáp án C</span><span>28%</span></div>
            <div className="w-full bg-[var(--bg-2)] h-2 rounded-full overflow-hidden"><div className="bg-brand-500 h-full w-[28%]"></div></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Đáp án D</span><span>22%</span></div>
            <div className="w-full bg-[var(--bg-2)] h-2 rounded-full overflow-hidden"><div className="bg-brand-500 h-full w-[22%]"></div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 9. Quản lý đăng ký môn (Proxy Registrations)
export const ProxyTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <h3 className="modal-heading text-base font-bold">Quản lý Đăng ký môn hộ</h3>
      <div className="card p-6 text-center text-xs mock-proxy-empty">
        Không có yêu cầu đăng ký môn học hộ nào đang chờ duyệt.
      </div>
    </div>
  );
};
