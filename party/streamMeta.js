const CACHE_MS = 45 * 1000;
const cache = new Map();

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  cache.set(key, { at: Date.now(), data });
}

async function fetchYoutubeMeta(videoId) {
  const cacheKey = `yt:${videoId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const empty = {
    platform: "youtube",
    videoId,
    title: null,
    channelName: null,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    live: null,
    viewerCount: null,
    likeCount: null,
    subscriberCount: null
  };

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    setCached(cacheKey, empty);
    return empty;
  }

  try {
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,liveStreamingDetails&id=${videoId}&key=${apiKey}`
    );
    const videoData = await videoRes.json();
    const video = videoData.items?.[0];
    if (!video) {
      setCached(cacheKey, empty);
      return empty;
    }

    const result = {
      ...empty,
      title: video.snippet?.title || null,
      channelName: video.snippet?.channelTitle || null,
      thumbnail: video.snippet?.thumbnails?.high?.url || empty.thumbnail,
      live: video.snippet?.liveBroadcastContent === "live",
      viewerCount: video.liveStreamingDetails?.concurrentViewers
        ? parseInt(video.liveStreamingDetails.concurrentViewers, 10)
        : null,
      likeCount: video.statistics?.likeCount ? parseInt(video.statistics.likeCount, 10) : null
    };



    if (video.snippet?.channelId) {
      try {
        const chRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${video.snippet.channelId}&key=${apiKey}`
        );
        const chData = await chRes.json();
        const stats = chData.items?.[0]?.statistics;
        if (stats && !stats.hiddenSubscriberCount) {
          result.subscriberCount = parseInt(stats.subscriberCount, 10);
        }
      } catch {

      }
    }

    setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.error("YouTube metadata fetch failed:", err.message);
    setCached(cacheKey, empty);
    return empty;
  }
}

let twitchAppToken = null;
let twitchAppTokenExpiresAt = 0;

async function getTwitchAppToken() {
  if (twitchAppToken && Date.now() < twitchAppTokenExpiresAt) return twitchAppToken;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!data.access_token) return null;

  twitchAppToken = data.access_token;
  twitchAppTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return twitchAppToken;
}

async function fetchTwitchMeta(channel) {
  const cacheKey = `tw:${channel}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const empty = {
    platform: "twitch",
    channel,
    title: null,
    channelName: channel,
    thumbnail: null,
    live: false,
    viewerCount: null,
    followerCount: null,
    game: null
  };

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    setCached(cacheKey, empty);
    return empty;
  }

  try {
    const token = await getTwitchAppToken();
    if (!token) {
      setCached(cacheKey, empty);
      return empty;
    }

    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token}` };

    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channel}`, {
      headers
    });
    const streamData = await streamRes.json();
    const stream = streamData.data?.[0];

    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${channel}`, { headers });
    const userData = await userRes.json();
    const user = userData.data?.[0];

    const result = {
      ...empty,
      channelName: user?.display_name || channel,
      thumbnail: stream?.thumbnail_url
        ? stream.thumbnail_url.replace("{width}", "440").replace("{height}", "248")
        : user?.profile_image_url || null,
      live: !!stream,
      title: stream?.title || null,
      viewerCount: stream?.viewer_count ?? null,
      game: stream?.game_name || null
    };




    if (user?.id) {
      try {
        const followRes = await fetch(
          `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`,
          {
            headers
          }
        );
        if (followRes.ok) {
          const followData = await followRes.json();
          if (typeof followData.total === "number") result.followerCount = followData.total;
        }
      } catch {

      }
    }

    setCached(cacheKey, result);
    return result;
  } catch (err) {
    console.error("Twitch metadata fetch failed:", err.message);
    setCached(cacheKey, empty);
    return empty;
  }
}

async function fetchStreamMeta(platform, id) {
  if (platform === "youtube") return fetchYoutubeMeta(id);
  if (platform === "twitch") return fetchTwitchMeta(id);
  return null;
}

module.exports = { fetchStreamMeta, fetchYoutubeMeta, fetchTwitchMeta };
