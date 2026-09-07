const welcomeHandler = require("../handlers/welcomeHandler");

module.exports = {
  name: "testwelcome",
  ownerOnly: true,
  async execute(message) {
    await welcomeHandler.testWelcome(message.member);
  }
};
