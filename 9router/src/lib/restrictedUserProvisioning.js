import { v4 as uuidv4 } from "uuid";
import { getAdapterForUsername } from "./db/driver.js";
import { generateApiKeyWithMachine } from "../shared/utils/apiKey.js";
import { normalizeUsername, isRestrictedUser, getRestrictedUsers } from "./userResourceMapping.js";
import { getConsistentMachineId } from "../shared/utils/machineId.js";

const RESOURCE_OWNER = "minh";
const provisionLocks = new Map();

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  return JSON.stringify(value ?? {});
}

function isActiveValue(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function cleanConnectionData(data, sourceId) {
  const cleaned = { ...(data || {}) };
  for (const key of Object.keys(cleaned)) {
    if (
      key.startsWith("modelLock_") ||
      key === "lastError" ||
      key === "lastErrorAt" ||
      key === "errorCode" ||
      key === "rateLimitedUntil" ||
      key === "backoffLevel" ||
      key === "consecutiveUseCount" ||
      key === "lastUsedAt" ||
      key === "activeUseByUsername" ||
      key === "activeUseUntil" ||
      key === "testStatus"
    ) {
      delete cleaned[key];
    }
  }
  cleaned.sourceOwnerUsername = RESOURCE_OWNER;
  cleaned.sourceConnectionId = sourceId;
  return cleaned;
}

function connectionFingerprint(row) {
  const data = parseJson(row.data, {});
  return [
    data.sourceConnectionId || row.id || "",
    row.provider || "",
    row.authType || "",
    row.name || "",
    row.email || "",
  ].join("|");
}

function comboFingerprint(row) {
  return String(row.name || "").trim().toLowerCase();
}

function sourceConnectionId(row) {
  return parseJson(row.data, {})?.sourceConnectionId || "";
}

function isSyncedConnection(row) {
  const data = parseJson(row.data, {});
  return data.sourceOwnerUsername === RESOURCE_OWNER && !!data.sourceConnectionId;
}

async function syncProviderConnections(sourceDb, targetDb) {
  const [sourceRows, targetRows] = await Promise.all([
    sourceDb.all(`SELECT * FROM providerConnections`),
    targetDb.all(`SELECT * FROM providerConnections`),
  ]);

  const sourceRowsToSync = sourceRows.filter((row) => row.provider !== "luna");

  const targetBySourceId = new Map();
  const targetByFingerprint = new Map();
  for (const row of targetRows) {
    const sid = sourceConnectionId(row);
    if (sid) targetBySourceId.set(sid, row);
    targetByFingerprint.set(connectionFingerprint(row), row);
  }

  const sourceIds = new Set(sourceRows.map((row) => row.id).filter(Boolean));
  let created = 0;
  let updated = 0;

  for (const row of sourceRowsToSync) {
    const sourceData = parseJson(row.data, {});
    const existing = targetBySourceId.get(row.id) || targetByFingerprint.get(connectionFingerprint(row));
    const now = new Date().toISOString();
    const data = cleanConnectionData(sourceData, row.id);

    if (existing) {
      await targetDb.run(
        `UPDATE providerConnections
         SET provider = ?, authType = ?, name = ?, email = ?, priority = ?, isActive = ?, data = ?, updatedAt = ?
         WHERE id = ?`,
        [
          row.provider,
          row.authType || "oauth",
          row.name || null,
          row.email || null,
          row.priority || null,
          isActiveValue(row.isActive) ? 1 : 0,
          stringifyJson(data),
          now,
          existing.id,
        ]
      );
      updated++;
    } else {
      await targetDb.run(
        `INSERT INTO providerConnections(id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          row.provider,
          row.authType || "oauth",
          row.name || null,
          row.email || null,
          row.priority || null,
          isActiveValue(row.isActive) ? 1 : 0,
          stringifyJson(data),
          now,
          now,
        ]
      );
      created++;
    }
  }

  let deleted = 0;
  for (const row of targetRows) {
    if (row.provider === "luna") {
      if (isSyncedConnection(row)) {
        await targetDb.run(`DELETE FROM providerConnections WHERE id = ?`, [row.id]);
        deleted++;
      }
      continue;
    }
    if (!isSyncedConnection(row)) continue;
    const sid = sourceConnectionId(row);
    if (sourceIds.has(sid)) continue;
    await targetDb.run(`DELETE FROM providerConnections WHERE id = ?`, [row.id]);
    deleted++;
  }

  return { created, updated, deleted };
}

async function syncCombos(sourceDb, targetDb) {
  const [sourceRows, targetRows] = await Promise.all([
    sourceDb.all(`SELECT * FROM combos ORDER BY createdAt ASC`),
    targetDb.all(`SELECT * FROM combos ORDER BY createdAt ASC`),
  ]);

  const targetByName = new Map(targetRows.map((row) => [comboFingerprint(row), row]));
  const sourceNames = new Set(sourceRows.map(comboFingerprint).filter(Boolean));
  let created = 0;
  let updated = 0;

  for (const row of sourceRows) {
    const fp = comboFingerprint(row);
    if (!fp) continue;

    const now = new Date().toISOString();
    const existing = targetByName.get(fp);
    if (existing) {
      await targetDb.run(
        `UPDATE combos SET name = ?, kind = ?, models = ?, updatedAt = ? WHERE id = ?`,
        [row.name, row.kind || null, JSON.stringify(parseJson(row.models, [])), now, existing.id]
      );
      updated++;
    } else {
      await targetDb.run(
        `INSERT INTO combos(id, name, kind, models, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          row.name,
          row.kind || null,
          JSON.stringify(parseJson(row.models, [])),
          now,
          now,
        ]
      );
      created++;
    }
  }

  let deleted = 0;
  for (const row of targetRows) {
    const fp = comboFingerprint(row);
    if (!fp || sourceNames.has(fp)) continue;
    await targetDb.run(`DELETE FROM combos WHERE id = ?`, [row.id]);
    deleted++;
  }

  return { created, updated, deleted };
}

async function ensureInternalApiKey(targetDb, username, machineId) {
  const rows = await targetDb.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  const active = rows.find((row) => isActiveValue(row.isActive));
  if (active?.key) return { key: active.key, created: false };

  const resolvedMachineId = machineId || await getConsistentMachineId();
  const generated = generateApiKeyWithMachine(resolvedMachineId);
  const now = new Date().toISOString();
  const apiKey = {
    id: uuidv4(),
    key: generated.key,
    name: `Report Assistant - ${username}`,
    machineId: resolvedMachineId,
    isActive: true,
    createdAt: now,
  };

  await targetDb.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt]
  );

  return { key: apiKey.key, created: true };
}

