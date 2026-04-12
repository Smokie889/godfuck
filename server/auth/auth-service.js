const argon2 = require("argon2");
const { db } = require("../db");

function validateUserId(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!/^[a-zA-Z0-9_-]{3,16}$/.test(normalizedUserId)) {
    throw new Error("INVALID_USER_ID");
  }

  return normalizedUserId;
}

function validatePassword(password) {
  const normalizedPassword = String(password || "");

  if (normalizedPassword.length < 6 || normalizedPassword.length > 72) {
    throw new Error("INVALID_PASSWORD");
  }

  return normalizedPassword;
}

function validateDisplayName(displayName, fallbackUserId) {
  const normalizedDisplayName = String(displayName || fallbackUserId || "").trim();

  if (!/^[a-zA-Z0-9_-]{2,20}$/.test(normalizedDisplayName)) {
    throw new Error("INVALID_DISPLAY_NAME");
  }

  return normalizedDisplayName;
}

function validateCredentials(userId, password) {
  if (!String(userId || "").trim() || !String(password || "")) {
    throw new Error("MISSING_CREDENTIALS");
  }

  return {
    userId: validateUserId(userId),
    password: validatePassword(password),
  };
}

async function registerUser(userId, password, displayName) {
  const validated = validateCredentials(userId, password);
  const validatedDisplayName = validateDisplayName(displayName, validated.userId);
  const existing = db
    .prepare("SELECT id FROM users WHERE user_id = ?")
    .get(validated.userId);

  if (existing) {
    throw new Error("USER_EXISTS");
  }

  const passwordHash = await argon2.hash(validated.password);

  db.prepare(`
    INSERT INTO users (user_id, display_name, password_hash)
    VALUES (?, ?, ?)
  `).run(validated.userId, validatedDisplayName, passwordHash);

  return {
    userId: validated.userId,
    displayName: validatedDisplayName,
  };
}

async function loginUser(userId, password) {
  const validated = validateCredentials(userId, password);
  const user = db
    .prepare("SELECT id, user_id, display_name, password_hash FROM users WHERE user_id = ?")
    .get(validated.userId);

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await argon2.verify(user.password_hash, validated.password);
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return {
    id: user.id,
    userId: user.user_id,
    displayName: user.display_name,
  };
}

function getUserProfile(userId) {
  const validatedUserId = validateUserId(userId);
  const user = db
    .prepare("SELECT id, user_id, display_name, created_at FROM users WHERE user_id = ?")
    .get(validatedUserId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    id: user.id,
    userId: user.user_id,
    displayName: user.display_name,
    createdAt: user.created_at,
  };
}

function updateDisplayName(userId, displayName) {
  const validatedUserId = validateUserId(userId);
  const validatedDisplayName = validateDisplayName(displayName, validatedUserId);

  const result = db
    .prepare(`
      UPDATE users
      SET display_name = ?
      WHERE user_id = ?
    `)
    .run(validatedDisplayName, validatedUserId);

  if (result.changes === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  return getUserProfile(validatedUserId);
}

module.exports = {
  getUserProfile,
  registerUser,
  loginUser,
  updateDisplayName,
  validateCredentials,
  validateDisplayName,
};
