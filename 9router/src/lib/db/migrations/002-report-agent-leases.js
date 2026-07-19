// Migration to create report_agent_worker_leases table.
export default {
  version: 2,
  name: "report_agent_worker_leases",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS report_agent_worker_leases (
        chat_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        lock_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_raw_leases_chat_user ON report_agent_worker_leases(chat_id, username)
    `);
  },
};
