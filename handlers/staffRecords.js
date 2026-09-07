const { db } = require("../database");


try {
  db.exec("ALTER TABLE training_sessions ADD COLUMN completed_at INTEGER");
} catch {

}
db.exec(`
CREATE TABLE IF NOT EXISTS staff_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL, -- 'hire' | 'promo' | 'demo'
    old_role_id TEXT,
    new_role_id TEXT,
    approved_by TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_history_user ON staff_history(user_id, created_at);
CREATE TABLE IF NOT EXISTS training_scenario_results (
    channel_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (channel_id, scenario_id)
);
`);


function addStaffHistory({ userId, kind, oldRoleId, newRoleId, approvedBy }) {
  db.prepare(
    `INSERT INTO staff_history (user_id, kind, old_role_id, new_role_id, approved_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, kind, oldRoleId || null, newRoleId || null, approvedBy, Date.now());
}

function getStaffHistory(userId) {
  return db
    .prepare("SELECT * FROM staff_history WHERE user_id = ? ORDER BY created_at ASC")
    .all(userId);
}


function markTrainingCompleted(channelId) {
  db.prepare(
    "UPDATE training_sessions SET completed_at = ? WHERE channel_id = ? AND completed_at IS NULL"
  ).run(Date.now(), channelId);
}

function getAllTrainingSessions() {
  return db.prepare("SELECT * FROM training_sessions").all();
}

function getCompletedTrainingSessions() {
  return db.prepare("SELECT * FROM training_sessions WHERE status = 'completed'").all();
}


function recordScenarioAttempt(channelId, scenarioId, correct) {
  const existing = db
    .prepare("SELECT * FROM training_scenario_results WHERE channel_id = ? AND scenario_id = ?")
    .get(channelId, scenarioId);
  if (!existing) {
    db.prepare(
      "INSERT INTO training_scenario_results (channel_id, scenario_id, wrong_count, completed) VALUES (?, ?, ?, ?)"
    ).run(channelId, scenarioId, correct ? 0 : 1, correct ? 1 : 0);
    return;
  }
  db.prepare(
    "UPDATE training_scenario_results SET wrong_count = wrong_count + ?, completed = ? WHERE channel_id = ? AND scenario_id = ?"
  ).run(correct ? 0 : 1, correct ? 1 : existing.completed, channelId, scenarioId);
}

function getScenarioResults() {
  return db.prepare("SELECT * FROM training_scenario_results").all();
}


function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function getMessageCountSince(userId, sinceTs) {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(count), 0) AS t FROM message_daily_stats WHERE user_id = ? AND day >= ?"
    )
    .get(userId, dayKey(sinceTs));
  return row.t;
}

function getVoiceSecondsSince(userId, sinceTs) {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(seconds), 0) AS t FROM voice_daily_stats WHERE user_id = ? AND day >= ?"
    )
    .get(userId, dayKey(sinceTs));
  return row.t;
}

function getClaimedCountSince(userId, sinceTs) {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS t FROM tickets WHERE claimed_by = ? AND COALESCE(claimed_at, created_at) >= ?"
    )
    .get(userId, sinceTs);
  return row.t;
}

module.exports = {
  addStaffHistory,
  getStaffHistory,
  markTrainingCompleted,
  getAllTrainingSessions,
  getCompletedTrainingSessions,
  recordScenarioAttempt,
  getScenarioResults,
  getMessageCountSince,
  getVoiceSecondsSince,
  getClaimedCountSince
};
