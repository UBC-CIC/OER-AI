const { initializeConnection } = require("./initializeConnection.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT, USER_POOL } = process.env;

// SQL conneciton from global variable at lib.js
let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  // Initialize the database connection if not already initialized
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "GET /user/exampleEndpoint":
        data = "Example endpoint invoked";
        response.body = JSON.stringify(data);
        break;
      case "POST /user_sessions":
        const sessionId = crypto.randomUUID();
        const result = await sqlConnection`
          INSERT INTO user_sessions (session_id, created_at, last_active_at)
          VALUES (${sessionId}, NOW(), NOW())
          RETURNING id, session_id, created_at
        `;
        data = {
          sessionId: result[0].session_id,
          userSessionId: result[0].id
        };
        response.body = JSON.stringify(data);
        break;
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 500;
    console.log(error);
    response.body = JSON.stringify(error.message);
  }
  console.log(response);
  return response;
};
