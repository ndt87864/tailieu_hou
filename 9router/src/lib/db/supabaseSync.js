import { TABLES } from "./schema.js";

// Hỗ trợ kiểm tra xem Supabase đã được cấu hình chưa
export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return !!(url && key);
}

/**
 * Đồng bộ toàn bộ dữ liệu từ Supabase online về SQLite local (PULL)
 * Thường chạy lúc khởi động server để đảm bảo local có cấu hình mới nhất.
 */
export async function pullFromSupabase(db) {
  if (!isSupabaseConfigured()) return { success: false, error: "Supabase not configured" };

  const username = db.username || "admin";
  const { supabase } = await import("../supabaseClient.js");
  console.log(`[Supabase Sync][${username}] Bắt đầu đồng bộ dữ liệu từ online về offline...`);
  const tablesToPull = [
    "_meta",
    "settings",
    "providerConnections",
    "providerNodes",
    "proxyPools",
    "apiKeys",
    "combos",
    "kv",
    "usageDaily",
    "usageHistory",
    "requestDetails",
    "scannerHistory"
  ];

  let successCount = 0;
  let errors = [];

  for (const tableName of tablesToPull) {
    try {
      // Bỏ qua bảng chưa được định nghĩa trong local schema
      if (!TABLES[tableName]) {
        console.warn(`[Supabase Sync][${username}] Bảng "${tableName}" không có trong schema local, bỏ qua.`);
        continue;
      }

      // 1. Fetch dữ liệu từ Supabase online lọc theo username
      let supabaseTable = tableName;
      let data, error;
      
      const res1 = await supabase.from(supabaseTable).select("*").eq("username", username);
      if (res1.error) {
        console.warn(`[Supabase Sync][${username}] Pull lỗi bảng "${tableName}" (lần 1): ${res1.error.message}`);
        if (tableName !== tableName.toLowerCase()) {
          // Fallback sang tên bảng viết thường
          supabaseTable = tableName.toLowerCase();
          const res2 = await supabase.from(supabaseTable).select("*").eq("username", username);
          data = res2.data;
          error = res2.error;
          if (error) console.warn(`[Supabase Sync][${username}] Pull lỗi bảng "${supabaseTable}" (lần 2): ${error.message}`);
        } else {
          data = res1.data;
          error = res1.error;
        }
      } else {
        data = res1.data;
        error = res1.error;
      }

      if (error) throw error;

      if (!data || data.length === 0) {
        // Nếu online chưa có dữ liệu thì bỏ qua, giữ nguyên offline
        console.log(`[Supabase Sync][${username}] Bảng "${tableName}" online trống, giữ nguyên local.`);
        continue;
      }

      console.log(`[Supabase Sync][${username}] Đang pull bảng "${tableName}" (${data.length} dòng)...`);

      // 2. Chèn dữ liệu vào SQLite local (dùng transaction để an toàn)
      db.transaction(() => {
        // Xóa sạch dữ liệu cũ trong bảng SQLite cục bộ
        db.exec(`DELETE FROM "${tableName}"`);

        // Chuẩn bị câu lệnh chèn dữ liệu
        const cols = Object.keys(TABLES[tableName].columns);
        const placeholders = cols.map(() => "?").join(", ");
        const insertSql = `INSERT OR REPLACE INTO "${tableName}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders})`;

        for (const row of data) {
          const values = cols.map(col => {
            let val = row[col];
            if (val === undefined) {
              // Hỗ trợ cả trường hợp cột viết thường trên Supabase (vd: filetype, createdat)
              val = row[col.toLowerCase()];
            }
            // Boolean hoặc Number
            if (typeof val === "boolean") return val ? 1 : 0;
            if (val === null || val === undefined) return null;
            // JSON fields — Supabase JSONB trả về object, cần stringify lại cho SQLite TEXT
            if (typeof val === "object") return JSON.stringify(val);
            return val;
          });
          try {
            db.run(insertSql, values);
          } catch (rowErr) {
            console.error(`[Supabase Sync][${username}] Lỗi insert row vào "${tableName}":`, rowErr.message, '| values:', JSON.stringify(values).slice(0, 200));
          }
        }
      });

      // Verify the data was actually inserted
      const count = db.get ? db.get(`SELECT COUNT(*) as n FROM "${tableName}"`) : null;
      console.log(`[Supabase Sync][${username}] Pull thành công bảng: ${tableName} (${data.length} dòng từ Supabase, ${count?.n ?? '?'} dòng trong SQLite)`);
      successCount++;
    } catch (err) {
      console.error(`[Supabase Sync][${username}] Lỗi khi pull bảng ${tableName}:`, err.message);
      errors.push({ table: tableName, error: err.message });
    }
  }

  return {
    success: errors.length === 0,
    pulledTablesCount: successCount,
    errors
  };
}

