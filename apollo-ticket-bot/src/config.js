require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  prefix: process.env.COMMAND_PREFIX || '*',


  brand: {
    name: 'Apollo Region',

    color: 0x0B0F2E,
    accentColor: 0xE8D9B5,
    footer: 'Apollo Region',

    bannerAttachment: 'apollo_banner.png',
    bannerPath: __dirname + '/../assets/apollo_banner.png',
    thumbnail: 'attachment://apollo_banner.png'
  },


  welcomeChannels: {
    rules: '1529639015874166956',
    info: '1518378809231933601',
    verify: '1518386604001988830'
  },


  ticketTypes: {
    players: {
      label: 'Players Application',
      emoji: '🎮',
      description: 'Apply as a player/member of Apollo Region.',
      panelDescription: 'For users wanting to apply as a player/member.',
      roles: ['1518404878588710912'],
      categoryName: 'Players Applications'
    },
    staff: {
      label: 'Staff Application',
      emoji: '🛡️',
      description: 'Apply for a staff position on the team.',
      panelDescription: 'For users wanting to apply for a staff position.',
      roles: ['1518403750874710127'],
      categoryName: 'Staff Applications'
    },
    business: {
      label: 'Business Enquiries',
      emoji: '💼',
      description: 'Partnerships, sponsorships, and collaborations.',
      panelDescription: 'For partnerships, business enquiries, collaborations, etc.',
      roles: ['1526397040257663167'],
      categoryName: 'Business Enquiries'
    },
    support: {
      label: 'Support',
      emoji: '🎫',
      description: 'General help or issues with the server.',
      panelDescription: 'For general help or issues.',
      roles: ['1518413578229518447', '1528874683016151061', '1526397040257663167'],
      categoryName: 'Support'
    }
  }
};
