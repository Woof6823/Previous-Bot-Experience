function parseStreamUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();


  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host === "music.youtube.com"
  ) {
    let videoId = null;

    if (host === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0];
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/live/")) {
      videoId = url.pathname.split("/")[2];
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2];
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2];
    }

    if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return { platform: "youtube", id: videoId };
    }
    return null;
  }


  if (host === "twitch.tv") {
    const parts = url.pathname.split("/").filter(Boolean);

    if (
      parts.length === 1 &&
      !["videos", "directory", "p", "settings", "subscriptions"].includes(parts[0])
    ) {
      const channel = parts[0];
      if (/^[a-zA-Z0-9_]{3,25}$/.test(channel)) {
        return { platform: "twitch", id: channel.toLowerCase() };
      }
    }
    return null;
  }

  return null;
}

module.exports = { parseStreamUrl };
