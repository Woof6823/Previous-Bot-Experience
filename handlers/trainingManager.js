const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require("discord.js");
const db = require("../database");
const commandPermsOverride = require("../utils/commandPermsOverride");
const commandsGuideBuilder = require("./commandsGuideBuilder");
const { ALL_SCENARIOS } = require("../data/rosterScenarios");
const staffRecords = require("./staffRecords");

const TRAINING_CATEGORY_ID = "1536199571858915438";
const ROSTER_DOC_URL =
  "https://docs.google.com/document/d/11Vt46CN_b1SPqDHuY7ZjpSDvI_JoBlDh-wVur6rMiBA/edit?usp=sharing";



const CREATIVE_EXAMPLES_URL = "";

const TRAINING_COMMANDS = [
  "warn",
  "mute",
  "purge",
  "close",
  "delay",
  "undelay",
  "changetype",
  "unclaim",
  "htstats"
];

function getState(session) {
  try {
    return JSON.parse(session.state_json || "{}");
  } catch {
    return {};
  }
}

function saveState(channelId, stage, state) {
  return db.updateTrainingSession(channelId, { stage, state });
}

function isCorrectAnswer(scenario, choice) {
  if (Array.isArray(scenario.correctChoices)) return scenario.correctChoices.includes(choice);
  return scenario.correctChoice === choice;
}




function shouldSimulateCommand(channelId, commandName, args, clientUserId) {
  const session = db.getTrainingSession(channelId);
  if (!session || session.status !== "active") return false;
  if (session.stage === "practice_warn" && commandName === "warn") {
    const targetId = (args[0] || "").replace(/[<@!>]/g, "");
    if (targetId === clientUserId) return true;
  }
  if (session.stage === "practice_mute" && commandName === "mute") {
    const targetId = (args[0] || "").replace(/[<@!>]/g, "");
    if (targetId === clientUserId) return true;
  }
  return false;
}

function getSimulatedResult(commandName, botUserId) {
  if (commandName === "warn") {
    return `\u26a0\ufe0f <@${botUserId}> has been warned.`;
  }
  if (commandName === "mute") {
    return `\ud83d\udd07 <@${botUserId}> has been muted for 5m.`;
  }
  return "\u2705 Command executed successfully.";
}




async function startTrainingChannel(guild, admin, trainee) {
  const category = await guild.channels.fetch(TRAINING_CATEGORY_ID).catch(() => null);
  const channel = await guild.channels.create({
    name: `training-${trainee.user.username}`.toLowerCase().slice(0, 90),
    type: ChannelType.GuildText,
    parent: category?.id,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: trainee.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages
        ]
      },
      {
        id: admin.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  db.createTrainingSession(channel.id, guild.id, trainee.id, admin.id);

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("\ud83c\udf93 Welcome to the Staff Training Centre")
    .setDescription(
      `Hey ${trainee}! This channel walks you through everything a staff member needs to know.\n\n` +
        `**1.** \ud83d\udcd6 Staff commands overview\n` +
        `**2.** \ud83d\udee0\ufe0f Practice — warn, mute, and deleting messages\n` +
        `**3.** \ud83c\udfad Roster-application roleplay scenarios\n\n` +
        `You must finish the scenarios with **zero mistakes** — anything you get wrong comes back ` +
        `at the end of the list until you get it right.\n\n` +
        `Takes roughly 10\u201320 minutes. Click **Begin** whenever you're ready.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`training_begin_${channel.id}`)
      .setLabel("Begin")
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
  return channel;
}




async function handleBeginButton(interaction, channelId) {
  const session = db.getTrainingSession(channelId);
  if (!session || session.status !== "active") {
    await interaction.reply({ content: "This training session isn't active anymore.", flags: 64 });
    return;
  }
  if (interaction.user.id !== session.trainee_id) {
    await interaction.reply({ content: "This training session isn't for you.", flags: 64 });
    return;
  }

  for (const cmd of TRAINING_COMMANDS) commandPermsOverride.addOverride(cmd, session.trainee_id);
  saveState(channelId, "commands_intro", {});

  const commandLines = commandsGuideBuilder.ALL_STAFF_CATEGORIES.flatMap((cat) =>
    cat.commands.map((name) => `\`*${name}\``)
  );

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("\ud83d\udcd6 Staff Commands")
    .setDescription(
      `You now have permission to use every staff command below for the rest of this training:\n` +
        commandLines.slice(0, 40).join("  \u2022  ") +
        `\n\nRun \`*staffcommands\` any time for full descriptions of each one.\n` +
        `Click **Continue to Practice** when you've had a look.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`training_practice_${channelId}`)
      .setLabel("Continue to Practice")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.update({ embeds: [embed], components: [row] });
}




async function beginWarnPractice(interaction, channelId) {
  const session = db.getTrainingSession(channelId);
  if (!session || interaction.user.id !== session.trainee_id) {
    await interaction.reply({ content: "This isn't your training session.", flags: 64 });
    return;
  }

  saveState(channelId, "practice_warn", {});

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("\ud83d\udee0\ufe0f Practice 1/3 — Warnings")
    .setDescription(
      `Warnings are for smaller rule breaks that need a record.\n\n` +
        `**Try it now:** run \`*warn @${interaction.client.user.username} practicing the warn command\` right here.\n\n` +
        `*(Safe practice run — nothing really happens to me.)*`
    );

  await interaction.update({ embeds: [embed], components: [] });
}

