module.exports = {

  OWNER_ID: '1460942049594314772',


  STAFF_ROLE_ID: '1533405149907783822',

  PREFIX: '*',


  SETTINGS_KEYS: {
    WELCOME_CHANNEL: 'welcome_channel_id',
    TRANSCRIPT_CHANNEL: 'transcript_channel_id',
    GOODBYE_CHANNEL: 'goodbye_channel_id',
    MODLOG_CHANNEL: 'modlog_channel_id',
    SUGGESTIONS_CHANNEL: 'suggestions_channel_id',
    AUTOROLE_ID: 'autorole_id',
    RAID_JOIN_THRESHOLD: 'raid_join_threshold',
    RAID_WINDOW_SECONDS: 'raid_window_seconds',
    ANTISPAM_ENABLED: 'antispam_enabled',
    WORDFILTER_ENABLED: 'wordfilter_enabled',
    LEVELING_ENABLED: 'leveling_enabled',
  },




  GRANTABLE_MOD_PERMS: ['warn', 'mute'],


  XP_PER_MESSAGE_MIN: 15,
  XP_PER_MESSAGE_MAX: 25,
  XP_COOLDOWN_MS: 60 * 1000,
  xpForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
  },


  ANTISPAM_MESSAGE_LIMIT: 5,
  ANTISPAM_WINDOW_MS: 6000,
  ANTISPAM_MUTE_MINUTES: 5,

  BRAND_COLOR: 0xF2C230,
  BRAND_NAME: 'SAIL Gaming',



  TICKET_TYPES: [
    {
      id: 'player',
      slug: 'player-app',
      label: 'Player Application',
      emoji: '🎮',
      description: 'Apply to become a SAIL Esports player',
      categoryName: '🎮︱Player Applications',
      openMessage: 'Thanks for applying to play for SAIL! Please share your info below - our roster managers will be with you shortly.',
    },
    {
      id: 'staff',
      slug: 'staff-app',
      label: 'Staff Application',
      emoji: '🛡️',
      description: 'Apply to join the SAIL staff team',
      categoryName: '🛡️︱Staff Applications',
      openMessage: 'Thanks for your interest in joining the staff team! Please answer any application questions below - a recruiter will review your ticket shortly.',
    },
    {
      id: 'creator',
      slug: 'creator-app',
      label: 'Content Creator Application',
      emoji: '💬',
      description: 'Apply to become a SAIL content creator',
      categoryName: '💬︱Content Creator Apps',
      openMessage: 'Thanks for applying to create content for SAIL! Our content team will be with you shortly.',
    },
    {
      id: 'support',
      slug: 'support',
      label: 'Support Ticket',
      emoji: '🎫',
      description: 'Get help from the SAIL Esports support team',
      categoryName: '🎫︱Support Tickets',
      openMessage: 'Thanks for reaching out! Our support team will be with you shortly.',
    },
    {
      id: 'business',
      slug: 'business',
      label: 'Business Inquiry',
      emoji: '💰',
      description: 'Sponsorships, partnerships & business inquiries',
      categoryName: '💰︱Business Inquiries',
      openMessage: 'Thanks for reaching out about a business matter! Our management team will be with you shortly.',
    },
  ],
};
