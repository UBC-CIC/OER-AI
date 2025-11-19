/**
 * AWS Lambda Handler for Admin Operations
 *
 * This Lambda function handles HTTP requests for administrative operations including:
 * - Admin user management (create, read, update, delete)
 * - System administration tasks
 * - Content management operations
 *
 * This handler requires admin-level authentication via AWS Cognito.
 * Only authenticated admin users can access these endpoints.
 */

const postgres = require("postgres");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

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

/**
 * Main Lambda handler function
 * @param {Object} event - AWS Lambda event object containing HTTP request data
 * @returns {Object} HTTP response object with statusCode, headers, and body
 */
exports.handler = async (event) => {
  const response = createResponse();

  // Ensure database connection is ready
  await initConnection();
  await initConnection();

  let data; // Variable to store response data
  try {
    // Route requests based on HTTP method and URL path
    // event.httpMethod: GET, POST, PUT, DELETE
    // event.resource: URL pattern like /admin/users or /admin/exampleEndpoint
    const pathData = event.httpMethod + " " + event.resource;

    // Handle different API endpoints using switch statement
    switch (pathData) {
      // GET /admin/exampleEndpoint - Test endpoint for development and debugging
      case "GET /admin/exampleEndpoint":
        // Simple test response to verify Lambda function is working
        data = "Example endpoint invoked";
        response.body = JSON.stringify(data);
        break;

      // GET /admin/textbooks - Get all textbooks with user and question counts
      case "GET /admin/textbooks":
        // Query to get textbooks with aggregated user and question counts
        const textbooksData = await sqlConnection`
          SELECT 
            t.id,
            t.title,
            t.authors,
            t.publisher,
            t.publish_date,
            t.summary,
            t.language,
            t.level,
            t.created_at,
            t.updated_at,
            COUNT(DISTINCT cs.user_session_id) as user_count,
            COUNT(DISTINCT ui.id) as question_count
          FROM textbooks t
          LEFT JOIN chat_sessions cs ON t.id = cs.textbook_id
          LEFT JOIN user_interactions ui ON cs.id = ui.chat_session_id
          GROUP BY t.id, t.title, t.authors, t.publisher, t.publish_date, t.summary, t.language, t.level, t.created_at, t.updated_at
          ORDER BY t.created_at DESC
        `;

        // Format the response
        const formattedTextbooks = textbooksData.map((book) => ({
          id: book.id,
          title: book.title,
          authors: book.authors || [],
          publisher: book.publisher,
          publish_date: book.publish_date,
          summary: book.summary,
          language: book.language,
          level: book.level,
          created_at: book.created_at,
          updated_at: book.updated_at,
          user_count: parseInt(book.user_count) || 0,
          question_count: parseInt(book.question_count) || 0,
        }));

        response.statusCode = 200;
        response.body = JSON.stringify({ textbooks: formattedTextbooks });
        break;

      // POST /admin/users - Create new admin user in the system
      case "POST /admin/users":
        // Parse JSON request body containing new user data
        let userData;
        try {
          userData = parseBody(event.body);
        } catch (error) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: error.message });
          break;
        }

        // Extract user fields from request body
        const { display_name, email, institution_id } = userData;

        // Validate required fields
        if (!display_name || !email) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "display_name and email are required",
          });
          break;
        }

        // Insert new admin user into database
        // Using postgres library template literal syntax for better performance
        const result = await sqlConnection`
          INSERT INTO users (display_name, email, institution_id, role)
          VALUES (${display_name}, ${email}, ${institution_id || null}, 'admin')
          RETURNING id, display_name, email, role, institution_id, created_at
        `;

        response.statusCode = 201; // Created
        data = result[0];
        response.body = JSON.stringify(data);
        break;

      // DELETE /chat_sessions/{chat_session_id} - Delete specific chat session (admin only)
      case "DELETE /chat_sessions/{chat_session_id}":
        const chatSessionId = event.pathParameters?.chat_session_id;
        if (!chatSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Chat session ID is required",
          });
          break;
        }

        // Delete chat session and return deleted ID to confirm operation
        const deletedChat = await sqlConnection`
          DELETE FROM chat_sessions WHERE id = ${chatSessionId} RETURNING id
        `;

        // Check if chat session existed and was deleted
        if (deletedChat.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Chat session not found" });
          break;
        }

        response.statusCode = 204; // No Content - successful deletion
        response.body = ""; // Empty body for 204 responses
        break;

      // Handle unsupported routes
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    // Handle specific PostgreSQL error codes
    if (error.code === "23505") {
      // Unique constraint violation (duplicate email)
      response.statusCode = 409; // Conflict
      response.body = JSON.stringify({ error: "Email already exists" });
    } else if (error.code === "23502") {
      // Not null constraint violation
      response.statusCode = 400; // Bad Request
      response.body = JSON.stringify({ error: "Required field is missing" });
    } else {
      // Generic server error for other exceptions
      handleError(error, response);
    }
  }

  // Log response for debugging (visible in AWS CloudWatch Logs)
  console.log(response);

  // Return HTTP response to API Gateway, which forwards it to the client
  return response;
};
