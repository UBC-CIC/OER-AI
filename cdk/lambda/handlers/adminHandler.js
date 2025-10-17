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

const { initConnection, createResponse, parseBody, handleError, getSqlConnection } = require("./utils/handlerUtils.js");

// Initialize connection during Lambda cold start (when container first starts)
// This improves performance for subsequent invocations (warm starts)
(async () => {
  await initConnection();
})();

/**
 * Main Lambda handler function
 * @param {Object} event - AWS Lambda event object containing HTTP request data
 * @returns {Object} HTTP response object with statusCode, headers, and body
 */
exports.handler = async (event) => {
  const response = createResponse();
  
  // Ensure database connection is ready (fallback for edge cases)
  await initConnection();
  const sqlConnection = getSqlConnection();

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
          response.body = JSON.stringify({ error: "display_name and email are required" });
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
        
      // DELETE /chat_sessions/{id} - Delete specific chat session (admin only)
      case "DELETE /chat_sessions/{id}":
        const chatSessionId = event.pathParameters?.id;
        if (!chatSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Chat session ID is required" });
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
    if (error.code === '23505') {
      // Unique constraint violation (duplicate email)
      response.statusCode = 409; // Conflict
      response.body = JSON.stringify({ error: 'Email already exists' });
    } else if (error.code === '23502') {
      // Not null constraint violation
      response.statusCode = 400; // Bad Request
      response.body = JSON.stringify({ error: 'Required field is missing' });
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
