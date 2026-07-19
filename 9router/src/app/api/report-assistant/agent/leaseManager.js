export class LeaseManager {
  constructor(turso, chatId, username, lockId) {
    this.turso = turso;
    this.chatId = chatId;
    this.username = username;
    this.lockId = lockId;
  }

  async verify() {
    const checkTime = new Date().toISOString();
    const result = await this.turso.execute({
      sql: `SELECT lock_id FROM report_agent_worker_leases WHERE chat_id = ? AND username = ? AND expires_at > ?`,
      args: [this.chatId, this.username || "admin", checkTime]
    });
    const currentLockId = result.rows?.[0]?.lock_id;
    if (currentLockId !== this.lockId) {
      const err = new Error("LEASE_LOST");
      err.code = "LEASE_LOST";
      throw err;
    }
  }

  async release() {
    try {
      const result = await this.turso.execute({
        sql: `DELETE FROM report_agent_worker_leases WHERE chat_id = ? AND username = ? AND lock_id = ?`,
        args: [this.chatId, this.username || "admin", this.lockId],
      });
      return result.rowsAffected > 0;
    } catch (err) {
      console.error("[LeaseManager] release failed:", err.message);
      return false;
    }
  }

  async insertWithLeaseCheck(sql, args) {
    return this.turso.execute({ sql, args });
  }

  async insertSectionWithLeaseCheck({ sectionId, sectionTitle, content, reportTitle }) {
    const nowStr = new Date().toISOString();
    const result = await this.turso.execute({
      sql: `
        INSERT INTO report_sections (id, chat_id, username, report_title, section_id, section_title, content)
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM report_agent_worker_leases 
          WHERE chat_id = ? AND username = ? AND lock_id = ? AND expires_at > ?
        )
        ON CONFLICT(chat_id, section_id) DO UPDATE SET 
          report_title = excluded.report_title,
          section_title = excluded.section_title,
          content = excluded.content,
          updated_at = CURRENT_TIMESTAMP
        WHERE EXISTS (
          SELECT 1 FROM report_agent_worker_leases 
          WHERE chat_id = ? AND username = ? AND lock_id = ? AND expires_at > ?
        )
      `,
      args: [
        crypto.randomUUID(),
        this.chatId,
        this.username || "admin",
        reportTitle,
        sectionId,
        sectionTitle,
        content,
        this.chatId,
        this.username || "admin",
        this.lockId,
        nowStr,
        this.chatId,
        this.username || "admin",
        this.lockId,
        nowStr
      ]
    });
    if (result.rowsAffected === 0) {
      const err = new Error("LEASE_LOST");
      err.code = "LEASE_LOST";
      throw err;
    }
    return result;
  }
}
