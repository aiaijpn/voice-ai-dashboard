require("dotenv").config();

const { saveAdminMessageHistory } = require("../services/adminMessageService");

async function run() {

  const result = await saveAdminMessageHistory({
    botId: "test_bot",
    userId: "U_TEST_USER",
    messageText: "ADR009 TEST MESSAGE",
    operatorMemo: "unit test"
  });

  console.log(JSON.stringify(result,null,2));

}

run();