module.exports = {
  PREFIX: '*',
  OWNER_USER_ID: '1460942049594314772',


  STAFF_ROLE_IDS: [
    '1538299257352618054',
    '1537859546826018859',
    '1537859546855505938',
    '1541996096996376667',
  ],

  TICKET_TYPES: {
    roster: {
      label: 'Roster Application',
      description: 'Join as a Nexar Player',
      emoji: '🛡️',
      categoryName: 'Roster Tickets',
      pingRoleId: '1537859546826018859',
    },
    staff: {
      label: 'Staff Application',
      description: 'Join the Nexar Staff Team',
      emoji: '🛠️',
      categoryName: 'Staff Tickets',
      pingRoleId: '1537859546826018859',
    },
    business: {
      label: 'Business Inquiry',
      description: 'Partnerships & Business',
      emoji: '💼',
      categoryName: 'Business Tickets',
      pingRoleId: '1537859546855505938',
    },
    hr: {
      label: 'HR / Senior Staff',
      description: 'Senior positions & HR matters',
      emoji: '👔',
      categoryName: 'HR Tickets',
      pingRoleId: '1541996096996376667',
    },
    reporting: {
      label: 'Reporting',
      description: 'Report issues or violations',
      emoji: '⚖️',
      categoryName: 'Reporting Tickets',
      pingRoleId: '1537859546826018859',
    },
    support: {
      label: 'General Support',
      description: 'Get help with an issue',
      emoji: '❓',
      categoryName: 'Support Tickets',
      pingRoleId: '1537859546826018859',
    },
  },

  TICKET_EMBED_TITLE: '🎟️ Nexar Region Support',
  TICKET_EMBED_DESCRIPTION:
    '**Welcome to the Official Nexar Region Support Page!**\n\n' +
    'Before opening a ticket, please ensure you have reviewed our rules and announcements.\n\n' +
    '**📂 How to Create a Ticket:**\n' +
    'Please use the **dropdown menu below** to select the category that best fits your needs.\n\n' +
    '> 🛡️ **Roster Applications** — Join as a player\n' +
    '> 🛠️ **Staff Applications** — Join the team\n' +
    '> 💼 **Business Inquiries** — Partnerships\n' +
    '> 👔 **HR / Senior Staff** — Senior roles & HR\n' +
    '> ⚖️ **Reporting** — Report issues\n' +
    '> ❓ **General Support** — Help & Questions\n\n' +
    '**⚠️ Please Note:**\n' +
    '• Tickets are reviewed as fast as possible.\n' +
    '• Inactive tickets may be closed after 48 hours.\n' +
    '• Please be respectful and provide all necessary info.\n\n' +
    '*Nexar Region — Focusing on the Future*',

  WELCOME_BANNER_PATH: require('path').join(__dirname, '..', 'assets', 'banner.png'),
  WAVE_EMOJI: '👋',
  EMBED_COLOR: 0x2fd9d3,
};
