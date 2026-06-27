# Hệ Thống Ôn Thi Trực Tuyến - Phân Quyền Câu Hỏi (tailieu_hou)

Dự án tái cấu trúc toàn diện, tách biệt Frontend (FE) và Backend (BE), quản lý phân quyền (RBAC) chặt chẽ thông qua Middleware kết nối cơ sở dữ liệu Supabase.

---

## 1. Chuẩn bị Cơ sở dữ liệu (Supabase)

1. Tạo một dự án mới trên [Supabase Console](https://supabase.com).
2. Mở mục **SQL Editor** trong Dashboard dự án.
3. Copy toàn bộ nội dung trong file `./database/supabase-init-rbac.sql` và chạy (Run) trên SQL Editor để tạo bảng `profiles`, enum `user_role`, thiết lập RLS và trigger tự động đồng bộ tài khoản.

---

## 2. Khởi chạy Backend API (Hono)

1. Mở terminal tại thư mục `backend`:
   ```bash
   cd backend
   ```
2. Cài đặt các package (Người dùng tự chạy thủ công):
   ```bash
   npm install
   ```
3. Tạo file `.env` từ file mẫu:
   - Copy `.env.example` thành `.env`.
   - Điền thông tin Supabase của bạn:
     - `SUPABASE_URL`: Đường dẫn URL dự án.
     - `SUPABASE_ANON_KEY`: Khóa anon công khai.
     - `SUPABASE_SERVICE_ROLE_KEY`: Khóa service_role bảo mật (dùng để bypass RLS lấy dữ liệu cho admin/management).
4. Khởi chạy môi trường Dev:
   ```bash
   npm run dev
   ```
   *Backend sẽ khởi động tại địa chỉ http://localhost:3001.*

---

## 3. Khởi chạy Frontend (React + Vite + TS)

1. Mở terminal tại thư mục `frontend`:
   ```bash
   cd frontend
   ```
2. Cài đặt các package (Người dùng tự chạy thủ công):
   ```bash
   npm install
   ```
3. Tạo file `.env.local` ở thư mục root của `frontend/`:
   - Tạo file `.env.local`
   - Điền thông tin kết nối Supabase Auth:
     - `VITE_SUPABASE_URL=https://your-project.supabase.co`
     - `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Khởi chạy môi trường Dev:
   ```bash
   npm run dev
   ```
   *Frontend sẽ khởi chạy tại http://localhost:3000 (tự động proxy `/api/*` sang http://localhost:3001).*

---

## 4. Các kịch bản thử nghiệm (Test cases)

1. **Đăng ký tài khoản mới**:
   - Truy cập http://localhost:3000, nhấp chọn Đăng nhập -> chuyển sang Đăng ký.
   - Tài khoản đăng ký mới sẽ tự động được gán role `FREE`.
2. **Xem tài liệu và câu hỏi giới hạn (Free)**:
   - Click vào tài liệu bất kỳ trên trang chủ.
   - Hệ thống chỉ tải được tối đa 5 câu hỏi đầu tiên. Các câu hỏi sau sẽ hiển thị mờ kèm nút yêu cầu nâng cấp lên Premium.
3. **Nâng cấp tài khoản thử nghiệm**:
   - Vì chưa thiết lập phân quyền Admin phức tạp ban đầu, bạn có thể tự thay đổi vai trò trực tiếp từ trang Admin để test.
   - Vào địa chỉ http://localhost:3000/admin.
   - Chọn select box thay đổi role cho tài khoản của bạn thành `ULTRA` hoặc `PRO`.
   - Quay lại trang xem tài liệu, toàn bộ 100% câu hỏi sẽ hiển thị đầy đủ kèm đáp án/giải thích chi tiết mà không còn bị khóa.
