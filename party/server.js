const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const partyDb = require("./partyDb");
const { parseStreamUrl } = require("./streamUrl");
const { fetchStreamMeta } = require("./streamMeta");
const { sanitizeText, isRateLimited } = require("./sanitize");
const { startTunnel, getTunnelUrl } = require("./tunnel");

const startedAt = Date.now();




const presence = new Map();

function toPublicParty(row, meta) {
  return {
    id: row.id,
    partyName: row.party_name,
    ownerName: row.owner_name,
    platform: row.platform,
    videoIdOrChannel: row.video_id_or_channel,
    visibility: row.visibility,
    createdAt: row.created_at,
    lastActive: row.last_active,
    ended: !!row.ended,
    meta: meta || null,
    participantCount: presence.get(row.id)?.size || 0
  };
}

function startPartyServer(client) {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_ORIGIN || "*" },
    transports: ["websocket", "polling"]
  });



  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      tunnelUrl: getTunnelUrl(),
      botOnline: !!client?.isReady?.(),
      timestamp: Date.now()
    });
  });

  app.get("/api/parties", async (req, res) => {
    const rows = partyDb.getPublicActiveParties();
    const parties = await Promise.all(
      rows.map(async (row) => {
        const meta = await fetchStreamMeta(row.platform, row.video_id_or_channel).catch(() => null);
        return toPublicParty(row, meta);
      })
    );
    res.json({ parties });
  });

  app.post("/api/parties", (req, res) => {
    if (isRateLimited(`create:${req.ip}`, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Too many parties created. Try again in a minute." });
    }

    const { streamUrl, partyName, visibility, ownerName } = req.body || {};
    if (!streamUrl || typeof streamUrl !== "string") {
      return res.status(400).json({ error: "streamUrl is required." });
    }

    const parsed = parseStreamUrl(streamUrl);
    if (!parsed) {
      return res
        .status(400)
        .json({ error: "That doesn't look like a valid YouTube or Twitch URL." });
    }

    const { party, ownerToken } = partyDb.createParty({
      ownerName: sanitizeText(ownerName || "", 40) || null,
      partyName: sanitizeText(partyName || "", 60) || null,
      platform: parsed.platform,
      streamUrl,
      videoIdOrChannel: parsed.id,
      visibility: visibility === "private" ? "private" : "public"
    });

    res.status(201).json({ party: toPublicParty(party), ownerToken });
  });

  app.get("/api/parties/:id", async (req, res) => {
    const party = partyDb.getParty(req.params.id);
    if (!party || party.ended) return res.status(404).json({ error: "Party not found." });

    const meta = await fetchStreamMeta(party.platform, party.video_id_or_channel).catch(() => null);
    res.json({ party: toPublicParty(party, meta) });
  });

  app.patch("/api/parties/:id", (req, res) => {
    const ownerToken = req.headers["x-owner-token"];
    if (!partyDb.isOwner(req.params.id, ownerToken)) {
      return res.status(403).json({ error: "Not authorized." });
    }

    const { partyName, visibility, end } = req.body || {};
    if (end) {
      partyDb.endParty(req.params.id);
      io.to(`party:${req.params.id}`).emit("party:ended");
      return res.json({ ended: true });
    }

    const updated = partyDb.updateParty(req.params.id, {
      partyName: partyName !== undefined ? sanitizeText(partyName, 60) : undefined,
      visibility
    });
    if (!updated) return res.status(404).json({ error: "Party not found." });

    io.to(`party:${req.params.id}`).emit("party:updated", toPublicParty(updated));
    res.json({ party: toPublicParty(updated) });
  });

  app.delete("/api/parties/:id", (req, res) => {
    const ownerToken = req.headers["x-owner-token"];
    if (!partyDb.isOwner(req.params.id, ownerToken)) {
      return res.status(403).json({ error: "Not authorized." });
    }
    partyDb.endParty(req.params.id);
    io.to(`party:${req.params.id}`).emit("party:ended");
    res.json({ ended: true });
  });

  app.get("/api/stream/meta", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url query param is required." });

    const parsed = parseStreamUrl(url);
    if (!parsed) return res.status(400).json({ error: "Unrecognized YouTube/Twitch URL." });

    const meta = await fetchStreamMeta(parsed.platform, parsed.id).catch(() => null);
    res.json({ meta: meta ? { ...meta, platform: parsed.platform } : null });
  });

  app.post("/api/party/:id/heartbeat", (req, res) => {
    const party = partyDb.getParty(req.params.id);
    if (!party || party.ended) return res.status(404).json({ error: "Party not found." });
    partyDb.heartbeat(req.params.id);
    res.json({ ok: true });
  });



  io.on("connection", (socket) => {
    let joinedPartyId = null;
    let displayName = "Guest";

    socket.on("party:join", ({ partyId, displayName: name }) => {
      const party = partyDb.getParty(partyId);
      if (!party || party.ended) {
        socket.emit("party:error", { message: "Party not found or has ended." });
        return;
      }

      joinedPartyId = partyId;
      displayName = sanitizeText(name || "Guest", 30) || "Guest";
      socket.join(`party:${partyId}`);

      if (!presence.has(partyId)) presence.set(partyId, new Map());
      presence.get(partyId).set(socket.id, { displayName });

      socket.to(`party:${partyId}`).emit("chat:message", {
        system: true,
        text: `${displayName} joined the party.`,
        at: Date.now()
      });

      io.to(`party:${partyId}`).emit(
        "presence:update",
        [...presence.get(partyId).values()].map((p) => p.displayName)
      );
    });

    socket.on("chat:send", ({ text }) => {
      if (!joinedPartyId) return;
      if (isRateLimited(`chat:${socket.id}`, 8, 10 * 1000)) {
        socket.emit("party:error", { message: "You're sending messages too fast." });
        return;
      }

      const clean = sanitizeText(text, 500);
      if (!clean) return;

      io.to(`party:${joinedPartyId}`).emit("chat:message", {
        system: false,
        displayName,
        text: clean,
        at: Date.now()
      });
    });

    socket.on("sync:update", (payload) => {




      if (!joinedPartyId) return;
      socket.to(`party:${joinedPartyId}`).emit("sync:update", payload);
    });

    socket.on("sync:request", () => {
      if (!joinedPartyId) return;
      socket.to(`party:${joinedPartyId}`).emit("sync:request", { fromSocketId: socket.id });
    });

    socket.on("disconnect", () => {
      if (!joinedPartyId) return;
      const room = presence.get(joinedPartyId);
      if (room) {
        room.delete(socket.id);
        io.to(`party:${joinedPartyId}`).emit("chat:message", {
          system: true,
          text: `${displayName} left the party.`,
          at: Date.now()
        });
        io.to(`party:${joinedPartyId}`).emit(
          "presence:update",
          [...room.values()].map((p) => p.displayName)
        );
        if (room.size === 0) presence.delete(joinedPartyId);
      }
    });
  });

  const port = parseInt(process.env.PORT, 10) || 3000;
  server.listen(port, () => {
    console.log(`🎉 Party backend listening on port ${port}`);
    startTunnel(port).catch((err) => console.error("Tunnel startup failed:", err.message));
  });

  return { app, server, io };
}

module.exports = { startPartyServer };