async function handleCommandUsed(client, channelId, userId, commandName) {
  const session = db.getTrainingSession(channelId);
  if (!session || session.status !== "active" || session.trainee_id !== userId) return;

  if (session.stage === "practice_warn" && commandName === "warn") {
    await advanceToMutePractice(client, channelId);
  } else if (session.stage === "practice_mute" && commandName === "mute") {
    await advanceToDeletePractice(client, channelId);
  }
}

async function advanceToMutePractice(client, channelId) {
  saveState(channelId, "practice_mute", {});
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("\u2705 Warn done — Practice 2/3: Mutes")
        .setDescription(
          `Mutes (timeouts) are for bigger issues, like repeated disruption in voice or chat.\n\n` +
            `**Try it now:** run \`*mute @${client.user.username} 5m practicing the mute command\`.\n\n` +
            `*(Again, just practice — nothing really happens to me.)*`
        )
    ]
  });
}

async function advanceToDeletePractice(client, channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const dummy = await channel
    .send(
      "\ud83d\uddd1\ufe0f This is a throwaway message — delete it (right-click \u2192 Delete, or `*purge 3`)."
    )
    .catch(() => null);

  saveState(channelId, "practice_delete", { practiceMessageId: dummy?.id || null });

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("\u2705 Mute done — Practice 3/3: Deleting messages")
        .setDescription(
          `Last practical skill: deleting messages.\n` +
            `Delete the throwaway message just above this one — right-click \u2192 Delete, or run \`*purge 3\`.`
        )
    ]
  });
}




async function handleMessageDeleted(client, channelId, messageId) {
  const session = db.getTrainingSession(channelId);
  if (!session || session.status !== "active" || session.stage !== "practice_delete") return;

  const state = getState(session);
  if (state.practiceMessageId !== messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const queue = ALL_SCENARIOS.map((s) => s.id);
  saveState(channelId, "scenario", { queue, mistakeCount: 0, totalAttempts: 0 });

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("\u2705 All three practical skills done")
        .setDescription(
          `Now the real test — roster application roleplay. You'll act as the staff member ` +
            `handling the ticket in each situation below.\n\n` +
            `\ud83d\udcd6 Requirements doc (open any time): ${ROSTER_DOC_URL}\n\n` +
            `**You must get every scenario correct with zero mistakes.** Get one wrong and it ` +
            `comes back at the end of the list — and once the list is finished, if you had any ` +
            `mistakes at all, you restart the whole scenario pass.`
        )
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`training_start_scenarios_${channelId}`)
          .setLabel("Begin Scenarios")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });
}

