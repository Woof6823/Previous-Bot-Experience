const activeInterviews = new Set();

function key(channelId, userId) {
  return `${channelId}:${userId}`;
}

function start(channelId, userId) {
  activeInterviews.add(key(channelId, userId));
}

function end(channelId, userId) {
  activeInterviews.delete(key(channelId, userId));
}

function isActive(channelId, userId) {
  return activeInterviews.has(key(channelId, userId));
}

module.exports = { start, end, isActive };
