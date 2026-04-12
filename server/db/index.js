const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../../data/game.db");
const dbDirectory = path.dirname(dbPath);
fs.mkdirSync(dbDirectory, { recursive: true });
const db = new Database(dbPath);

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasDisplayName = columns.some((column) => column.name === "display_name");

  if (!hasDisplayName) {
    db.exec(`
      ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
      UPDATE users SET display_name = user_id WHERE display_name = '';
    `);
  } else {
    db.exec(`
      UPDATE users SET display_name = user_id WHERE display_name = '';
    `);
  }
}

module.exports = {
  db,
  initDatabase,
};
