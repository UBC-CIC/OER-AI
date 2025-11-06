const postgres = require("postgres");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

let sqlConnection;
const secretsManager = new SecretsManagerClient();

const initConnection = async () => {
  if (!sqlConnection) {
    try {
      const getSecretValueCommand = new GetSecretValueCommand({
        SecretId: process.env.SM_DB_CREDENTIALS,
      });
      const secretResponse = await secretsManager.send(getSecretValueCommand);
      const credentials = JSON.parse(secretResponse.SecretString);
      
      const connectionConfig = {
        host: process.env.RDS_PROXY_ENDPOINT,
        port: credentials.port,
        username: credentials.username,
        password: credentials.password,
        database: credentials.dbname,
        ssl: { rejectUnauthorized: false },
      };
      
      sqlConnection = postgres(connectionConfig);
      await sqlConnection`SELECT 1`;
      console.log("Database connection initialized successfully");
    } catch (error) {
      console.error("Error initializing database connection:", error);
      throw error;
    }
  }
};

const createResponse = () => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
  },
  body: "",
});

const parseBody = (body) => {
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new Error("Invalid JSON body");
  }
};

const handleError = (error, response) => {
  response.statusCode = 500;
  console.log(error);
  response.body = JSON.stringify(error.message);
};

exports.handler = async (event) => {
  const response = createResponse();
  let data;
  
  try {
    // Ensure connection is initialized before proceeding
    await initConnection();
    const pathData = event.httpMethod + " " + event.resource;
    
    switch (pathData) {
      case "GET /textbooks/{textbook_id}/chat_sessions":
        const chatTextbookId = event.pathParameters?.textbook_id;
        if (!chatTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const chatPage = parseInt(event.queryStringParameters?.page || '1');
        const chatLimit = Math.min(parseInt(event.queryStringParameters?.limit || '50'), 100);
        const chatOffset = (chatPage - 1) * chatLimit;
        
        const chatTotalResult = await sqlConnection`
          SELECT COUNT(*) as total FROM chat_sessions WHERE textbook_id = ${chatTextbookId}
        `;
        const chatTotal = parseInt(chatTotalResult[0].total);
        
        const chatSessions = await sqlConnection`
          SELECT id, user_session_id, textbook_id, context, created_at, metadata
          FROM chat_sessions
          WHERE textbook_id = ${chatTextbookId}
          ORDER BY created_at DESC
          LIMIT ${chatLimit} OFFSET ${chatOffset}
        `;
        
        // Backward-compatible shape: include both user_session_id and user_sessions_session_id
        const chatSessionsCompat = chatSessions.map((row) => ({
          ...row,
          user_sessions_session_id: row.user_session_id,
        }));

        data = {
          chat_sessions: chatSessionsCompat,
          pagination: {
            page: chatPage,
            limit: chatLimit,
            total: chatTotal,
            total_pages: Math.ceil(chatTotal / chatLimit)
          }
        };
        response.body = JSON.stringify(data);
        break;
        
      case "GET /textbooks/{textbook_id}/chat_sessions/user/{user_session_id}":
        const userChatTextbookId = event.pathParameters?.textbook_id;
        const userSessionId = event.pathParameters?.user_session_id;
        
        if (!userChatTextbookId || !userSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID and user_session_id are required" });
          break;
        }
        
        const userChatSessions = await sqlConnection`
          SELECT id, user_session_id, textbook_id, context, created_at, metadata, name
          FROM chat_sessions
          WHERE textbook_id = ${userChatTextbookId} AND user_session_id = ${userSessionId}
          ORDER BY created_at DESC
        `;
        
        const userChatSessionsCompat = userChatSessions.map((row) => ({
          ...row,
          user_sessions_session_id: row.user_session_id,
        }));

        data = userChatSessionsCompat;
        response.body = JSON.stringify(data);
        break;
        
      case "POST /textbooks/{textbook_id}/chat_sessions":
        const postChatTextbookId = event.pathParameters?.textbook_id;
        if (!postChatTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const chatData = parseBody(event.body);
        const { user_sessions_session_id, context } = chatData;
        if (!user_sessions_session_id) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "user_sessions_session_id is required" });
          break;
        }
        
        const textbookExists = await sqlConnection`
          SELECT id FROM textbooks WHERE id = ${postChatTextbookId}
        `;
        if (textbookExists.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        const userSessionExists = await sqlConnection`
          SELECT id FROM user_sessions WHERE id = ${user_sessions_session_id}
        `;
        if (userSessionExists.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid user_sessions_session_id" });
          break;
        }
        
        const newChatSession = await sqlConnection`
          INSERT INTO chat_sessions (user_session_id, textbook_id, context)
          VALUES (${user_sessions_session_id}, ${postChatTextbookId}, ${context || {}})
          RETURNING id, user_session_id, textbook_id, context, created_at, metadata
        `;
        
        response.statusCode = 201;
        data = { ...newChatSession[0], user_sessions_session_id: newChatSession[0].user_session_id };
        response.body = JSON.stringify(data);
        break;
        
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    handleError(error, response);
  }
  
  console.log(response);
  return response;
};