/**
 * Đồng bộ toàn bộ dữ liệu của một bảng từ SQLite local lên Supabase online (PUSH TABLE)
 */
export async function syncTableToSupabase(db, tableName) {
  if (!isSupabaseConfigured()) return;

  const username = db.username || "admin";
  const { supabase } = await import("../supabaseClient.js");
  try {
    // 1. Đọc dữ liệu từ SQLite
    const rows = db.all(`SELECT * FROM "${tableName}"`);
    if (!rows || rows.length === 0) {
      // Nếu local rỗng, xóa sạch trên Supabase để đồng nhất (hoặc bỏ qua)
      let resDelete = await supabase.from(tableName).delete().eq("username", username);
      if (resDelete.error) {
        // Fallback sang table viết thường
        await supabase.from(tableName.toLowerCase()).delete().eq("username", username);
      }
      console.log(`[Supabase Sync][${username}] Xóa sạch dữ liệu bảng ${tableName} trên Supabase do local rỗng.`);
      return;
    }

    // 2. Định dạng dữ liệu tương thích với Postgres (JSON string -> Object)
    const formattedRows = rows.map(row => {
      const formatted = { ...row, username };
      
      // Prevent id sequence conflicts for log tables like usageHistory
      if (tableName.toLowerCase() === "usagehistory") {
        if (!formatted.id || formatted.id < 100000000) {
          formatted.id = Math.floor(Math.random() * 1000000000) + 1000000000;
        }
      }

      // Chuyển đổi các cột sang đúng kiểu dữ liệu của Postgres
      for (const [col, val] of Object.entries(formatted)) {
        // Chuyển đổi isActive từ 1/0 sang true/false cho Postgres
        if (col === "isActive") {
          formatted[col] = val === 1 || val === true;
          continue;
        }
        // Nếu là cột JSON thì parse ra thành object trước khi gửi lên Supabase
        if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
          try {
            formatted[col] = JSON.parse(val);
          } catch {
            // Giữ nguyên chuỗi nếu parse lỗi
          }
        }
      }
      return formatted;
    });

    // 3. Upsert lên Supabase
    let resUpsert = await supabase.from(tableName).upsert(formattedRows);
    
    // Fallback nếu có lỗi và tableName có chữ hoa
    if (resUpsert.error && tableName !== tableName.toLowerCase()) {
      const lowercaseRows = formattedRows.map(row => {
        const lowercaseRow = {};
        for (const [k, v] of Object.entries(row)) {
          lowercaseRow[k.toLowerCase()] = v;
        }
        return lowercaseRow;
      });
      resUpsert = await supabase.from(tableName.toLowerCase()).upsert(lowercaseRows);
    }

    if (resUpsert.error) throw resUpsert.error;

    console.log(`[Supabase Sync][${username}] Auto-Push thành công bảng: ${tableName} (${rows.length} dòng)`);
  } catch (err) {
    console.error(`[Supabase Sync][${username}] Auto-Push bảng ${tableName} thất bại:`, err.message);
  }
}

/**
 * Đẩy một bản ghi cụ thể lên Supabase. Hữu ích cho các bảng ghi nhật ký (Log) lớn chỉ có INSERT như usageHistory, requestDetails.
 */
export async function pushRecordToSupabase(tableName, record, username = "admin") {
  if (!isSupabaseConfigured()) return;

  const { supabase } = await import("../supabaseClient.js");
  try {
    const formatted = { ...record, username };

    const isUsageHistory = tableName.toLowerCase() === "usagehistory";
    let retries = 5;
    let res;

    while (retries > 0) {
      if (isUsageHistory) {
        // Generate a random ID with an extremely wide range to avoid collision (1B to 9B)
        formatted.id = Math.floor(Math.random() * 8000000000) + 1000000000;
      }

      // Khớp các cột JSON
      for (const [col, val] of Object.entries(formatted)) {
        if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
          try {
            formatted[col] = JSON.parse(val);
          } catch {}
        }
      }

      // Thử chèn với tên bảng gốc
      res = await supabase.from(tableName).insert([formatted]);
      
      // Nếu có lỗi và tableName có chữ hoa, thử tên bảng và cột viết thường
      if (res.error && tableName !== tableName.toLowerCase()) {
        const lowercaseFormatted = {};
        for (const [k, v] of Object.entries(formatted)) {
          lowercaseFormatted[k.toLowerCase()] = v;
        }
        res = await supabase.from(tableName.toLowerCase()).insert([lowercaseFormatted]);
      }

      if (res.error) {
        const errMsg = String(res.error.message || "");
        if (isUsageHistory && (errMsg.includes("duplicate key") || errMsg.includes("violates unique constraint"))) {
          retries--;
          continue;
        }
      }
      break;
    }

    if (res.error) throw res.error;
  } catch (err) {
    console.error(`[Supabase Sync][${username}] Push record lên ${tableName} thất bại:`, err.message);
  }
}

