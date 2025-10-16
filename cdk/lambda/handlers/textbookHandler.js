/**
 * AWS Lambda Handler for Textbook Management
 * 
 * This Lambda function handles HTTP requests for textbook operations including:
 * - CRUD operations on textbooks (Create, Read, Update, Delete)
 * - FAQ cache management for textbooks
 * 
 */

const { initializeConnection } = require("./initializeConnection.js");
// Environment variables are set in AWS Lambda configuration
// These contain database connection details stored in AWS Secrets Manager
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;

// Database connection variable - stored outside handler for performance optimization
// Lambda containers are reused across invocations, so we cache the connection
let sqlConnection;

/**
 * Initialize database connection using AWS RDS Proxy
 * RDS Proxy manages database connections and provides connection pooling
 */
const initConnection = async () => {
  if (!sqlConnection) {
    // Retrieve database credentials from AWS Secrets Manager and establish connection
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }
};

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
  // Standard HTTP response structure for API Gateway
  const response = {
    statusCode: 200, // Default success status
    headers: {
      // CORS headers to allow cross-origin requests from web browsers
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*", // Allow requests from any domain
      "Access-Control-Allow-Methods": "*", // Allow all HTTP methods
    },
    body: "", // Response data (will be JSON string)
  };

  let data; // Variable to store response data
  try {
    // Route requests based on HTTP method and URL path
    // event.httpMethod: GET, POST, PUT, DELETE
    // event.resource: URL pattern like /textbooks or /textbooks/{id}
    const pathData = event.httpMethod + " " + event.resource;
    
    // Handle different API endpoints using switch statement
    switch (pathData) {
      // GET /textbooks - Retrieve paginated list of all textbooks
      case "GET /textbooks":
        // Extract pagination parameters from URL query string (?limit=20&offset=0)
        // Default to 20 items per page, maximum 100 to prevent large responses
        const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 20, 100);
        const offset = parseInt(event.queryStringParameters?.offset) || 0;
        
        // Single optimized SQL query using window function to get both data and total count
        // This is more efficient than running separate SELECT and COUNT queries
        const result = await sqlConnection`
          SELECT 
            id, title, authors, publisher, year, summary, language, level, created_at,
            COUNT(*) OVER() as total_count
          FROM textbooks
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        // Extract total count and remove it from individual records
        const total = result.length > 0 ? parseInt(result[0].total_count) : 0;
        const textbooks = result.map(({total_count, ...book}) => book);
        
        // Structure response with pagination metadata
        data = {
          textbooks,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total // Indicates if more pages exist
          }
        };
        response.body = JSON.stringify(data);
        break;
      // GET /textbooks/{id} - Retrieve a specific textbook by its UUID
      case "GET /textbooks/{id}":
        // Extract textbook ID from URL path parameters (e.g., /textbooks/123e4567-e89b-12d3-a456-426614174000)
        const textbookId = event.pathParameters?.id;
        if (!textbookId) {
          response.statusCode = 400; // Bad Request
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Query database for specific textbook with all fields
        const textbook = await sqlConnection`
          SELECT id, title, authors, license, source_url, publisher, year, summary, language, level, created_at, updated_at, metadata
          FROM textbooks
          WHERE id = ${textbookId}
        `;
        
        // Check if textbook exists
        if (textbook.length === 0) {
          response.statusCode = 404; // Not Found
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        data = textbook[0]; // Return first (and only) result
        response.body = JSON.stringify(data);
        break;
      // PUT /textbooks/{id} - Update an existing textbook
      case "PUT /textbooks/{id}":
        const updateId = event.pathParameters?.id;
        if (!updateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Parse JSON request body containing updated textbook data
        let updateData;
        try {
          updateData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
        
        // Extract fields from request body
        const { title, authors, license, source_url, publisher, year, summary, language, level, metadata } = updateData;
        
        // Update textbook in database and return updated record
        // RETURNING clause gives us the updated data without a separate SELECT
        const updated = await sqlConnection`
          UPDATE textbooks 
          SET title = ${title}, authors = ${authors}, license = ${license}, source_url = ${source_url}, 
              publisher = ${publisher}, year = ${year}, summary = ${summary}, language = ${language}, 
              level = ${level}, metadata = ${metadata || {}}, updated_at = NOW()
          WHERE id = ${updateId}
          RETURNING id, title, authors, license, source_url, publisher, year, summary, language, level, created_at, updated_at, metadata
        `;
        
        // Check if textbook was found and updated
        if (updated.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        data = updated[0];
        response.body = JSON.stringify(data);
        break;
        
      // DELETE /textbooks/{id} - Remove a textbook from the database
      case "DELETE /textbooks/{id}":
        const deleteId = event.pathParameters?.id;
        if (!deleteId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Delete textbook and return the deleted ID to confirm operation
        const deleted = await sqlConnection`
          DELETE FROM textbooks WHERE id = ${deleteId} RETURNING id
        `;
        
        // Check if textbook existed and was deleted
        if (deleted.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        response.statusCode = 204; // No Content - successful deletion
        response.body = ""; // Empty body for 204 responses
        break;
      // GET /textbooks/{id}/faq - Retrieve FAQ cache entries for a specific textbook
      case "GET /textbooks/{id}/faq":
        const faqTextbookId = event.pathParameters?.id;
        if (!faqTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Get FAQ entries ordered by popularity (usage_count) and recency
        // This helps surface the most useful and recent Q&A pairs first
        const faqs = await sqlConnection`
          SELECT id, question_text, answer_text, usage_count, last_used_at, cached_at
          FROM faq_cache
          WHERE textbook_id = ${faqTextbookId}
          ORDER BY usage_count DESC, cached_at DESC
        `;
        
        data = faqs;
        response.body = JSON.stringify(data);
        break;
        
      // POST /textbooks/{id}/faq - Add new FAQ entry to textbook's cache
      case "POST /textbooks/{id}/faq":
        const postFaqTextbookId = event.pathParameters?.id;
        if (!postFaqTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Parse FAQ data from request body
        let faqData;
        try {
          faqData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
        
        // Validate required fields
        const { question_text, answer_text } = faqData;
        if (!question_text || !answer_text) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "question_text and answer_text are required" });
          break;
        }
        
        // Normalize question for search optimization (lowercase, trimmed)
        // This helps with fuzzy matching and search functionality
        const normalized_question = question_text.toLowerCase().trim();
        
        // Insert new FAQ entry and return the created record
        const newFaq = await sqlConnection`
          INSERT INTO faq_cache (textbook_id, question_text, answer_text, normalized_question)
          VALUES (${postFaqTextbookId}, ${question_text}, ${answer_text}, ${normalized_question})
          RETURNING id, question_text, answer_text, usage_count, last_used_at, cached_at
        `;
        
        response.statusCode = 201; // Created
        data = newFaq[0];
        response.body = JSON.stringify(data);
        break;
        
      // GET /textbooks/{id}/chat_sessions - Get all chat sessions for a textbook (paginated)
      case "GET /textbooks/{id}/chat_sessions":
        const chatTextbookId = event.pathParameters?.id;
        if (!chatTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Parse pagination parameters
        const chatPage = parseInt(event.queryStringParameters?.page || '1');
        const chatLimit = Math.min(parseInt(event.queryStringParameters?.limit || '50'), 100);
        const chatOffset = (chatPage - 1) * chatLimit;
        
        // Get total count for pagination metadata
        const chatTotalResult = await sqlConnection`
          SELECT COUNT(*) as total FROM chat_sessions WHERE textbook_id = ${chatTextbookId}
        `;
        const chatTotal = parseInt(chatTotalResult[0].total);
        
        // Get paginated chat sessions
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
        
      // GET /textbooks/{id}/chat_sessions/user/{user_session_id} - Get chat sessions for specific user
      case "GET /textbooks/{id}/chat_sessions/user/{user_session_id}":
        const userChatTextbookId = event.pathParameters?.id;
        const userSessionId = event.pathParameters?.user_session_id;
        
        if (!userChatTextbookId || !userSessionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID and user_session_id are required" });
          break;
        }
        
        // Get chat sessions for specific user and textbook
        const userChatSessions = await sqlConnection`
          SELECT id, user_sessions_session_id, textbook_id, context, created_at, metadata
          FROM chat_sessions
          WHERE textbook_id = ${userChatTextbookId} AND user_sessions_session_id = ${userSessionId}
          ORDER BY created_at DESC
        `;
        
        data = userChatSessions;
        response.body = JSON.stringify(data);
        break;
        
      // POST /textbooks/{id}/chat_sessions - Create new chat session for textbook
      case "POST /textbooks/{id}/chat_sessions":
        const postChatTextbookId = event.pathParameters?.id;
        if (!postChatTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Parse chat session data from request body
        let chatData;
        try {
          chatData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
        
        // Extract required user_sessions_session_id and optional context
        const { user_sessions_session_id, context } = chatData;
        if (!user_sessions_session_id) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "user_sessions_session_id is required" });
          break;
        }
        
        // Verify textbook exists
        const textbookExists = await sqlConnection`
          SELECT id FROM textbooks WHERE id = ${postChatTextbookId}
        `;
        if (textbookExists.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        // Verify user session exists
        const userSessionExists = await sqlConnection`
          SELECT id FROM user_sessions WHERE id = ${user_sessions_session_id}
        `;
        if (userSessionExists.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid user_sessions_session_id" });
          break;
        }
        
        // Create new chat session
        const newChatSession = await sqlConnection`
          INSERT INTO chat_sessions (user_sessions_session_id, textbook_id, context)
          VALUES (${user_sessions_session_id}, ${postChatTextbookId}, ${context || {}})
          RETURNING id, user_sessions_session_id, textbook_id, context, created_at, metadata
        `;
        
        response.statusCode = 201; // Created
        data = newChatSession[0];
        response.body = JSON.stringify(data);
        break;
        
      // GET /textbooks/{id}/sections - Get sections for a textbook
      case "GET /textbooks/{id}/sections":
        const sectionsTextbookId = event.pathParameters?.id;
        if (!sectionsTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Get sections ordered by order_index for proper hierarchy
        const sections = await sqlConnection`
          SELECT id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
          FROM sections
          WHERE textbook_id = ${sectionsTextbookId}
          ORDER BY order_index ASC
        `;
        
        data = sections;
        response.body = JSON.stringify(data);
        break;
        
      // POST /textbooks/{id}/sections - Create new section for textbook
      case "POST /textbooks/{id}/sections":
        const postSectionsTextbookId = event.pathParameters?.id;
        if (!postSectionsTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        // Parse section data from request body
        let sectionData;
        try {
          sectionData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
        
        // Extract fields from request body
        const { title: sectionTitle, parent_section_id, order_index, page_start, page_end, summary: sectionSummary } = sectionData;
        if (!sectionTitle) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "title is required" });
          break;
        }
        
        // Verify textbook exists
        const sectionTextbookExists = await sqlConnection`
          SELECT id FROM textbooks WHERE id = ${postSectionsTextbookId}
        `;
        if (sectionTextbookExists.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        // Create new section
        const newSection = await sqlConnection`
          INSERT INTO sections (textbook_id, parent_section_id, title, order_index, page_start, page_end, summary)
          VALUES (${postSectionsTextbookId}, ${parent_section_id || null}, ${sectionTitle}, ${order_index || null}, ${page_start || null}, ${page_end || null}, ${sectionSummary || null})
          RETURNING id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
        `;
        
        response.statusCode = 201; // Created
        data = newSection[0];
        response.body = JSON.stringify(data);
        break;
        
      // GET /sections/{id} - Get specific section by ID
      case "GET /sections/{id}":
        const getSectionId = event.pathParameters?.id;
        if (!getSectionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Section ID is required" });
          break;
        }
        
        const section = await sqlConnection`
          SELECT id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
          FROM sections
          WHERE id = ${getSectionId}
        `;
        
        if (section.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Section not found" });
          break;
        }
        
        data = section[0];
        response.body = JSON.stringify(data);
        break;
        
      // PUT /sections/{id} - Update specific section
      case "PUT /sections/{id}":
        const putSectionId = event.pathParameters?.id;
        if (!putSectionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Section ID is required" });
          break;
        }
        
        let putSectionData;
        try {
          putSectionData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
        
        const { title: putSectionTitle, parent_section_id: putParentSectionId, order_index: putOrderIndex, page_start: putPageStart, page_end: putPageEnd, summary: putSectionSummary } = putSectionData;
        
        const updatedSection = await sqlConnection`
          UPDATE sections 
          SET title = ${putSectionTitle}, parent_section_id = ${putParentSectionId || null}, order_index = ${putOrderIndex || null}, page_start = ${putPageStart || null}, page_end = ${putPageEnd || null}, summary = ${putSectionSummary || null}
          WHERE id = ${putSectionId}
          RETURNING id, textbook_id, parent_section_id, title, order_index, page_start, page_end, summary, created_at
        `;
        
        if (updatedSection.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Section not found" });
          break;
        }
        
        data = updatedSection[0];
        response.body = JSON.stringify(data);
        break;
        
      // DELETE /sections/{id} - Delete specific section
      case "DELETE /sections/{id}":
        const deleteSectionId = event.pathParameters?.id;
        if (!deleteSectionId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Section ID is required" });
          break;
        }
        
        const deletedSection = await sqlConnection`
          DELETE FROM sections WHERE id = ${deleteSectionId} RETURNING id
        `;
        
        if (deletedSection.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Section not found" });
          break;
        }
        
        response.statusCode = 204; // No Content
        response.body = "";
        break;
        
      // Handle unsupported routes
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    // Global error handler for any unhandled exceptions
    // Returns 500 Internal Server Error with error message
    response.statusCode = 500;
    console.log(error); // Log error for AWS CloudWatch monitoring
    response.body = JSON.stringify(error.message);
  }
  
  // Log response for debugging (visible in AWS CloudWatch Logs)
  console.log(response);
  
  // Return HTTP response to API Gateway, which forwards it to the client
  return response;
};