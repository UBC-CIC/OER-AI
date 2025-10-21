const postgres = require("postgres");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const crypto = require("crypto");

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
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
  },
  body: "",
});

const parseBody = (body) => {
  try {
    return JSON.parse(body || "{}");
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
          userSessionId: result[0].id,
        };
        response.body = JSON.stringify(data);
        break;

      case "GET /user_sessions/{session_id}/interactions":
        const sessionId1 = event.pathParameters?.session_id;
        if (!sessionId1) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Session ID is required" });
          break;
        }

        // First, get the user_sessions.id from the session_id parameter
        const userSession1 = await sqlConnection`
          SELECT id FROM user_sessions WHERE session_id = ${sessionId1}
        `;

        if (userSession1.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "User session not found" });
          break;
        }

        const userSessionId1 = userSession1[0].id;
        const limit = Math.min(
          parseInt(event.queryStringParameters?.limit) || 20,
          100
        );
        const offset = parseInt(event.queryStringParameters?.offset) || 0;

        const interactionsResult = await sqlConnection`
          SELECT 
            id, session_id, sender_role, query_text, response_text, message_meta, source_chunks, created_at, order_index,
            COUNT(*) OVER() as total_count
          FROM user_interactions
          WHERE session_id = ${userSessionId1}
          ORDER BY order_index ASC, created_at ASC
          LIMIT ${limit} OFFSET ${offset}
        `;

        const total =
          interactionsResult.length > 0
            ? parseInt(interactionsResult[0].total_count)
            : 0;
        const interactions = interactionsResult.map(
          ({ total_count, ...interaction }) => interaction
        );

        data = {
          interactions,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total,
          },
        };
        response.body = JSON.stringify(data);
        break;

      case "POST /user_sessions/{session_id}/interactions":
        const sessionId2 = event.pathParameters?.session_id;
        if (!sessionId2) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Session ID is required" });
          break;
        }

        // First, get the user_sessions.id from the session_id parameter
        const userSession2 = await sqlConnection`
          SELECT id FROM user_sessions WHERE session_id = ${sessionId2}
        `;

        if (userSession2.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "User session not found" });
          break;
        }

        const userSessionId2 = userSession2[0].id;
        const createData = parseBody(event.body);
        const {
          sender_role,
          query_text,
          response_text,
          message_meta,
          source_chunks,
          order_index,
        } = createData;

        if (!sender_role) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "sender_role is required" });
          break;
        }

        const newInteraction = await sqlConnection`
          INSERT INTO user_interactions (session_id, sender_role, query_text, response_text, message_meta, source_chunks, order_index)
          VALUES (${userSessionId2}, ${sender_role}, ${query_text || null}, ${
          response_text || null
        }, ${message_meta || {}}, ${source_chunks || []}, ${
          order_index || null
        })
          RETURNING id, session_id, sender_role, query_text, response_text, message_meta, source_chunks, created_at, order_index
        `;

        response.statusCode = 201;
        data = newInteraction[0];
        response.body = JSON.stringify(data);
        break;

      case "GET /interactions/{id}":
        const interactionId = event.pathParameters?.id;
        if (!interactionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Interaction ID is required",
          });
          break;
        }

        const interaction = await sqlConnection`
          SELECT id, session_id, sender_role, query_text, response_text, message_meta, source_chunks, created_at, order_index
          FROM user_interactions
          WHERE id = ${interactionId}
        `;

        if (interaction.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Interaction not found" });
          break;
        }

        data = interaction[0];
        response.body = JSON.stringify(data);
        break;

      case "PUT /interactions/{id}":
        const updateInteractionId = event.pathParameters?.id;
        if (!updateInteractionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Interaction ID is required",
          });
          break;
        }

        const updateData = parseBody(event.body);
        const {
          sender_role: updateSenderRole,
          query_text: updateQueryText,
          response_text: updateResponseText,
          message_meta: updateMessageMeta,
          source_chunks: updateSourceChunks,
          order_index: updateOrderIndex,
        } = updateData;

        const updated = await sqlConnection`
          UPDATE user_interactions 
          SET sender_role = ${updateSenderRole}, query_text = ${updateQueryText}, response_text = ${updateResponseText}, 
              message_meta = ${updateMessageMeta || {}}, source_chunks = ${
          updateSourceChunks || []
        }, order_index = ${updateOrderIndex}
          WHERE id = ${updateInteractionId}
          RETURNING id, session_id, sender_role, query_text, response_text, message_meta, source_chunks, created_at, order_index
        `;

        if (updated.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Interaction not found" });
          break;
        }

        data = updated[0];
        response.body = JSON.stringify(data);
        break;

      case "DELETE /interactions/{id}":
        const deleteInteractionId = event.pathParameters?.id;
        if (!deleteInteractionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Interaction ID is required",
          });
          break;
        }

        const deleted = await sqlConnection`
          DELETE FROM user_interactions WHERE id = ${deleteInteractionId} RETURNING id
        `;

        if (deleted.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Interaction not found" });
          break;
        }

        response.statusCode = 204;
        response.body = "";
        break;

      case "GET /user_sessions/{session_id}/analytics":
        const analyticsSessionId = event.pathParameters?.session_id;
        if (!analyticsSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Session ID is required" });
          break;
        }

        // First, get the user_sessions.id from the session_id parameter
        const userSessionAnalytics = await sqlConnection`
          SELECT id FROM user_sessions WHERE session_id = ${analyticsSessionId}
        `;

        if (userSessionAnalytics.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "User session not found" });
          break;
        }

        const userSessionAnalyticsId = userSessionAnalytics[0].id;
        const analyticsLimit = Math.min(
          parseInt(event.queryStringParameters?.limit) || 20,
          100
        );
        const analyticsOffset =
          parseInt(event.queryStringParameters?.offset) || 0;

        const analyticsResult = await sqlConnection`
          SELECT 
            id, user_session_id, event_type, properties, created_at,
            COUNT(*) OVER() as total_count
          FROM analytics_events
          WHERE user_session_id = ${userSessionAnalyticsId}
          ORDER BY created_at DESC
          LIMIT ${analyticsLimit} OFFSET ${analyticsOffset}
        `;

        const analyticsTotal =
          analyticsResult.length > 0
            ? parseInt(analyticsResult[0].total_count)
            : 0;
        const analytics = analyticsResult.map(
          ({ total_count, ...event }) => event
        );

        data = {
          analytics,
          pagination: {
            limit: analyticsLimit,
            offset: analyticsOffset,
            total: analyticsTotal,
            hasMore: analyticsOffset + analyticsLimit < analyticsTotal,
          },
        };
        response.body = JSON.stringify(data);
        break;

      case "POST /user_sessions/{session_id}/analytics":
        const createAnalyticsSessionId = event.pathParameters?.session_id;
        if (!createAnalyticsSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Session ID is required" });
          break;
        }

        // First, get the user_sessions.id from the session_id parameter
        const userSessionCreate = await sqlConnection`
          SELECT id FROM user_sessions WHERE session_id = ${createAnalyticsSessionId}
        `;

        if (userSessionCreate.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "User session not found" });
          break;
        }

        const userSessionCreateId = userSessionCreate[0].id;
        const analyticsData = parseBody(event.body);
        const { event_type, properties } = analyticsData;

        if (!event_type) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "event_type is required" });
          break;
        }

        const newAnalytics = await sqlConnection`
          INSERT INTO analytics_events (user_session_id, event_type, properties)
          VALUES (${userSessionCreateId}, ${event_type}, ${properties || {}})
          RETURNING id, user_session_id, event_type, properties, created_at
        `;

        response.statusCode = 201;
        data = newAnalytics[0];
        response.body = JSON.stringify(data);
        break;

      case "GET /analytics/{id}":
        const analyticsId = event.pathParameters?.id;
        if (!analyticsId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Analytics ID is required" });
          break;
        }

        const analyticsEvent = await sqlConnection`
          SELECT id, user_session_id, event_type, properties, created_at
          FROM analytics_events
          WHERE id = ${analyticsId}
        `;

        if (analyticsEvent.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({
            error: "Analytics event not found",
          });
          break;
        }

        data = analyticsEvent[0];
        response.body = JSON.stringify(data);
        break;

      case "PUT /analytics/{id}":
        const updateAnalyticsId = event.pathParameters?.id;
        if (!updateAnalyticsId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Analytics ID is required" });
          break;
        }

        const updateAnalyticsData = parseBody(event.body);
        const { event_type: updateEventType, properties: updateProperties } =
          updateAnalyticsData;

        const updatedAnalytics = await sqlConnection`
          UPDATE analytics_events 
          SET event_type = ${updateEventType}, properties = ${
          updateProperties || {}
        }
          WHERE id = ${updateAnalyticsId}
          RETURNING id, user_session_id, event_type, properties, created_at
        `;

        if (updatedAnalytics.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({
            error: "Analytics event not found",
          });
          break;
        }

        data = updatedAnalytics[0];
        response.body = JSON.stringify(data);
        break;

      case "DELETE /analytics/{id}":
        const deleteAnalyticsId = event.pathParameters?.id;
        if (!deleteAnalyticsId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Analytics ID is required" });
          break;
        }

        const deletedAnalytics = await sqlConnection`
          DELETE FROM analytics_events WHERE id = ${deleteAnalyticsId} RETURNING id
        `;

        if (deletedAnalytics.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({
            error: "Analytics event not found",
          });
          break;
        }

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
