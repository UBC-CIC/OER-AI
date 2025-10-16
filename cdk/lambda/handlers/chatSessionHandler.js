const { initConnection, createResponse, parseBody, handleError, getSqlConnection } = require("./utils/handlerUtils.js");

(async () => {
  await initConnection();
})();

exports.handler = async (event) => {
  const response = createResponse();
  let data;
  
  try {
    const sqlConnection = getSqlConnection();
    const pathData = event.httpMethod + " " + event.resource;
    
    switch (pathData) {
      case "GET /textbooks/{id}/chat_sessions":
        const chatTextbookId = event.pathParameters?.id;
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
          SELECT id, user_sessions_session_id, textbook_id, context, created_at, metadata
          FROM chat_sessions
          WHERE textbook_id = ${chatTextbookId}
          ORDER BY created_at DESC
          LIMIT ${chatLimit} OFFSET ${chatOffset}
        `;
        
        data = {
          chat_sessions: chatSessions,
          pagination: {
            page: chatPage,
            limit: chatLimit,
            total: chatTotal,
            total_pages: Math.ceil(chatTotal / chatLimit)
          }
        };
        response.body = JSON.stringify(data);
        break;
        
      case "GET /textbooks/{id}/chat_sessions/user/{user_session_id}":
        const userChatTextbookId = event.pathParameters?.id;
        const userSessionId = event.pathParameters?.user_session_id;
        
        if (!userChatTextbookId || !userSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID and user_session_id are required" });
          break;
        }
        
        const userChatSessions = await sqlConnection`
          SELECT id, user_sessions_session_id, textbook_id, context, created_at, metadata
          FROM chat_sessions
          WHERE textbook_id = ${userChatTextbookId} AND user_sessions_session_id = ${userSessionId}
          ORDER BY created_at DESC
        `;
        
        data = userChatSessions;
        response.body = JSON.stringify(data);
        break;
        
      case "POST /textbooks/{id}/chat_sessions":
        const postChatTextbookId = event.pathParameters?.id;
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
          INSERT INTO chat_sessions (user_sessions_session_id, textbook_id, context)
          VALUES (${user_sessions_session_id}, ${postChatTextbookId}, ${context || {}})
          RETURNING id, user_sessions_session_id, textbook_id, context, created_at, metadata
        `;
        
        response.statusCode = 201;
        data = newChatSession[0];
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