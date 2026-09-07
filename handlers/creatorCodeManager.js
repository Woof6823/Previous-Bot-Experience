const db = require("../database");

const FORUM_CHANNEL_ID = "1509662387236769912";

const SUPPORTER_ROLE_ID = "1534318801053814825";
const SURGE_EXCLUSIVE_ROLE_ID = "1534146788964040835";

const THANK_YOU_TEXT =
  "Thanks for participating in the event! You have been given the **Surge Supporter** and **Surge Exclusive** roles! 🎉\n\n" +
  "Go flex it in <#1540226927720271882>!";

const STRIKE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STRIKE_LIMIT = 3;

function isImageAttachment(attachment) {
  if (
    attachment.contentType &&
    attachment.contentType.startsWith("image/")
  ) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(
    attachment.name || ""
  );
}



async function fetchStarterMessageWithRetry(
  thread,
  attempts = 4,
  delayMs = 750
) {
  for (let i = 0; i < attempts; i++) {
    const starter = await thread
      .fetchStarterMessage()
      .catch(() => null);

    if (starter) {
      return starter;
    }

    if (i < attempts - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs)
      );
    }
  }

  return null;
}

async function handleThreadCreate(thread) {

  if (!thread.guild) return;


  if (thread.parentId !== FORUM_CHANNEL_ID) return;

  const ownerId = thread.ownerId;


  if (!ownerId) return;


  if (
    thread.guild.client.user &&
    ownerId === thread.guild.client.user.id
  ) {
    return;
  }



  if (db.getBlacklist(ownerId, "thread")) {
    await thread
      .delete("Creator-code forum: user is thread-blacklisted")
      .catch(() => {});

    return;
  }


  const starter = await fetchStarterMessageWithRetry(thread);


  const hasImage = !!starter?.attachments?.find(
    isImageAttachment
  );


  const member = await thread.guild.members
    .fetch(ownerId)
    .catch(() => null);





  if (hasImage) {
    if (member) {

      if (!member.roles.cache.has(SUPPORTER_ROLE_ID)) {
        await member.roles
          .add(
            SUPPORTER_ROLE_ID,
            "Creator-code event participation - image proof verified"
          )
          .catch((err) => {
            console.error(
              `Failed to add Surge Supporter role to ${ownerId}:`,
              err.message
            );
          });
      }


      if (!member.roles.cache.has(SURGE_EXCLUSIVE_ROLE_ID)) {
        await member.roles
          .add(
            SURGE_EXCLUSIVE_ROLE_ID,
            "Creator-code event participation - image proof verified"
          )
          .catch((err) => {
            console.error(
              `Failed to add Surge Exclusive role to ${ownerId}:`,
              err.message
            );
          });
      }
    }


    const payload = {
      content: THANK_YOU_TEXT,
      allowedMentions: {
        repliedUser: false,
        users: [],
        roles: []
      }
    };




    if (starter) {
      await starter
        .reply(payload)
        .catch(() =>
          thread.send(payload).catch(() => {})
        );
    } else {
      await thread.send(payload).catch(() => {});
    }

    return;
  }






  await thread
    .delete("Creator-code forum: no image attached to the post")
    .catch((err) => {
      console.error(
        `Failed to delete no-image thread ${thread.id}:`,
        err.message
      );
    });


  if (member) {
    await member
      .send(
        "📸 Your creator-code post was removed because it didn't have an image attached. " +
          "Please make a new thread and attach an image of you using the code this time."
      )
      .catch(() => {});
  }


  db.addCreatorThreadStrike(ownerId);


  const strikes = db.countCreatorThreadStrikes(
    ownerId,
    Date.now() - STRIKE_WINDOW_MS
  );





  if (strikes > STRIKE_LIMIT) {
    db.addBlacklist(
      ownerId,
      "thread",
      `${strikes} no-image creator-code threads within 7 days.`,
      thread.guild.client.user.id
    );


    if (member) {
      await member
        .send(
          "🚫 You've made too many creator-code threads without attaching an image. " +
            "You're no longer able to post in that forum. Contact staff if you believe this is a mistake."
        )
        .catch(() => {});
    }
  }
}

module.exports = {
  handleThreadCreate
};
