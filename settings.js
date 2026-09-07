const config = require("./config");
const db = require("./database");

const OVERRIDABLE = {
  staffAccessRoleId: "cfg_staff_access_role_id",
  staffRoleId: "staff_role_id",
  rosterSupportRoleId: "cfg_roster_support_role_id",
  staffBlacklistRoleId: "cfg_staff_blacklist_role_id",
  ticketPingRoleId: "cfg_ticket_ping_role_id",
  welcomeChannelId: "cfg_welcome_channel_id",
  ticketTranscriptChannelId: "cfg_ticket_transcript_channel_id",
  blacklistChannelId: "cfg_blacklist_channel_id",
  loaChannelId: "cfg_loa_channel_id",
  mediaOnlyChannelId: "cfg_media_only_channel_id",
  suggestionsChannelId: "cfg_suggestions_channel_id",
  filteredChannelId: "cfg_filtered_channel_id",
  wordFilterBypassRoleId: "cfg_word_filter_bypass_role_id",
  generalChatChannelId: "cfg_general_chat_channel_id",
  lfpChannelId: "cfg_lfp_channel_id",
  teamRequirementsChannelId: "cfg_team_requirements_channel_id",
  teamApplyChannelId: "cfg_team_apply_channel_id",
  staffCommandsGuideChannelId: "cfg_staff_commands_guide_channel_id",
  statusRoleChannelId: "cfg_status_role_channel_id",
  ticketFarmingAlertChannelId: "cfg_ticket_farming_alert_channel_id",
  levelLeaderboardChannelId: "cfg_level_leaderboard_channel_id",
  levelUpChannelId: "cfg_level_up_channel_id",
  leaderboardRoleIds: "cfg_leaderboard_role_ids",
  levelRoles: "cfg_level_roles",
  welcomeLinks: "cfg_welcome_links"
};

const SETTINGS_META = {
  staffAccessRoleId: { label: "Staff Access Role", type: "role" },
  staffRoleId: { label: "Ticket Staff Role (claim/close)", type: "role" },
  rosterSupportRoleId: { label: "Roster Support Role", type: "role" },
  staffBlacklistRoleId: { label: "Staff Blacklist Role", type: "role" },
  ticketPingRoleId: { label: "Ticket Ping Role (pinged on new tickets)", type: "role" },
  welcomeChannelId: { label: "Welcome Channel", type: "channel" },
  ticketTranscriptChannelId: { label: "Ticket Transcript Channel", type: "channel" },
  blacklistChannelId: { label: "Blacklist Channel", type: "channel" },
  loaChannelId: { label: "LOA Channel", type: "channel" },
  mediaOnlyChannelId: { label: "Media-Only Channel", type: "channel" },
  suggestionsChannelId: { label: "Suggestions Channel", type: "channel" },
  filteredChannelId: { label: "Filtered Chat Channel", type: "channel" },
  wordFilterBypassRoleId: { label: "Word Filter Bypass Role", type: "role" },
  generalChatChannelId: { label: "General Chat Channel", type: "channel" },
  lfpChannelId: { label: "Looking For Players Channel", type: "channel" },
  teamRequirementsChannelId: { label: "Team Requirements Channel", type: "channel" },
  teamApplyChannelId: { label: "Team Applications Channel", type: "channel" },
  staffCommandsGuideChannelId: { label: "Staff Guide Channel", type: "channel" },
  statusRoleChannelId: { label: "Status-Role (Supporter) Channel", type: "channel" },
  ticketFarmingAlertChannelId: { label: "Ticket Farming Alerts Channel", type: "channel" },
  levelLeaderboardChannelId: { label: "Level Leaderboard Channel", type: "channel" },
  levelUpChannelId: { label: "Level-Up Channel", type: "channel" },
  leaderboardRoleIds: { label: "Leaderboard Roles", type: "roles" },
  levelRoles: { label: "Level Reward Roles", type: "roles" },
  welcomeLinks: { label: "Welcome Link Channels", type: "channels" }
};

const DEFAULTS = {
  staffAccessRoleId: () => config.staffAccessRoleId,
  staffRoleId: () => config.staffRoleId,
  rosterSupportRoleId: () => config.rosterSupportRoleId,
  staffBlacklistRoleId: () => config.staffBlacklistRoleId,
  ticketPingRoleId: () => null,
  welcomeChannelId: () => config.welcomeChannelId,
  ticketTranscriptChannelId: () => config.ticketTranscriptChannelId,
  blacklistChannelId: () => config.blacklistChannelId,
  loaChannelId: () => config.loaChannelId,
  mediaOnlyChannelId: () => config.mediaOnlyChannelId,
  suggestionsChannelId: () => config.suggestionsChannelId,
  filteredChannelId: () => config.filteredChannelId,
  wordFilterBypassRoleId: () => null,
  generalChatChannelId: () => config.generalChatChannelId,
  lfpChannelId: () => config.lfpChannelId,
  teamRequirementsChannelId: () => config.teamRequirementsChannelId,
  teamApplyChannelId: () => config.teamApplyChannelId,
  staffCommandsGuideChannelId: () => config.staffCommandsGuideChannelId,
  statusRoleChannelId: () => config.statusRole.channelId,
  ticketFarmingAlertChannelId: () => config.ticketFarmingAlertChannelId,
  levelLeaderboardChannelId: () => config.levels.leaderboardChannelId,
  levelUpChannelId: () => config.levels.levelUpChannelId,
  leaderboardRoleIds: () => config.leaderboardRoleIds,
  levelRoles: () => config.levelRoles,
  welcomeLinks: () => config.welcomeLinks
};

function get(key) {
  const dbKey = OVERRIDABLE[key];

  if (!dbKey) {
    throw new Error(`Unknown overridable setting: ${key}`);
  }

  const override = db.getSetting(dbKey);

  if (
    override !== null &&
    override !== undefined &&
    override !== ""
  ) {
    return override;
  }

  return DEFAULTS[key]?.() ?? null;
}

function set(key, value) {
  const dbKey = OVERRIDABLE[key];

  if (!dbKey) {
    throw new Error(`Unknown overridable setting: ${key}`);
  }

  db.setSetting(
    dbKey,
    typeof value === "object" ? JSON.stringify(value) : value
  );
}

function getAll() {
  const result = {};

  for (const key of Object.keys(OVERRIDABLE)) {
    result[key] = {
      value: get(key),
      ...SETTINGS_META[key]
    };
  }

  return result;
}

function getRoleIds(key) {
  const value = get(key);

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getObject(key) {
  const value = get(key);

  if (value && typeof value === "object") return value;

  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

module.exports = {
  get,
  set,
  getAll,
  getRoleIds,
  getObject,
  OVERRIDABLE,
  SETTINGS_META
};
