export function createAgentStateStore(turso) {
  let leaseTableEnsured = false;
  async function ensureLeaseTable() {
    if (leaseTableEnsured) return;
    try {
      await turso.execute(`
        CREATE TABLE IF NOT EXISTS report_agent_worker_leases (
          chat_id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          lock_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await turso.execute(`
        CREATE INDEX IF NOT EXISTS idx_raw_leases_chat_user ON report_agent_worker_leases(chat_id, username)
      `);
      leaseTableEnsured = true;
    } catch (err) {
      console.error("[agentStateStore] ensureLeaseTable failed:", err.message);
      throw err;
    }
  }

  const memoryStateMap = new Map();

  function setMemoryState(chatId, stateData) {
    if (!chatId || !stateData) return;
    memoryStateMap.set(chatId, {
      ...stateData,
      _ram_updated_at: new Date().toISOString(),
    });
  }

  async function getAgentState(chatId, username = "admin") {
    try {
      // Return volatile RAM state if available for ultra-fast real-time streaming preview
      const ramState = memoryStateMap.get(chatId);
      if (ramState) {
        return {
          source: "memory",
          data: ramState,
        };
      }

      const result = await turso.execute({
        sql: `SELECT chat_id, username, current_step, current_activity, outline, sections_progress, updated_at, created_at
              FROM report_agent_states WHERE chat_id = ? AND username = ?`,
        args: [chatId, username],
      });
      const row = result.rows?.[0];
      if (!row) return { source: "none", data: null };

      const parseJsonSafe = (value) => {
        if (typeof value !== "string") return value;
        try { return JSON.parse(value); } catch { return value; }
      };
      const dbState = {
        chat_id: row.chat_id,
        username: row.username,
        current_step: row.current_step,
        current_activity: parseJsonSafe(row.current_activity),
        outline: parseJsonSafe(row.outline),
        sections_progress: parseJsonSafe(row.sections_progress),
        updated_at: row.updated_at,
        created_at: row.created_at,
      };
      return {
        source: "turso",
        data: dbState,
      };
    } catch (err) {
      console.error("[agent/route] getAgentState failed:", err.message);
      return { source: "none", data: null };
    }
  }

  async function saveAgentState(chatId, username, stateData, expectedUpdatedAt = null, leaseLockId = null) {
    const now = new Date().toISOString();
    try {
      if (leaseLockId) {
        await ensureLeaseTable();
        // We run a secure conditional write where the update or insert query checks for lease lock validity within the exact same statement's WHERE condition.
        if (expectedUpdatedAt && typeof expectedUpdatedAt === "string") {
          const result = await turso.execute({
            sql: `UPDATE report_agent_states
                  SET current_step = ?, current_activity = ?, outline = ?, sections_progress = ?, updated_at = ?
                  WHERE chat_id = ? AND username = ? AND updated_at = ? AND EXISTS (
                    SELECT 1 FROM report_agent_worker_leases 
                    WHERE chat_id = ? AND username = ? AND lock_id = ? AND expires_at > ?
                  )`,
            args: [
              stateData.current_step || "PLANNING",
              JSON.stringify(stateData.current_activity || null),
              JSON.stringify(stateData.outline || []),
              JSON.stringify(stateData.sections_progress || []),
              now,
              chatId,
              username,
              expectedUpdatedAt,
              chatId,
              username || "admin",
              leaseLockId,
              now
            ],
          });
          if (result.rowsAffected === 0) {
            // Check if state exists at all
            const existsResult = await turso.execute({
              sql: `SELECT updated_at FROM report_agent_states WHERE chat_id = ? AND username = ?`,
              args: [chatId, username]
            });
            if (existsResult.rows?.length === 0) {
              const err = new Error("Lease lost or expired: cannot write state.");
              err.code = "LEASE_LOST";
              throw err;
            }
            // Check if lease is missing or expired
            const leaseCheck = await turso.execute({
              sql: `SELECT 1 FROM report_agent_worker_leases WHERE chat_id = ? AND username = ? AND lock_id = ? AND expires_at > ?`,
              args: [chatId, username || "admin", leaseLockId, now]
            });
            if (!leaseCheck.rows || leaseCheck.rows.length === 0) {
              const err = new Error("Lease lost or expired: cannot write state.");
              err.code = "LEASE_LOST";
              throw err;
            }
            const err = new Error("Concurrency conflict: The state was updated by another request.");
            err.code = "CONCURRENCY_CONFLICT";
            throw err;
          }
          if (stateData) stateData.updated_at = now;
          return { savedTurso: true };
        } else {
          // Conditional insert/update using ON CONFLICT and checking lease status
          // If conflict: updates only if lease matches AND username matches.
          // Because ON CONFLICT DO UPDATE applies to existing rows, we check the lease table.
          const result = await turso.execute({
            sql: `INSERT INTO report_agent_states
                    (chat_id, username, current_step, current_activity, outline, sections_progress, created_at, updated_at)
                  SELECT ?, ?, ?, ?, ?, ?, ?, ?
                  WHERE EXISTS (
                    SELECT 1 FROM report_agent_worker_leases 
                    WHERE chat_id = ? AND username = ? AND lock_id = ? AND expires_at > ?
                  )
                  ON CONFLICT(chat_id) DO UPDATE SET
                    current_step = excluded.current_step,
                    current_activity = excluded.current_activity,
                    outline = excluded.outline,
                    sections_progress = excluded.sections_progress,
                    updated_at = excluded.updated_at
                  WHERE report_agent_states.username = excluded.username AND EXISTS (
                    SELECT 1 FROM report_agent_worker_leases 
                    WHERE chat_id = excluded.chat_id AND username = excluded.username AND lock_id = ? AND expires_at > ?
                  )`,
            args: [
              chatId,
              username || "admin",
              stateData.current_step || "PLANNING",
              JSON.stringify(stateData.current_activity || null),
              JSON.stringify(stateData.outline || []),
              JSON.stringify(stateData.sections_progress || []),
              now,
              now,
              chatId,
              username || "admin",
              leaseLockId,
              now,
              leaseLockId,
              now
            ],
          });
          if (result.rowsAffected === 0) {
            const err = new Error("Lease lost or expired: cannot write state.");
            err.code = "LEASE_LOST";
            throw err;
          }
          if (stateData) stateData.updated_at = now;
          // Touch / extend lease so long-running streams don't expire mid-execution
          const leaseTtl = Number.parseInt(process.env.REPORT_AGENT_LEASE_TTL_MS || "720000", 10);
          const newExpiresAt = new Date(new Date(now).getTime() + leaseTtl).toISOString();
          turso.execute({
            sql: `UPDATE report_agent_worker_leases SET expires_at = ?, updated_at = ? WHERE chat_id = ? AND username = ? AND lock_id = ?`,
            args: [newExpiresAt, now, chatId, username || "admin", leaseLockId]
          }).catch(() => {});
          return { savedTurso: true };
        }
      }

      // If no leaseLockId is provided
      if (expectedUpdatedAt && typeof expectedUpdatedAt === "string") {
        const result = await turso.execute({
          sql: `UPDATE report_agent_states
                SET current_step = ?, current_activity = ?, outline = ?, sections_progress = ?, updated_at = ?
                WHERE chat_id = ? AND username = ? AND updated_at = ?`,
          args: [
            stateData.current_step || "PLANNING",
            JSON.stringify(stateData.current_activity || null),
            JSON.stringify(stateData.outline || []),
            JSON.stringify(stateData.sections_progress || []),
            now,
            chatId,
            username,
            expectedUpdatedAt,
          ],
        });
        if (result.rowsAffected === 0) {
          const err = new Error("Concurrency conflict: The state was updated by another request.");
          err.code = "CONCURRENCY_CONFLICT";
          throw err;
        }
        if (stateData) stateData.updated_at = now;
        return { savedTurso: true };
      }

      const result = await turso.execute({
        sql: `INSERT INTO report_agent_states
                (chat_id, username, current_step, current_activity, outline, sections_progress, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(chat_id) DO UPDATE SET
                current_step = excluded.current_step,
                current_activity = excluded.current_activity,
                outline = excluded.outline,
                sections_progress = excluded.sections_progress,
                updated_at = excluded.updated_at
              WHERE report_agent_states.username = excluded.username`,
        args: [
          chatId,
          username || "admin",
          stateData.current_step || "PLANNING",
          JSON.stringify(stateData.current_activity || null),
          JSON.stringify(stateData.outline || []),
          JSON.stringify(stateData.sections_progress || []),
          now,
          now,
        ],
      });
      if (result.rowsAffected === 0) {
        const err = new Error("Agent state belongs to a different user.");
        err.code = "AGENT_STATE_ACCESS_DENIED";
        throw err;
      }
      if (stateData) stateData.updated_at = now;
      memoryStateMap.delete(chatId);
      return { savedTurso: true };
    } catch (err) {
      console.error("[agent/route] saveAgentState failed:", err.message);
      if (err.code === "CONCURRENCY_CONFLICT" || err.code === "AGENT_STATE_ACCESS_DENIED" || err.code === "LEASE_LOST") throw err;
      throw err;
    }
  }

  async function claimWorkerLease({ chatId, username, lockId, now }) {
    await ensureLeaseTable();
    const leaseTtl = Number.parseInt(process.env.REPORT_AGENT_LEASE_TTL_MS || "720000", 10);
    const expiresAt = new Date(new Date(now).getTime() + leaseTtl).toISOString();
    try {
      const result = await turso.execute({
        sql: `INSERT INTO report_agent_worker_leases
                (chat_id, username, lock_id, expires_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(chat_id) DO UPDATE SET
                lock_id = excluded.lock_id,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at,
                username = excluded.username
              WHERE report_agent_worker_leases.expires_at <= ? AND report_agent_worker_leases.username = ?`,
        args: [
          chatId,
          username || "admin",
          lockId,
          expiresAt,
          now,
          now,
          now,
          username || "admin",
        ],
      });
      return result.rowsAffected > 0;
    } catch (err) {
      console.error("[agent/route] claimWorkerLease failed:", err.message);
      throw err;
    }
  }

  async function releaseWorkerLease({ chatId, username, lockId }) {
    await ensureLeaseTable();
    try {
      const result = await turso.execute({
        sql: `DELETE FROM report_agent_worker_leases WHERE chat_id = ? AND username = ? AND lock_id = ?`,
        args: [chatId, username || "admin", lockId],
      });
      return result.rowsAffected > 0;
    } catch (err) {
      console.error("[agent/route] releaseWorkerLease failed:", err.message);
      return false;
    }
  }

  async function invalidateWorkerLease({ chatId, username }) {
    await ensureLeaseTable();
    try {
      const result = await turso.execute({
        sql: `DELETE FROM report_agent_worker_leases WHERE chat_id = ? AND username = ?`,
        args: [chatId, username || "admin"],
      });
      return result.rowsAffected > 0;
    } catch (err) {
      console.error("[agent/route] invalidateWorkerLease failed:", err.message);
      return false;
    }
  }

  async function hasActiveWorkerLease({ chatId, username, now }) {
    await ensureLeaseTable();
    try {
      const result = await turso.execute({
        sql: `SELECT lock_id, expires_at FROM report_agent_worker_leases WHERE chat_id = ? AND username = ? AND expires_at > ?`,
        args: [chatId, username || "admin", now],
      });
      return result.rows?.length > 0;
    } catch (err) {
      console.error("[agent/route] hasActiveWorkerLease failed:", err.message);
      return false;
    }
  }

  return { getAgentState, saveAgentState, setMemoryState, claimWorkerLease, releaseWorkerLease, invalidateWorkerLease, hasActiveWorkerLease };
}