async function handleStartScenarios(interaction, channelId) {
  const session = db.getTrainingSession(channelId);
  if (!session || interaction.user.id !== session.trainee_id) {
    await interaction.reply({ content: "This isn't your training session.", flags: 64 });
    return;
  }

  const queue = ALL_SCENARIOS.map((s) => s.id);
  saveState(channelId, "scenario", { queue, mistakeCount: 0, totalAttempts: 0 });

  await interaction.update({ content: "Starting scenarios...", embeds: [], components: [] });
  await presentNextScenario(interaction.channel, channelId);
}

async function presentNextScenario(channel, channelId) {
  const session = db.getTrainingSession(channelId);
  if (!session) return;

  const state = getState(session);
  if (!state.queue || state.queue.length === 0) {
    await completeTraining(channel, session);
    return;
  }

  const scenarioId = state.queue[0];
  const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    state.queue.shift();
    saveState(channelId, "scenario", state);
    await presentNextScenario(channel, channelId);
    return;
  }

  const remaining = state.queue.length;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83c\udfad Roleplay Scenario — ${scenario.category}`)
    .setDescription(
      `Read the situation below and pick how you'd handle it.\n` +
        `Not sure? Check the **\ud83d\udcd6 Requirements Doc** button below.`
    )
    .addFields({ name: "\ud83d\udccb Situation", value: scenario.prompt })
    .setFooter({
      text: `${remaining} scenario(s) left in this pass \u2022 Mistakes so far: ${state.mistakeCount || 0}`
    });

  const buttons = scenario.choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(`training_choice_${channelId}_${scenarioId}_${choice}`)
      .setLabel(choiceLabel(choice))
      .setStyle(choice.startsWith("deny") ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const helpButton = new ButtonBuilder()
    .setLabel("\ud83d\udcd6 Requirements Doc")
    .setStyle(ButtonStyle.Link)
    .setURL(ROSTER_DOC_URL);

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  const linkRow = new ActionRowBuilder().addComponents(helpButton);
  if (scenario.category === "Creative" && CREATIVE_EXAMPLES_URL) {
    linkRow.addComponents(
      new ButtonBuilder()
        .setLabel("\ud83c\udfac Example Clips")
        .setStyle(ButtonStyle.Link)
        .setURL(CREATIVE_EXAMPLES_URL)
    );
  }
  rows.push(linkRow);

  await channel.send({ embeds: [embed], components: rows });
}

function choiceLabel(choice) {
  const map = {
    accept: "Accept",
    deny: "Deny",
    "accept-grinder": "Give Grinder+ (highest role for under 13)",
    "accept-pro": "Accept — Pro Roster",
    "accept-ping": "Use *pro, then ping @firenzfn",
    "deny-unless-proof": "Deny unless proof they left the other team",
    "deny-offer-academy": "Deny 2.0 & offer Academy instead",
    "ask-more-proof": "Ask for more proof",
    "ask-for-proof": "Ask for proof",
    "ask-for-screenshot": "Ask for screenshots",
    "ask-new-clips": "Ask for new clips (video, incl. freebuild)",
    creator: "Content Creator",
    juniorcreator: "Junior Content Creator",
    creativeacademy: "Creative Academy",
    maincreative: "Main Creative",
    procreative: "Pro Creative",
    "accept-academy": "Accept — Academy",
    "accept-future-academy": "Accept — Future Academy",
    "accept-future2": "Accept — Future 2.0",
    "accept-semipro": "Accept — Semi Pro",
    "warn-first": "Warn them first",
    escalate: "Escalate to a higher authority"
  };
  return map[choice] || choice;
}

