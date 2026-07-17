import { supabase } from "../../supabaseClient.js";
import redis from "../../redisClient.js";
import crypto from "crypto";

const memoryStore = new Map();

function getQueryCacheKey(username, tableName, sql, params) {
  const hash = crypto.createHash("sha256").update(sql + ":" + JSON.stringify(params)).digest("hex");
  return `dbcache:${username}:${tableName.toLowerCase()}:${hash}`;
}

async function invalidateTableCache(username, tableName) {
  const cleanTable = String(tableName || "").trim().toLowerCase();
  
  // 1. Invalidate Redis Cache
  if (typeof redis.get === "function") {
    const setKey = `9router:dbcache:keys:${username}:${cleanTable}`;
    try {
      const keys = await redis.smembers(setKey);
      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.del(setKey);
    } catch (e) {
      console.warn(`[Redis Cache] Failed to invalidate cache for table ${cleanTable}:`, e.message);
    }
  }

  // 2. Invalidate memoryStore Cache
  const memoryPrefix = `dbcache:${username}:${cleanTable}:`;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(memoryPrefix)) {
      memoryStore.delete(key);
    }
  }
}

export function createSupabaseAdapter(username) {
  const cleanUsername = String(username || "admin").trim().toLowerCase();

  // Clean table name (remove double or single quotes)
  function cleanTableName(table) {
    return table.replace(/["']/g, '');
  }

  // Parse WHERE clause to extract filters and associate with param values
  function parseWhere(whereStr, params, paramIndexRef) {
    if (!whereStr) return [];
    // Split by AND
    const parts = whereStr.split(/\s+AND\s+/i);
    const filters = [];
    for (const part of parts) {
      const trimmed = part.trim();
      // Match column = ?, column >= ?, column <= ?, etc., or string literals
      const match = trimmed.match(/^(\w+)\s*(=|>=|<=|>|<|!=)\s*(\?|\d+|'.*?'|".*?")/i);
      if (match) {
        const col = match[1];
        const op = match[2];
        let val = match[3];
        if (val === '?') {
          val = params[paramIndexRef.idx++];
        } else if (val.startsWith("'") || val.startsWith('"')) {
          val = val.slice(1, -1);
        } else if (!isNaN(val) && val.trim() !== '') {
          val = Number(val);
        }
        filters.push({ col, op, val });
      }
    }
    return filters;
  }

  function splitSqlList(value) {
    const items = [];
    let current = "";
    let quote = null;

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote) {
        current += ch;
        if (ch === quote && value[i - 1] !== "\\") quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        current += ch;
        continue;
      }
      if (ch === ",") {
        items.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }

    if (current.trim() || value.endsWith(",")) items.push(current.trim());
    return items;
  }

  function parseSqlValueToken(token, params, paramIndexRef) {
    const raw = String(token ?? "").trim();
    if (raw === "?") return params[paramIndexRef.idx++];
    if (/^null$/i.test(raw)) return null;
    if (/^true$/i.test(raw)) return true;
    if (/^false$/i.test(raw)) return false;
    if (
      (raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))
    ) {
      return raw.slice(1, -1);
    }
    if (!Number.isNaN(Number(raw)) && raw !== "") return Number(raw);
    return raw;
  }

  // Parse SQL and execute on Supabase. Supports retry for lowercase table fallback.
  async function executeWithFallback(table, executeQueryFn) {
    try {
      const res = await executeQueryFn(table);
      if (res.error && table !== table.toLowerCase()) {
        const errCode = String(res.error.code || "");
        const errMsg = String(res.error.message || "");
        const isTableNotFound = errCode === "42P01" || 
                                errCode.startsWith("PGRST") || 
                                errMsg.includes("schema cache") ||
                                errMsg.includes("Could not find the table");
        
        if (isTableNotFound) {
          // Fallback to lowercase table name
          const retryRes = await executeQueryFn(table.toLowerCase());
          if (retryRes.error) throw new Error(retryRes.error.message);
          return retryRes.data;
        }
      }
      if (res.error) throw new Error(res.error.message);
      return res.data;
    } catch (err) {
      throw new Error(`[Supabase Adapter][${table}] Execution failed: ${err.message}`);
    }
  }

  // Parse SQL query and return Supabase query promise
  async function executeQuery(sql, params = []) {
    const trimmedSql = sql.trim();
    const paramIndexRef = { idx: 0 };

    // 1. SELECT
    const selectMatch = trimmedSql.match(/^SELECT\s+(.+?)\s+FROM\s+["']?(\w+)["']?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\?|\d+))?$/i);
    if (selectMatch) {
      const selectCols = selectMatch[1].trim();
      const table = cleanTableName(selectMatch[2]);
      const whereStr = selectMatch[3];
      const orderByStr = selectMatch[4];
      const limitStr = selectMatch[5];

      const cacheKey = getQueryCacheKey(cleanUsername, table, trimmedSql, params);

      let cachedVal = null;
      let redisFailed = false;
      if (typeof redis.get === "function") {
        try {
          cachedVal = await redis.get("9router:" + cacheKey);
        } catch (e) {
          console.warn("[Redis Cache] Read error, falling back to memoryStore:", e.message);
          redisFailed = true;
        }
      }

      if (cachedVal) {
        return JSON.parse(cachedVal);
      }

      if (redisFailed || typeof redis.get !== "function") {
        const entry = memoryStore.get(cacheKey);
        if (entry) {
          if (Date.now() < entry.expiresAt) {
            return entry.data;
          }
          memoryStore.delete(cacheKey);
        }
      }

      let selectFields = selectCols;
      if (selectFields === '1') {
        selectFields = '*'; // PostgREST doesn't support SELECT 1
      }

      // Handle COUNT(*)
      const isCount = selectCols.toUpperCase().includes('COUNT(*)');

      const executeSelect = async (tableName) => {
        let query;
        if (isCount) {
          query = supabase.from(tableName).select('*', { count: 'exact', head: true });
        } else {
          query = supabase.from(tableName).select(selectFields);
        }

        // Scope by username
        query = query.eq('username', cleanUsername);

        // Apply WHERE filters
        if (whereStr) {
          const filters = parseWhere(whereStr, params, paramIndexRef);
          for (const filter of filters) {
            let col = filter.col;
            let val = filter.val;
            if (col === 'isactive' || col === 'isActive') {
              val = (val === 1 || val === '1' || val === true || val === 'true');
            }
            if (filter.op === '=') query = query.eq(col, val);
            else if (filter.op === '>=') query = query.gte(col, val);
            else if (filter.op === '<=') query = query.lte(col, val);
            else if (filter.op === '>') query = query.gt(col, val);
            else if (filter.op === '<') query = query.lt(col, val);
            else if (filter.op === '!=') query = query.neq(col, val);
          }
        }

        // Order by
        if (orderByStr) {
          const orderMatch = orderByStr.match(/(\w+)\s+(ASC|DESC)/i);
          if (orderMatch) {
            let orderCol = orderMatch[1];
            query = query.order(orderCol, { ascending: orderMatch[2].toUpperCase() === 'ASC' });
          } else {
            let orderCol = orderByStr.trim();
            query = query.order(orderCol);
          }
        }

        // Limit
        if (limitStr) {
          let lim = limitStr;
          if (lim === '?') {
            lim = params[paramIndexRef.idx++];
          } else {
            lim = parseInt(lim, 10);
          }
          query = query.limit(lim);
        }

        if (isCount) {
          const { count, error } = await query;
          return { data: count, error };
        } else {
          return await query;
        }
      };

      const resultData = await executeWithFallback(table, executeSelect);

      let finalResult;
      if (isCount) {
        finalResult = [{ n: resultData || 0 }];
      } else if (selectCols === '1') {
        finalResult = resultData.length ? resultData.map(() => ({ '1': 1 })) : [];
      } else {
        // Map rows (JSON parsing and normalizations)
        finalResult = resultData.map(row => {
          const mapped = {};
          for (const [key, value] of Object.entries(row)) {
            // Normalize column names back to original camelCase if lowercase was returned
            let mappedKey = key;
            if (key === 'isactive') mappedKey = 'isActive';
            else if (key === 'authtype') mappedKey = 'authType';
            else if (key === 'createdat') mappedKey = 'createdAt';
            else if (key === 'updatedat') mappedKey = 'updatedAt';
            else if (key === 'machineid') mappedKey = 'machineId';
            else if (key === 'datekey') mappedKey = 'dateKey';
            else if (key === 'filetype') mappedKey = 'fileType';
            else if (key === 'prompttokens') mappedKey = 'promptTokens';
            else if (key === 'completiontokens') mappedKey = 'completionTokens';
            else if (key === 'connectionid') mappedKey = 'connectionId';
            else if (key === 'apikey') mappedKey = 'apiKey';

            // Handle Boolean
            if (mappedKey === 'isActive') {
              mapped[mappedKey] = (value === true || value === 1 || value === 'true') ? 1 : 0;
            } else {
              mapped[mappedKey] = value;
            }
          }
          delete mapped.username; // Hide username partition column
          return mapped;
        });
      }

      let saveToMemory = typeof redis.get !== "function";
      if (typeof redis.get === "function") {
        try {
          const redisKey = "9router:" + cacheKey;
          const setKey = `9router:dbcache:keys:${cleanUsername}:${table.toLowerCase()}`;
          // Cache persistence is deliberately off the request critical path.
          // The response can use the in-process result while Redis is updated.
          void Promise.all([
            redis.setex(redisKey, 600, JSON.stringify(finalResult)),
            redis.sadd(setKey, redisKey),
            redis.expire(setKey, 86400),
          ]).catch((e) => {
            console.warn("[Redis Cache] Write error:", e.message);
          });
        } catch (e) {
          console.warn("[Redis Cache] Write error, falling back to memoryStore:", e.message);
          saveToMemory = true;
        }
      }

      if (saveToMemory) {
        if (memoryStore.size >= 500) {
          const now = Date.now();
          for (const [key, entry] of memoryStore.entries()) {
            if (now >= entry.expiresAt) {
              memoryStore.delete(key);
            }
          }
          if (memoryStore.size >= 500) {
            // If still full, drop oldest entries (first key returned by Map.prototype.keys())
            const firstKey = memoryStore.keys().next().value;
            if (firstKey) memoryStore.delete(firstKey);
          }
        }
        memoryStore.set(cacheKey, {
          data: finalResult,
          expiresAt: Date.now() + 600000 // 10 minutes TTL (600,000 ms)
        });
      }

      return finalResult;
    }

    // 2. INSERT / UPSERT
    const insertMatch = trimmedSql.match(/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["']?(\w+)["']?\s*\((.+?)\)\s*VALUES\s*\((.+?)\)/i);
    if (insertMatch) {
      const table = cleanTableName(insertMatch[1]);
      const colsStr = insertMatch[2];
      const valuesStr = insertMatch[3];
      const cols = colsStr.split(',').map(c => c.trim().replace(/["']/g, ''));
      const valueTokens = splitSqlList(valuesStr);

      const isUpsert = trimmedSql.toUpperCase().includes('ON CONFLICT') || trimmedSql.toUpperCase().includes('OR REPLACE');

      const executeInsert = async (tableName) => {
        const obj = { username: cleanUsername };
        const valueParamIndexRef = { idx: 0 };
        cols.forEach((col, i) => {
          let val = parseSqlValueToken(valueTokens[i] ?? "?", params, valueParamIndexRef);
          let pgCol = col;

          if (col === 'isActive') {
            val = (val === 1 || val === true || val === 'true');
          }
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try {
              val = JSON.parse(val);
            } catch {}
          }
          obj[pgCol] = val;
        });

        const isUsageHistory = tableName.toLowerCase() === "usagehistory";
        let retries = 5;
        let res;

        while (retries > 0) {
          if (isUsageHistory) {
            // Generate a random ID with an extremely wide range to avoid collision (1B to 9B)
            obj.id = Math.floor(Math.random() * 8000000000) + 1000000000;
          }

          let query;
          if (isUpsert) {
            query = supabase.from(tableName).upsert(obj);
          } else {
            query = supabase.from(tableName).insert(obj);
          }
          res = await query.select();

          if (res.error) {
            const errMsg = String(res.error.message || "");
            if (isUsageHistory && (errMsg.includes("duplicate key") || errMsg.includes("violates unique constraint"))) {
              retries--;
              continue;
            }
          }
          break;
        }

        return res;
      };

      const data = await executeWithFallback(table, executeInsert);
      await invalidateTableCache(cleanUsername, table);
      const firstRow = data?.[0] || {};
      const lastInsertRowid = firstRow.id || firstRow.rowid || firstRow.datekey || firstRow.key || null;
      return { changes: data ? data.length : 1, lastInsertRowid };
    }

    // 3. UPDATE
    const updateMatch = trimmedSql.match(/^UPDATE\s+["']?(\w+)["']?\s+SET\s+(.+?)\s+WHERE\s+(.+?)$/i);
    if (updateMatch) {
      const table = cleanTableName(updateMatch[1]);
      const setStr = updateMatch[2];
      const whereStr = updateMatch[3];

      const executeUpdate = async (tableName) => {
        const setParts = setStr.split(',');
        const updateObj = {};
        for (const part of setParts) {
          const match = part.trim().match(/^(\w+)\s*=\s*(\?|\d+|'.*?'|".*?")/);
          if (match) {
            const col = match[1];
            let val = match[2];
            if (val === '?') {
              val = params[paramIndexRef.idx++];
            } else if (val.startsWith("'") || val.startsWith('"')) {
              val = val.slice(1, -1);
            } else if (!isNaN(val) && val.trim() !== '') {
              val = Number(val);
            }

            let pgCol = col;

            if (col === 'isActive') {
              val = (val === 1 || val === true || val === 'true');
            }
            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
              try {
                val = JSON.parse(val);
              } catch {}
            }
            updateObj[pgCol] = val;
          }
        }

        let query = supabase.from(tableName).update(updateObj).eq('username', cleanUsername);
        if (whereStr) {
          const filters = parseWhere(whereStr, params, paramIndexRef);
          for (const filter of filters) {
            let col = filter.col;
            let val = filter.val;
            if (col === 'isactive' || col === 'isActive') {
              val = (val === 1 || val === '1' || val === true || val === 'true');
            }
            query = query.eq(col, val);
          }
        }
        return await query.select();
      };

      // Reset paramIndexRef for SET and WHERE evaluation order
      const data = await executeWithFallback(table, executeUpdate);
      await invalidateTableCache(cleanUsername, table);
      return { changes: data ? data.length : 1 };
    }

    // 4. DELETE
    const deleteMatch = trimmedSql.match(/^DELETE\s+FROM\s+["']?(\w+)["']?(?:\s+WHERE\s+(.+?))?$/i);
    if (deleteMatch) {
      const table = cleanTableName(deleteMatch[1]);
      const whereStr = deleteMatch[2];

      const executeDelete = async (tableName) => {
        let query = supabase.from(tableName).delete().eq('username', cleanUsername);
        if (whereStr) {
          const filters = parseWhere(whereStr, params, paramIndexRef);
          for (const filter of filters) {
            let col = filter.col;
            let val = filter.val;
            if (col === 'isactive' || col === 'isActive') {
              val = (val === 1 || val === '1' || val === true || val === 'true');
            }
            query = query.eq(col, val);
          }
        }
        return await query.select();
      };

      const data = await executeWithFallback(table, executeDelete);
      await invalidateTableCache(cleanUsername, table);
      return { changes: data ? data.length : 1 };
    }

    throw new Error(`[Supabase Adapter] Unsupported SQL statement: ${sql}`);
  }

  // Adapter Interface Implementation
  async function run(sql, params = []) {
    return executeQuery(sql, params);
  }

  async function get(sql, params = []) {
    const rows = await executeQuery(sql, params);
    return rows[0];
  }

  async function all(sql, params = []) {
    return executeQuery(sql, params);
  }

  async function exec(sql) {
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE') || stmt.toUpperCase().startsWith('PRAGMA')) {
        continue; // Managed by direct PostgreSQL schema setup on Supabase Dashboard
      }
      await executeQuery(stmt);
    }
  }

  async function transaction(fn) {
    // Run sequentially without nested transactional locking since we are querying a cloud db over HTTP
    return await fn();
  }

  function close() {
    // No-op
  }

  return {
    driver: "supabase",
    username: cleanUsername,
    run,
    get,
    all,
    exec,
    transaction,
    close
  };
}
