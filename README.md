# Hệ Thống Ôn Thi Trực Tuyến - Phân Quyền Câu Hỏi & Hỗ Trợ Thi Cử (tailieu_hou)

Dự án là một hệ sinh thái toàn diện hỗ trợ ôn thi trắc nghiệm trực tuyến cho sinh viên. Hệ thống bao gồm Web App (Frontend & Backend API), Cơ sở dữ liệu Supabase tích hợp hệ thống phân quyền (RBAC) nghiêm ngặt, và Chrome Extension hỗ trợ giải câu hỏi.

---

## 📂 Cấu trúc dự án (Monorepo)

Hệ thống được tổ chức theo mô hình Monorepo quản lý qua NPM Workspaces:

*   **`backend/`**: RESTful API xây dựng trên **Hono Framework**, chạy trên Node Server (`@hono/node-server`), sử dụng **Redis** (`ioredis`) để cache dữ liệu và giới hạn tần suất yêu cầu (Rate Limiter).
*   **`frontend/`**: Ứng dụng Single Page Application (SPA) xây dựng bằng **React + Vite + TypeScript + TailwindCSS**, tích hợp Supabase Auth và các thư viện xuất tài liệu (PDF, Word, Excel).
*   **`hou_quiz/`**: Chrome Extension (Manifest V3) chạy trực tiếp trên cổng đào tạo trực tuyến của HOU (`*.ehou.edu.vn` và `lmshub.hou.edu.vn`), hỗ trợ tự động tìm kiếm, highlight và điền đáp án từ cơ sở dữ liệu.
*   **`database/`**: Các file script SQL cấu trúc cơ sở dữ liệu Supabase, các chính sách bảo mật RLS (Row-Level Security), trigger đồng bộ tài khoản, và hàng đợi xử lý đăng ký.
*   **`vps-deployment/`**: Tài liệu cấu hình triển khai thực tế trên VPS sử dụng Docker Compose và Nginx Reverse Proxy.

---

## 🛠️ Yêu cầu môi trường

*   **Node.js**: Phiên bản 18+ (Khuyên dùng Node 20 hoặc 22)
*   **Docker & Docker Compose**: Để khởi chạy Redis và cơ sở dữ liệu nội bộ (nếu có)
*   **Supabase Project**: Một tài khoản/dự án Supabase để lưu trữ dữ liệu và xác thực người dùng.

---

## 🔑 Cấu hình các file Environment (`.env`)

Dự án yêu cầu các file biến môi trường sau để có thể hoạt động chính xác:

### 1. File `.env` tại thư mục Root
Dùng cho Docker Compose hoặc cấu hình chung:
```env
PORT=3001
BYPASS_QUESTION_LIMIT=false
DATABASE_URL=postgresql://postgres:[password]@db:5432/postgres
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_ANON_KEY=your_ano_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_URL=redis://redis:6379
```

### 2. File `.env` tại `backend/`
Dùng để chạy thử nghiệm Backend độc lập:
```env
PORT=3001
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_ANON_KEY=your_ano_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_URL=redis://localhost:6379
```

### 3. File `.env` hoặc `.env.local` tại `frontend/`
Dùng cho Frontend kết nối xác thực Supabase Auth:
```env
VITE_SUPABASE_URL=https://[your-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=your_ano_key
```

---

## 🗄️ Khởi tạo cơ sở dữ liệu (Supabase)

Để thiết lập cơ sở dữ liệu Supabase phù hợp với hệ thống, truy cập **SQL Editor** trên Dashboard Supabase và thực thi các file SQL trong thư mục [database](./database) theo trình tự sau:

1.  **[schema-new.sql](./database/schema-new.sql)**: Khởi tạo các bảng cốt lõi (`categories`, `documents`, `questions`, `student_infor`, `profiles` và enum `user_role`).
2.  **[supabase-init-rbac.sql](./database/supabase-init-rbac.sql)**: Cài đặt Trigger tự động tạo profile người dùng khi đăng ký tài khoản mới qua Supabase Auth.
3.  **[rls-policies.sql](./database/rls-policies.sql)**: Thiết lập chính sách bảo mật RLS cho từng bảng dữ liệu.
4.  **[storage-setup.sql](./database/storage-setup.sql)**: Thiết lập bucket lưu trữ tài liệu.
5.  **[registration-queue-setup.sql](./database/registration-queue-setup.sql)**: Cấu hình bảng hàng đợi và trigger xử lý đăng ký thông tin sinh viên.
6.  **[proxy-tables.sql](./database/proxy-tables.sql)**: Thiết lập các bảng và logic proxy dữ liệu.


