const ticketManager = require('../ticketManager');




module.exports = async function channelDelete(channel) {
  try {
    await ticketManager.handleChannelDeleted(channel.id);
  } catch (err) {
    console.error('[channelDelete] Failed to clean up ticket state:', err);
  }
};