async function ensureRoundRobinSettings(targetDb) {
  const row = await targetDb.get(`SELECT data FROM settings WHERE id = 1`);
  const current = parseJson(row?.data, {});
  const next = {
    ...current,
    comboStrategy: "round-robin",
    comboStickyRoundRobinLimit: 1,
  };
  await targetDb.run(
    `INSERT INTO settings(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [stringifyJson(next)]
  );
  return {
    comboStrategy: next.comboStrategy,
    comboStickyRoundRobinLimit: next.comboStickyRoundRobinLimit,
  };
}

export async function ensureRestrictedUserResources(rawUsername, options = {}) {
  const username = normalizeUsername(rawUsername || "");
  if (!username || !isRestrictedUser(username)) {
    return { username, skipped: true, apiKey: null };
  }

  if (provisionLocks.has(username)) return provisionLocks.get(username);

  const promise = (async () => {
    const sourceDb = await getAdapterForUsername(RESOURCE_OWNER);
    const targetDb = await getAdapterForUsername(username);

    const [connections, combos, settings, apiKeyResult] = await Promise.all([
      syncProviderConnections(sourceDb, targetDb),
      syncCombos(sourceDb, targetDb),
      ensureRoundRobinSettings(targetDb),
      ensureInternalApiKey(targetDb, username, options.machineId),
    ]);

    return {
      username,
      sourceUsername: RESOURCE_OWNER,
      connectionsCreated: connections.created,
      connectionsUpdated: connections.updated,
      connectionsDeleted: connections.deleted,
      combosCreated: combos.created,
      combosUpdated: combos.updated,
      combosDeleted: combos.deleted,
      settings,
      apiKey: apiKeyResult.key,
      apiKeyCreated: apiKeyResult.created,
    };
  })().finally(() => {
    provisionLocks.delete(username);
  });

  provisionLocks.set(username, promise);
  return promise;
}

export async function syncRestrictedUsersFromOwner(rawUsername = RESOURCE_OWNER) {
  const username = normalizeUsername(rawUsername || "");
  if (!username || username === RESOURCE_OWNER) {
    return { skipped: true, username };
  }

  const result = await ensureRestrictedUserResources(username);
  return {
    skipped: false,
    username,
    result,
  };
}
