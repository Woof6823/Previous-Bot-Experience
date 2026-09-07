let localtunnel;
try {
  localtunnel = require("localtunnel");
} catch {
  localtunnel = null;
}

let currentTunnel = null;
let currentUrl = null;
let reconnecting = false;

async function startTunnel(port) {
  if (!localtunnel) {
    console.warn(
      "⚠️ localtunnel package not installed — party backend will only be reachable locally."
    );
    return null;
  }

  const subdomain = process.env.TUNNEL_SUBDOMAIN || undefined;

  try {
    const tunnel = await localtunnel({ port, subdomain }).catch(async (err) => {
      if (subdomain) {
        console.warn(
          `⚠️ Tunnel subdomain "${subdomain}" unavailable (${err.message}), falling back to random.`
        );
        return localtunnel({ port });
      }
      throw err;
    });

    currentTunnel = tunnel;
    currentUrl = tunnel.url;
    console.log(`PUBLIC HTTPS URL: ${tunnel.url}`);

    tunnel.on("close", () => {
      console.warn("⚠️ Party tunnel closed — attempting to reconnect in 5s...");
      currentUrl = null;
      scheduleReconnect(port);
    });

    tunnel.on("error", (err) => {
      console.error("Party tunnel error:", err.message);
    });

    return tunnel;
  } catch (err) {
    console.error("Failed to start party tunnel:", err.message);
    scheduleReconnect(port);
    return null;
  }
}

function scheduleReconnect(port) {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(() => {
    reconnecting = false;
    startTunnel(port).catch(() => {});
  }, 5000);
}

function getTunnelUrl() {
  return currentUrl;
}

module.exports = { startTunnel, getTunnelUrl };
