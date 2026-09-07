const levelHandler = require("../handlers/levelHandler");

module.exports = {
  name: "testlevelup",
  ownerOnly: true,
  async execute(message) {
    await levelHandler.testLevelUp(message.member);
  }
};
