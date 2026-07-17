# Hướng dẫn liên kết Cơ sở dữ liệu với Supabase cho VeloRoute

Tài liệu này hướng dẫn chi tiết cách cài đặt, cấu hình biến môi trường, khởi tạo các bảng dữ liệu trên Supabase, và liên kết cơ sở dữ liệu của bạn với Supabase.

---

## Bước 1: Khởi tạo các bảng dữ liệu trên Supabase

Supabase sử dụng hệ quản trị cơ sở dữ liệu PostgreSQL. Chúng tôi đã chuyển đổi cấu trúc database SQLite hiện tại của VeloRoute sang PostgreSQL DDL tương thích hoàn toàn.

1. Truy cập vào [Supabase Dashboard](https://supabase.com/dashboard) và chọn dự án của bạn.
2. Điều hướng đến mục **SQL Editor** ở thanh menu bên trái.
3. Chọn **New Query** (hoặc tạo một tab truy vấn mới).
4. Mở file `supabase-schema.sql` nằm ở thư mục gốc của dự án (`D:\veloroute\supabase-schema.sql`).
5. Copy toàn bộ nội dung của file đó và dán vào SQL Editor trên Supabase.
6. Bấm nút **Run** để khởi tạo tất cả các bảng dữ liệu cùng với các chỉ mục (indexes) cần thiết.

---

## Bước 2: Thiết lập biến môi trường (Environment Variables)

Chúng tôi đã cập nhật cấu hình biến môi trường trong file `.env.example` và tự động tạo/cập nhật file `.env` ở thư mục gốc của bạn.

Hãy mở file `.env` ra và điền thông tin API của dự án Supabase:

```env
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-reference>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

*Lưu ý:* Bạn có thể tìm thấy các thông tin này tại Supabase Dashboard dưới mục **Project Settings** > **API**.

---

## Bước 3: Cài đặt thư viện kết nối Supabase

Do quy định bảo mật hệ thống, AI không được phép tự động chạy lệnh cài đặt package. Bạn vui lòng tự mở Terminal trong thư mục gốc của dự án (`D:\veloroute`) và chạy lệnh sau để cài đặt SDK Supabase:

```bash
npm install @supabase/supabase-js
```

---

## Bước 4: Cách sử dụng Supabase Client trong mã nguồn

Chúng tôi đã tạo sẵn file client helper tại `src/lib/supabaseClient.js`. Bạn có thể dễ dàng import và tương tác với Supabase từ bất kỳ component hoặc API route nào trong Next.js:

### Ví dụ 1: Đọc cấu hình settings từ Supabase
```javascript
import { supabase } from '@/lib/supabaseClient';

async function getSettingsFromSupabase() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Lỗi khi lấy dữ liệu settings:', error);
    return null;
  }
  return JSON.parse(data.data); // Dữ liệu được lưu dưới dạng JSON String giống như SQLite
}
```

### Ví dụ 2: Lưu lịch sử sử dụng (Usage History) lên Supabase
```javascript
import { supabase } from '@/lib/supabaseClient';

async function saveUsageHistory(historyRecord) {
  const { data, error } = await supabase
    .from('usageHistory')
    .insert([
      {
        timestamp: new Date().toISOString(),
        provider: historyRecord.provider,
        model: historyRecord.model,
        connectionId: historyRecord.connectionId,
        apiKey: historyRecord.apiKey,
        endpoint: historyRecord.endpoint,
        promptTokens: historyRecord.promptTokens,
        completionTokens: historyRecord.completionTokens,
        cost: historyRecord.cost,
        status: historyRecord.status,
        tokens: JSON.stringify(historyRecord.tokens),
        meta: JSON.stringify(historyRecord.meta)
      }
    ]);

  if (error) {
    console.error('Lỗi khi lưu lịch sử:', error);
  }
}
```

### Ví dụ 3: Đồng bộ dữ liệu hiện tại từ SQLite lên Supabase (Data Migration/Sync)
Bạn có thể tạo một script đồng bộ hóa dữ liệu từ file SQLite cục bộ lên Supabase bằng cách đọc dữ liệu thông qua SQLite driver cục bộ và tải lên Supabase bằng Client trên.

---
Chúc bạn thực hiện liên kết thành công! Nếu cần thêm bất kỳ sự trợ giúp nào khác, hãy thoải mái đặt câu hỏi.
