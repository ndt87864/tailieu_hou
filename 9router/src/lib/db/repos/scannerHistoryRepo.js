import { getAdapter } from "../driver.js";

async function ensureUsernameColumn(db) {
  try {
    // Try to select username column to see if it exists
    await db.all(`SELECT username FROM scannerhistory LIMIT 1`);
  } catch (err) {
    if (err.message && err.message.includes("no such column")) {
      try {
        await db.run(`ALTER TABLE scannerhistory ADD COLUMN username TEXT`);
        console.log(`[DB][scannerHistory] Self-healed: added username column successfully.`);
      } catch (alterErr) {
        console.error(`[DB][scannerHistory] Failed to add username column:`, alterErr.message);
      }
    }
  }
}

export async function getScannerHistory() {
  const db = await getAdapter();
  await ensureUsernameColumn(db);
  const username = db.username || "admin";
  // Fetch all scanner history entries for this user, newest first
  const rows = await db.all(`SELECT * FROM scannerhistory WHERE username = ? ORDER BY createdat DESC`, [username]);
  return rows || [];
}

export async function createScannerHistory(data) {
  const db = await getAdapter();
  await ensureUsernameColumn(db);
  const now = new Date().toISOString();
  const id = data.id || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const username = db.username || "admin";

  await db.run(
    `INSERT INTO scannerhistory(id, filename, filetype, model, results, createdat, username)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [id, data.filename, data.fileType, data.model, data.results, data.createdAt || now, data.username || username]
  );

  return {
    id,
    filename: data.filename,
    fileType: data.fileType,
    model: data.model,
    results: data.results,
    createdAt: data.createdAt || now,
    username: data.username || username,
  };
}

export async function deleteScannerHistory(id) {
  const db = await getAdapter();
  await db.run(`DELETE FROM scannerhistory WHERE id = ?`, [id]);
  return { success: true, id };
}

export async function clearScannerHistory() {
  const db = await getAdapter();
  await ensureUsernameColumn(db);
  const username = db.username || "admin";
  await db.run(`DELETE FROM scannerhistory WHERE username = ?`, [username]);
  return { success: true };
}