/**
 * Kích hoạt đồng bộ hóa tức thời cho một bảng cấu hình lên Supabase.
 * Việc này chạy bất đồng bộ và không làm chặn các yêu cầu khác.
 */
const pushQueue = new Map(); // tableName -> { activePromise: Promise, hasPending: boolean }

export function queueTablePush(db, tableName) {
  if (!isSupabaseConfigured()) return;

  // Tránh đồng bộ liên tục các bảng log lớn bằng phương pháp upsert nguyên bảng
  const lowerTableName = tableName.toLowerCase();
  if (lowerTableName === "usagehistory" || lowerTableName === "requestdetails" || lowerTableName === "scannerhistory") {
    return;
  }

  let queue = pushQueue.get(tableName);
  if (!queue) {
    queue = { activePromise: null, hasPending: false };
    pushQueue.set(tableName, queue);
  }

  const runPush = async () => {
    queue.activePromise = syncTableToSupabase(db, tableName);
    try {
      await queue.activePromise;
    } catch (err) {
      console.error(`[Supabase Sync] Ghi bảng ${tableName} lên Supabase thất bại:`, err.message);
    } finally {
      queue.activePromise = null;
      if (queue.hasPending) {
        queue.hasPending = false;
        // Thực hiện đẩy lại với dữ liệu mới nhất trong cache
        runPush();
      }
    }
  };

  if (queue.activePromise) {
    // Nếu đang có tiến trình đồng bộ hoạt động, đánh dấu để chạy lại ngay sau khi hoàn thành
    queue.hasPending = true;
  } else {
    // Chạy đồng bộ ngay lập tức
    runPush();
  }
}

/**
 * Bọc (Wrap) database adapter để tự động hook các lệnh WRITE (run/exec)
 * và kích hoạt đồng bộ hóa lên Supabase một cách thông minh.
 */
export function wrapAdapterWithSupabaseSync(adapter) {
  if (!isSupabaseConfigured()) return adapter;

  const originalRun = adapter.run;
  const originalExec = adapter.exec;

  // Hook phương thức run()
  adapter.run = function (sql, params = []) {
    const res = originalRun.call(adapter, sql, params);

    try {
      const insertMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+"?(\w+)"?/i);
      const updateMatch = sql.match(/UPDATE\s+"?(\w+)"?/i);
      const deleteMatch = sql.match(/DELETE\s+FROM\s+"?(\w+)"?/i);

      const tableName = (insertMatch?.[1] || updateMatch?.[1] || deleteMatch?.[1]);

      if (tableName) {
        const lowerTable = tableName.toLowerCase();
        if (lowerTable === "usagehistory" || lowerTable === "requestdetails" || lowerTable === "scannerhistory") {
          const rowId = res?.lastInsertRowid;
          if (rowId) {
            // Push bất đồng bộ để tránh ảnh hưởng độ trễ của API chính
            setTimeout(async () => {
              try {
                const record = adapter.get(`SELECT * FROM "${tableName}" WHERE rowid = ?`, [rowId]);
                if (record) {
                  await pushRecordToSupabase(tableName, record, adapter.username);
                }
              } catch (e) {
                console.error(`[Supabase Sync] Lỗi push log record cho ${tableName}:`, e.message);
              }
            }, 50);
          }
        } else {
          // Bảng cấu hình thường có kích thước rất nhỏ, trigger debounce đẩy nguyên bảng lên
          queueTablePush(adapter, tableName);
        }
      }
    } catch (e) {
      console.error("[Supabase Sync] Lỗi trong hook run():", e.message);
    }

    return res;
  };

  // Hook phương thức exec()
  adapter.exec = function (sql) {
    const res = originalExec.call(adapter, sql);

    try {
      const tables = [
        "settings",
        "providerConnections",
        "providerNodes",
        "proxyPools",
        "apiKeys",
        "combos",
        "kv"
      ];
      for (const table of tables) {
        if (sql.includes(table)) {
          queueTablePush(adapter, table);
        }
      }
    } catch (e) {
      console.error("[Supabase Sync] Lỗi trong hook exec():", e.message);
    }

    return res;
  };

  return adapter;
}
