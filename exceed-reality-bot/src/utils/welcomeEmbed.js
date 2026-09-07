const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const path = require("path");

const BANNER_PATH = path.join(__dirname, "..", "..", "assets", "banner.png");

function buildWelcomeMessage(user, bannerUrl) {
  const avatarUrl =
    user.displayAvatarURL({ size: 512, extension: "png" }) ||
    user.defaultAvatarURL();

  const mainEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "EDR Esports",
      iconURL: avatarUrl,
    })
    .setTitle("Welcome to the EDR Esports Discord")
    .setDescription(
      [
        `Welcome to the official EDR Esports`,
        `discord server! If you would like to join us, check`,
        `these channels to view the requirements and`,
        `where to apply:`,
        ``,
        `🎯 | <#1540058504939831496>`,
        `🎯 | <#1540058506273751070>`,
        `✉️ | <#1540058500405792819>`,
      ].join("\n")
    )
    .setThumbnail(avatarUrl)
    .setTimestamp();

  return { mainEmbed, avatarUrl, BANNER_PATH };
}

function buildFullWelcome(user, channels = {}) {
  const avatarUrl =
    user.displayAvatarURL({ size: 512, extension: "png" }) ||
    user.defaultAvatarURL();

  const playerReqMention = channels.playerReq
    ? `<#${channels.playerReq.id}>`
    : `<#1540058504939831496>`;

  const staffReqMention = channels.staffReq
    ? `<#${channels.staffReq.id}>`
    : `<#1540058506273751070>`;

  const contactUsMention = channels.contactUs
    ? `<#${channels.contactUs.id}>`
    : `<#1540058500405792819>`;

  const description = [
    `Welcome to the official EDR Esports`,
    `discord server! If you would like to join us, check`,
    `these channels to view the requirements and`,
    `where to apply:`,
    ``,
    `🎯 | ${playerReqMention}`,
    `🎯 | ${staffReqMention}`,
    `✉️ | ${contactUsMention}`,
  ].join("\n");

  const mainEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "EDR Esports",
      iconURL: avatarUrl,
    })
    .setTitle("Welcome to the EDR Esports Discord")
    .setDescription(description)
    .setThumbnail(avatarUrl)
    .setTimestamp();

  const bannerAttachment = new AttachmentBuilder(BANNER_PATH, {
    name: "banner.png",
  });

  const bannerEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setImage("attachment://banner.png")
    .setFooter({
      text: "EDR Esports™ | EST. September 2026",
    });

  return {
    embeds: [mainEmbed, bannerEmbed],
    files: [bannerAttachment],
  };
}

module.exports = { buildWelcomeMessage, buildFullWelcome, BANNER_PATH };