async function handleScenarioChoice(interaction, channelId, scenarioId, choice) {
  const session = db.getTrainingSession(channelId);
  if (!session || interaction.user.id !== session.trainee_id) {
    await interaction.reply({ content: "This isn't your training session.", flags: 64 });
    return;
  }

  const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
  const state = getState(session);
  state.totalAttempts = (state.totalAttempts || 0) + 1;

  const correct = isCorrectAnswer(scenario, choice);



  staffRecords.recordScenarioAttempt(channelId, scenarioId, correct);

  if (correct) {
    state.queue = state.queue.filter((id) => id !== scenarioId);
  } else {
    state.mistakeCount = (state.mistakeCount || 0) + 1;
    state.queue = [...state.queue.filter((id) => id !== scenarioId), scenarioId];
  }

  saveState(channelId, "scenario", state);

  const embed = new EmbedBuilder()
    .setColor(correct ? 0x57f287 : 0xed4245)
    .setTitle(correct ? "\u2705 Correct" : "\u274c Not quite")
    .setDescription(scenario.explanation)
    .addFields({ name: "\ud83d\udcdd Your answer", value: choiceLabel(choice) });

  if (!correct) {
    embed.addFields(
      {
        name: "\u2705 Accepted answer(s)",
        value: (Array.isArray(scenario.correctChoices)
          ? scenario.correctChoices
          : [scenario.correctChoice]
        )
          .map(choiceLabel)
          .join("\n")
      },
      {
        name: "\ud83d\udd01 Retry",
        value: "This scenario has been added back to the end of your list."
      }
    );
  }

  await interaction.update({ embeds: [embed], components: [] });

  await presentNextScenario(interaction.channel, channelId);
}




async function completeTraining(channel, session) {
  const state = getState(session);


  if ((state.mistakeCount || 0) > 0) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("\u274c Training Incomplete")
          .setDescription(
            `You made **${state.mistakeCount} mistake(s)** during the scenarios.\n\n` +
              `To pass, you must complete ALL scenarios with **zero mistakes** in a single pass.\n\n` +
              `\ud83d\udcd6 Review the requirements doc first: ${ROSTER_DOC_URL}\n\n` +
              `Click **Restart Training** to begin the scenarios again from the start.`
          )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`training_restart_${channel.id}`)
            .setLabel("Restart Training")
            .setStyle(ButtonStyle.Danger)
        )
      ]
    });
    return;
  }

  db.setTrainingStatus(channel.id, "completed");

  staffRecords.markTrainingCompleted(channel.id);

  for (const cmd of commandPermsOverride.getOverridesForUser(session.trainee_id)) {
    if (TRAINING_COMMANDS.includes(cmd))
      commandPermsOverride.removeOverride(cmd, session.trainee_id);
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("\ud83c\udf93 Training Complete!")
        .setDescription(
          `Perfect work, <@${session.trainee_id}> — every scenario correct with **zero mistakes**!\n\n` +
            `Your temporary command access has been removed. This channel will be deleted in 5 minutes.`
        )
    ]
  });

  setTimeout(() => channel.delete().catch(() => {}), 5 * 60 * 1000);
}

async function handleRestartTraining(interaction, channelId) {
  const session = db.getTrainingSession(channelId);
  if (!session || interaction.user.id !== session.trainee_id) {
    await interaction.reply({ content: "This isn't your training session.", flags: 64 });
    return;
  }

  const queue = ALL_SCENARIOS.map((s) => s.id);
  saveState(channelId, "scenario", { queue, mistakeCount: 0, totalAttempts: 0 });

  await interaction.update({ content: "Restarting scenarios...", embeds: [], components: [] });
  await presentNextScenario(interaction.channel, channelId);
}

module.exports = {
  startTrainingChannel,
  handleBeginButton,
  beginWarnPractice,
  handleCommandUsed,
  handleMessageDeleted,
  handleScenarioChoice,
  handleStartScenarios,
  handleRestartTraining,
  presentNextScenario,
  shouldSimulateCommand,
  getSimulatedResult
};
