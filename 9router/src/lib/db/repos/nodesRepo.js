import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

// In-memory cache for provider nodes with 10-second TTL
let nodesCache = null;
let nodesCacheTime = 0;
const NODES_CACHE_TTL_MS = 10000;

function rowToNode(row) {
  if (!row) return null;
  const extra = parseJson(row.data, {});
  return {
    ...extra,
    id: row.id,
    type: row.type,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function nodeToRow(n) {
  const { id, type, name, createdAt, updatedAt, ...rest } = n;
  return {
    id,
    type: type ?? null,
    name: name ?? null,
    data: stringifyJson(rest),
    createdAt,
    updatedAt,
  };
}

async function upsert(db, n) {
  const r = nodeToRow(n);
  await db.run(
    `INSERT INTO providerNodes(id, type, name, data, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type=excluded.type, name=excluded.name, data=excluded.data, updatedAt=excluded.updatedAt`,
    [r.id, r.type, r.name, r.data, r.createdAt, r.updatedAt]
  );
}

export async function getProviderNodes(filter = {}) {
  const now = Date.now();
  // Return cached nodes if still valid and no specific filter
  if (nodesCache && (now - nodesCacheTime) < NODES_CACHE_TTL_MS && !filter.type) {
    return nodesCache;
  }
  // Fetch fresh nodes
  const db = await getAdapter();
  const where = [];
  const params = [];
  if (filter.type) { where.push("type = ?"); params.push(filter.type); }
  const sql = `SELECT * FROM providerNodes${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`;
  const rows = await db.all(sql, params);
  const result = rows.map(rowToNode);
  // Update cache if no specific filter
  if (!filter.type) {
    nodesCache = result;
    nodesCacheTime = now;
  }
  return result;
}

export async function getProviderNodeById(id) {
  const db = await getAdapter();
  const row = await db.get(`SELECT * FROM providerNodes WHERE id = ?`, [id]);
  return rowToNode(row);
}

export async function createProviderNode(data) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const node = {
    id: data.id || uuidv4(),
    type: data.type,
    name: data.name,
    prefix: data.prefix,
    apiType: data.apiType,
    baseUrl: data.baseUrl,
    createdAt: now,
    updatedAt: now,
  };
  await upsert(db, node);
  // Invalidate cache
  nodesCache = null;
  nodesCacheTime = 0;
  return node;
}

export async function updateProviderNode(id, data) {
  const db = await getAdapter();
  let result = null;
  await db.transaction(async () => {
    const row = await db.get(`SELECT * FROM providerNodes WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToNode(row), ...data, updatedAt: new Date().toISOString() };
    await upsert(db, merged);
    result = merged;
  });
  // Invalidate cache
  nodesCache = null;
  nodesCacheTime = 0;
  return result;
}

export async function deleteProviderNode(id) {
  const db = await getAdapter();
  let removed = null;
  await db.transaction(async () => {
    const row = await db.get(`SELECT * FROM providerNodes WHERE id = ?`, [id]);
    if (!row) return;
    removed = rowToNode(row);
    await db.run(`DELETE FROM providerNodes WHERE id = ?`, [id]);
  });
  // Invalidate cache
  nodesCache = null;
  nodesCacheTime = 0;
  return removed;
}
