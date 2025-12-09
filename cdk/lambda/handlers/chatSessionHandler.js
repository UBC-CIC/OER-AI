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
        
      case "GET /chat_sessions/{chat_session_id}/interactions":
        const chatSessionId = event.pathParameters?.chat_session_id;
        if (!chatSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "chat_session_id is required" });
          break;
        }
        
        // Verify chat session exists and get textbook_id
        const chatSessionResult = await sqlConnection`
          SELECT id, textbook_id FROM chat_sessions WHERE id = ${chatSessionId}
        `;
        
        if (chatSessionResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Chat session not found" });
          break;
        }
        
        // Fetch all interactions for this chat session
        const interactions = await sqlConnection`
          SELECT id, sender_role, query_text, response_text, source_chunks, created_at, order_index
          FROM user_interactions
          WHERE chat_session_id = ${chatSessionId}
          ORDER BY order_index ASC, created_at ASC
        `;
        
        data = {
          chat_session_id: chatSessionResult[0].id,
          textbook_id: chatSessionResult[0].textbook_id,
          interactions: interactions
        };
        response.body = JSON.stringify(data);
        break;
        
      case "POST /chat_sessions/fork":
        const forkData = parseBody(event.body);
        const { source_chat_session_id, user_session_id, textbook_id } = forkData;
        
        // Validate required parameters
        if (!source_chat_session_id) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Missing required parameter: source_chat_session_id" });
          break;
        }
        if (!user_session_id) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Missing required parameter: user_session_id" });
          break;
        }
        if (!textbook_id) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Missing required parameter: textbook_id" });
          break;
        }
        
        // Verify source chat session exists
        const sourceChatSession = await sqlConnection`
          SELECT id, textbook_id FROM chat_sessions WHERE id = ${source_chat_session_id}
        `;
        
        if (sourceChatSession.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Source chat session not found" });
          break;
        }
        
        // Verify user session exists
        const forkUserSessionExists = await sqlConnection`
          SELECT id FROM user_sessions WHERE id = ${user_session_id}
        `;
        
        if (forkUserSessionExists.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid user_session_id" });
          break;
        }
        
        // Fetch all interactions from source chat session
        const sourceInteractions = await sqlConnection`
          SELECT sender_role, query_text, response_text, source_chunks, order_index
          FROM user_interactions
          WHERE chat_session_id = ${source_chat_session_id}
          ORDER BY order_index ASC, created_at ASC
        `;
        
        // Create new chat session and copy interactions in a transaction
        const forkedChatSession = await sqlConnection.begin(async sql => {
          // Create new chat session
          const [newSession] = await sql`
            INSERT INTO chat_sessions (user_session_id, textbook_id, context)
            VALUES (${user_session_id}, ${textbook_id}, ${{}})
            RETURNING id, user_session_id, textbook_id, context, created_at, metadata
          `;
          
          // Copy interactions if any exist
          if (sourceInteractions.length > 0) {
            const interactionValues = sourceInteractions.map(interaction => ({
              chat_session_id: newSession.id,
              sender_role: interaction.sender_role,
              query_text: interaction.query_text,
              response_text: interaction.response_text,
              source_chunks: interaction.source_chunks,
              order_index: interaction.order_index
            }));
            
            await sql`
              INSERT INTO user_interactions ${sql(interactionValues)}
            `;
          }
          
          return newSession;
        });
        
        response.statusCode = 201;
        data = {
          chat_session_id: forkedChatSession.id,
          user_session_id: forkedChatSession.user_session_id,
          textbook_id: forkedChatSession.textbook_id,
          interactions_copied: sourceInteractions.length,
          created_at: forkedChatSession.created_at
        };
        response.body = JSON.stringify(data);
        break;
        
      case "DELETE /chat_sessions/{chat_session_id}":
        const deleteChatSessionId = event.pathParameters?.chat_session_id;
        const deleteUserSessionId = event.queryStringParameters?.user_session_id;
        
        if (!deleteChatSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "chat_session_id is required" });
          break;
        }
        
        if (!deleteUserSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "user_session_id is required" });
          break;
        }
        
        // Verify the chat session exists and belongs to the user
        const chatSessionToDelete = await sqlConnection`
          SELECT id, user_session_id FROM chat_sessions WHERE id = ${deleteChatSessionId}
        `;
        
        if (chatSessionToDelete.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Chat session not found" });
          break;
        }
        
        // Verify ownership
        if (chatSessionToDelete[0].user_session_id !== deleteUserSessionId) {
          response.statusCode = 403;
          response.body = JSON.stringify({ error: "You can only delete your own chat sessions" });
          break;
        }
        
        // Delete interactions first (although FK cascade should handle it)
        await sqlConnection`
          DELETE FROM user_interactions WHERE chat_session_id = ${deleteChatSessionId}
        `;
        
        // Delete the chat session
        await sqlConnection`
          DELETE FROM chat_sessions WHERE id = ${deleteChatSessionId}
        `;
        
        console.log(`Chat session ${deleteChatSessionId} deleted by user session ${deleteUserSessionId}`);
        response.statusCode = 204;
        response.body = "";
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