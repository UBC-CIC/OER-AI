const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");

const ssm = new SSMClient({});

exports.handler = async function (event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const message = (body && body.welcomeMessage) || null;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing or invalid welcomeMessage" }),
      };
    }

    // Limit the length to prevent abuse
    if (message.length > 5000) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "welcomeMessage too long (max 5000 chars)" }),
      };
    }

    const paramName = process.env.WELCOME_MESSAGE_PARAM_NAME;

    const cmd = new PutParameterCommand({
      Name: paramName,
      Value: message,
      Type: "String",
      Overwrite: true,
    });
    await ssm.send(cmd);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "PUT,OPTIONS",
      },
      body: JSON.stringify({ message: "Welcome message updated" }),
    };
  } catch (err) {
    console.error("Failed to update welcome message:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to update welcome message" }),
    };
  }
};
