module.exports = {
  guildId: '1468009469018378310',


  staffRoleIds: [
    '1417171131496141002',
    '1540827377448517632',
    '1417171137095401473',
    '1417171140182540320',
    '1417171141469933668',
    '1417171145504985170',
  ],


  ticketEmbedUserId: '1397639638209921095',


  prefix: '!',

  brand: {
    name: 'Cosmo Esports',
    supportName: 'Cosmo Esports Support',
    footer: 'Cosmo Esports Bot • Support System',
    color: 0x2b6cff,
    closedColor: 0x8a8f98,
    thumbnail: null,
  },



  ticketTypes: {
    roster: {
      key: 'roster',
      label: 'Roster',
      selectLabel: 'Roster',
      emoji: '🛡️',
      description: 'Roster and player-related requests',
      channelPrefix: 'roster',
      categoryName: 'COSMO • ROSTER',
    },
    staff: {
      key: 'staff',
      label: 'Staff',
      selectLabel: 'Staff',
      emoji: '🛠️',
      description: 'Staff applications and staff-related requests',
      channelPrefix: 'staff',
      categoryName: 'COSMO • STAFF',
    },
    business: {
      key: 'business',
      label: 'Business / Support',
      selectLabel: 'Business/Support',
      emoji: '💼',
      description: 'Business inquiries, partnerships and general support',
      channelPrefix: 'business-support',
      categoryName: 'COSMO • BUSINESS & SUPPORT',
    },
  },

  selectMenuCustomId: 'cosmo_ticket_select',
  inactivityHours: 48,
};
