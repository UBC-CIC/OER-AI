const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const ssm = new SSMClient({});

exports.handler = async function (event) {
  try {
    const paramName = process.env.WELCOME_MESSAGE_PARAM_NAME;
    const cmd = new GetParameterCommand({ Name: paramName, WithDecryption: false });
    const resp = await ssm.send(cmd);
    const welcomeMessage = (resp.Parameter && resp.Parameter.Value) || "Welcome to Opterna - the open AI study companion";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
      body: JSON.stringify({ welcomeMessage }),
    };
  } catch (err) {
    console.error("Failed to read welcome message from SSM:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to read welcome message" }),
    };
  }
};