---

## 🚀 Khởi chạy dự án

### Cách 1: Sử dụng Workspace Root (Khuyên dùng)
Bạn có thể khởi chạy nhanh cả Frontend và Backend từ thư mục gốc của dự án:

1.  Cài đặt dependencies cho toàn bộ workspace:
    ```bash
    npm install
    ```
2.  Chạy đồng thời cả Frontend (Cổng `3000`) & Backend (Cổng `3001`):
    ```bash
    npm run dev
    ```
3.  Build sản phẩm cho cả FE và BE:
    ```bash
    npm run build
    ```

---

### Cách 2: Khởi chạy thủ công từng phần

#### 1. Backend API (Hono)
```bash
cd backend
npm install
npm run dev
```
*Backend sẽ lắng nghe tại `http://localhost:3001`*

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend sẽ khởi chạy tại `http://localhost:3000`. Vite đã cấu hình proxy tự động chuyển tiếp các request `/api/*` sang `http://localhost:3001`.*

---

### Cách 3: Chạy bằng Docker Compose (Local Dev)
Nếu máy bạn có sẵn Docker và muốn chạy nhanh Backend cùng Redis cache:
```bash
docker-compose up --build
```
*Lưu ý: Đảm bảo đã khai báo đầy đủ thông tin Supabase ở file `.env` ngoài root.*

---

## 🧩 Cài đặt Chrome Extension (`hou_quiz`)

Để sử dụng tiện ích tự động làm bài thi trắc nghiệm trên trang đào tạo của HOU:

1.  Mở trình duyệt Google Chrome (hoặc các trình duyệt nhân Chromium như Edge, Brave).
2.  Truy cập trang quản lý Extension: `chrome://extensions/`.
3.  Bật chế độ nhà phát triển (**Developer mode**) ở góc trên bên phải.
4.  Nhấp vào nút **Load unpacked** (Tải thư mục đã giải nén) ở góc trái.
5.  Chọn thư mục **`hou_quiz`** trong dự án này.
6.  Tiện ích sẽ xuất hiện trên thanh công cụ. Khi bạn vào làm bài trắc nghiệm tại `*.ehou.edu.vn` hoặc `lmshub.hou.edu.vn`, tiện ích sẽ tự động hoạt động, giao tiếp với API backend để tìm kiếm tài liệu và gợi ý đáp án.

---

## 🎯 Kịch bản kiểm thử tính năng (Test Cases)

1.  **Giới hạn số câu hỏi đối với người dùng Free**:
    *   Đăng ký một tài khoản mới trên Frontend. Hệ thống sẽ tự động cấp quyền mặc định là `free`.
    *   Mở xem một tài liệu trắc nghiệm bất kỳ. Bạn sẽ chỉ thấy **tối đa 5 câu hỏi đầu tiên**. Các câu hỏi phía sau sẽ bị ẩn mờ kèm theo thông báo yêu cầu nâng cấp gói tài khoản.
2.  **Mở khóa tài liệu Premium**:
    *   Truy cập trang quản lý Admin tại `/admin` (hoặc sửa trực tiếp role của tài khoản trong bảng `profiles` trên Supabase thành `ultra`, `pro`, hoặc `admin`).
    *   Quay lại trang tài liệu cũ, bạn sẽ thấy 100% câu hỏi kèm lời giải chi tiết được hiển thị đầy đủ.
3.  **Tra cứu lịch thi**:
    *   Vào mục **Lịch thi** trên thanh điều hướng, nhập thông tin tài khoản sinh viên để kiểm tra tính năng đồng bộ lịch thi từ phòng đào tạo.

---

## 🌐 Triển khai VPS (Production)

Trong thư mục `vps-deployment/` đã chuẩn bị sẵn cấu hình tối ưu để đưa dự án lên môi trường production:
*   Sử dụng **Nginx Reverse Proxy** (`nginx.conf`) để định tuyến SSL, gzip, cache và chuyển tiếp các port an toàn.
*   File `docker-compose.vps.yml` định cấu hình chạy container Backend Hono và Redis độc lập để chịu tải cao.

