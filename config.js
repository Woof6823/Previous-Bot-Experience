require("dotenv").config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  ownerId: process.env.OWNER_ID || null,
  staffRoleId: process.env.STAFF_ROLE_ID || null,
  prefix: process.env.PREFIX || "*",
  brandColor: 0xf5c400,
  errorColor: 0xed4245,
  successColor: 0x57f287,
  botStatus: "I ❤️ Surge",

  ticketTypes: {
    roster: {
      label: "Roster",
      description: "Apply to join the Surge Esports roster.",
      emoji: "🎮",
      buttonStyle: "Primary",
      categoryName: "🎮 Roster Tickets",
      welcomeNote: "Support will be with you shortly.",
      adminOnly: false,
      pingRoleIds: [],
      questions: [
        { id: "age", label: "Please state your age.", style: "Short", required: true },
        { id: "position", label: "Which position are you applying for?", style: "Short", required: true }
      ]
    },
    staff: {
      label: "Staff",
      description: "Apply for a staff position on the team.",
      emoji: "🧑",
      buttonStyle: "Secondary",
      categoryName: "🧑 Staff Tickets",
      welcomeNote: "Support will be with you shortly.",
      adminOnly: true,
      pingRoleIds: [],
      questions: [
        { id: "age", label: "Please state your age.", style: "Short", required: true },
        {
          id: "resume",
          label: 'Link to your "RESUME" (or type none)',
          style: "Paragraph",
          required: true,
          helper: 'Please use Google Docs and make sure link sharing is set to "Anyone with the link can view". If you do not have a resume, type "none" and answer the two questions below instead.'
        },
        {
          id: "experience",
          label: "What experience do you have?",
          style: "Paragraph",
          required: false,
          helper: 'Only needed if you typed "none" for your resume above.'
        },
        {
          id: "why",
          label: "Why should we hire you?",
          style: "Paragraph",
          required: false,
          helper: 'Only needed if you typed "none" for your resume above.'
        }
      ]
    },
    business: {
      label: "Business",
      description: "Business, sponsorship, or partnership inquiries.",
      emoji: "🪙",
      buttonStyle: "Success",
      categoryName: "🪙 Business Tickets",
      welcomeNote: "Support will be with you shortly.",
      adminOnly: true,
      pingRoleIds: [],
      questions: []
    },
    general: {
      label: "General Support",
      description: "Questions, issues, or anything else you need help with.",
      emoji: "📩",
      categoryName: "📩 General Support",
      welcomeNote: "Support will be with you shortly.",
      adminOnly: false,
      pingRoleIds: [],
      questions: [
        { id: "topic", label: "What do you need help with?", style: "Paragraph", required: true }
      ]
    },
    report: {
      label: "Report",
      description: "Report a player, member, or an issue in the server.",
      emoji: "🚨",
      categoryName: "🚨 Reports",
      welcomeNote: "Support will be with you shortly. Reports are kept confidential.",
      adminOnly: true,
      pingRoleIds: [],
      questions: [
        { id: "who", label: "Who or what are you reporting?", style: "Short", required: true },
        { id: "details", label: "Please provide details/evidence.", style: "Paragraph", required: true }
      ]
    }
  },

  ticketEmbed: {
    title: "Official Support",
    description: "Please create a ticket below to join SURGE!\nOur staff will assist you shortly.",
    footer: "Esports Ticket System"
  },

  goat: {
    roleId: "1534321752610574347",
    creatorCode: "RegionX",
    grantDays: 14,
    denyCooldownHours: 12,
    applicationsChannelName: "🐐│goat-applications",
    applyChannelName: "goat-application"
  },

  rosterSupportRoleId: null,
  staffAccessRoleId: null,
  modActions: ["mute", "kick", "ban"],
  leaderboardRoleIds: [],
  statsPeriods: [1, 7, 14, 30],
  staffBlacklistRoleId: null,



  fullBlacklistRoleId: "1509686628833300490",
  filteredChannelId: null,

  linkBlockPatterns: [
    /youtu\.?be/i,
    /tiktok\.com/i,
    /twitch\.tv/i,
    /kick\.com/i,
    /discord\.gg|discord\.com\/invite/i
  ],

  ticketTranscriptChannelId: "1535561458086322256",
  welcomeChannelId: null,
  blacklistChannelId: null,
  loaChannelId: null,

  welcomeLinks: {
    socials: null,
    roster: null,
    staff: null,
    news: null
  },

  levels: {
    leaderboardChannelId: null,
    levelUpChannelId: null,
    messageXpMin: 15,
    messageXpMax: 25,
    messageXpCooldownSeconds: 60,
    reactionXp: 5,
    reactionXpCooldownSeconds: 60,
    voiceXpPerMinute: 4,
    baseXp: 100,
    xpStep: 75
  },

  levelRoles: {
    5: null,
    10: null,
    15: null,
    25: null,
    50: null,
    100: null
  },

  mediaOnlyChannelId: null,
  suggestionsChannelId: null,
  staffCommandsGuideChannelId: null,
  ticketFarmingAlertChannelId: null,
  ticketFarmingPingUserIds: ["783125857178746910", "1460942049594314772"],
  ticketFarmingFastClaimMs: 30 * 1000,
  ticketFarmingThreshold: 3,
  ticketFarmingWindowMs: 20 * 60 * 1000,
  generalChatChannelId: null,
  lfpChannelId: null,
  teamRequirementsChannelId: null,
  teamApplyChannelId: null,

  timerHours: 6,
  timerInactivityMinutes: 30,



  timerAutoStartAfterStaffReplyMinutes: 60,

  stats: {
    categoryName: "📊 Stats",
    membersPrefix: "👥 Members: ",
    goalPrefix: "🎯 Goal: ",
    updateIntervalMinutes: 10
  },

  tempVoice: {
    categoryName: "🔊 Voice Channels",
    joinChannelName: "➕ Join to Create",
    newChannelName: (username) => `${username}'s Channel`,
    createCooldownSeconds: 10
  },

  mandatoryRoleId: "1454879351605690527",
  mandatoryRoleSweepMinutes: 2,

  testingChannelId: "1532917943170498750",

  statusRole: {
    channelId: null,
    roleId: "1534746584665821214",
    requiredStatus: "discord.gg/fearsrg",
    sweepIntervalSeconds: 5,
    helpButtonCooldownMs: 5 * 60 * 1000,
    videosDir: "assets/status-help-videos"
  },

  dailyReport: {
    channelId: "1533448335241904230",
    intervalHours: 24,
    serverName: "Surge Esports™"
  },

  botStatusChannelId: "1535459154276262049",









  ai: {
    enabled: true,




    processedMessageTtlMs: 60 * 1000,





    escalation: {
      1: { action: "warn" },
      2: { action: "mute", durationMs: 60 * 60 * 1000 },
      3: { action: "mute", durationMs: 24 * 60 * 60 * 1000 },

      default: { action: "mute", durationMs: 7 * 24 * 60 * 60 * 1000 }
    },




  }
};
