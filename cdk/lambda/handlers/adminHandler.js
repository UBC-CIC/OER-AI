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
const {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} = require("@aws-sdk/client-ssm");

let sqlConnection;
const secretsManager = new SecretsManagerClient();
const ssmClient = new SSMClient();

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
            t.status,
            t.created_at,
            t.updated_at,
            COUNT(DISTINCT cs.user_session_id) as user_count,
            COUNT(DISTINCT ui.id) as question_count
          FROM textbooks t
          LEFT JOIN chat_sessions cs ON t.id = cs.textbook_id
          LEFT JOIN user_interactions ui ON cs.id = ui.chat_session_id
          GROUP BY t.id, t.title, t.authors, t.publisher, t.publish_date, t.summary, t.language, t.level, t.status, t.created_at, t.updated_at
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
          status: book.status || "Disabled",
          created_at: book.created_at,
          updated_at: book.updated_at,
          user_count: parseInt(book.user_count) || 0,
          question_count: parseInt(book.question_count) || 0,
        }));

        response.statusCode = 200;
        response.body = JSON.stringify({ textbooks: formattedTextbooks });
        break;

      // GET /admin/textbooks/{textbook_id} - Get single textbook with detailed information
      case "GET /admin/textbooks/{textbook_id}":
        const getTextbookId = event.pathParameters?.textbook_id;
        if (!getTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        // Query textbook with aggregated stats
        const textbookDetails = await sqlConnection`
          SELECT 
            t.id,
            t.title,
            t.authors,
            t.publisher,
            t.publish_date,
            t.summary,
            t.language,
            t.level,
            t.status,
            t.source_url,
            t.license,
            t.created_at,
            t.updated_at,
            t.metadata,
            COUNT(DISTINCT cs.user_session_id) as user_count,
            COUNT(DISTINCT ui.id) as question_count,
            COUNT(DISTINCT s.id) as section_count,
            COUNT(DISTINCT mi.id) FILTER (WHERE mi.media_type = 'image') as image_count,
            COUNT(DISTINCT mi.id) FILTER (WHERE mi.media_type = 'video') as video_count,
            COUNT(DISTINCT mi.id) FILTER (WHERE mi.media_type = 'audio') as audio_count
          FROM textbooks t
          LEFT JOIN chat_sessions cs ON t.id = cs.textbook_id
          LEFT JOIN user_interactions ui ON cs.id = ui.chat_session_id
          LEFT JOIN sections s ON t.id = s.textbook_id
          LEFT JOIN media_items mi ON t.id = mi.textbook_id
          WHERE t.id = ${getTextbookId}
          GROUP BY t.id
        `;

        if (textbookDetails.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }

        const textbook = textbookDetails[0];
        response.statusCode = 200;
        response.body = JSON.stringify({
          id: textbook.id,
          title: textbook.title,
          authors: textbook.authors || [],
          publisher: textbook.publisher,
          publish_date: textbook.publish_date,
          summary: textbook.summary,
          language: textbook.language,
          level: textbook.level,
          status: textbook.status || "Disabled",
          source_url: textbook.source_url,
          license: textbook.license,
          created_at: textbook.created_at,
          updated_at: textbook.updated_at,
          metadata: textbook.metadata || {},
          user_count: parseInt(textbook.user_count) || 0,
          question_count: parseInt(textbook.question_count) || 0,
          section_count: parseInt(textbook.section_count) || 0,
          image_count: parseInt(textbook.image_count) || 0,
          video_count: parseInt(textbook.video_count) || 0,
          audio_count: parseInt(textbook.audio_count) || 0,
        });
        break;

      // PUT /admin/textbooks/{textbook_id} - Update textbook (including status)
      case "PUT /admin/textbooks/{textbook_id}":
        const updateTextbookId = event.pathParameters?.textbook_id;
        if (!updateTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        let updateData;
        try {
          updateData = parseBody(event.body);
        } catch (error) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: error.message });
          break;
        }

        // Build dynamic update query
        const allowedFields = [
          "title",
          "authors",
          "publisher",
          "publish_date",
          "summary",
          "language",
          "level",
          "status",
          "source_url",
          "license",
        ];
        const updates = [];
        const values = [];

        Object.keys(updateData).forEach((key) => {
          if (allowedFields.includes(key) && updateData[key] !== undefined) {
            updates.push(key);
            values.push(updateData[key]);
          }
        });

        if (updates.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "No valid fields to update",
          });
          break;
        }

        // Construct the SET clause dynamically
        const setClause = updates
          .map((field, idx) => `${field} = $${idx + 1}`)
          .join(", ");
        values.push(updateTextbookId); // Add textbook_id as the last parameter

        const updateResult = await sqlConnection.unsafe(
          `UPDATE textbooks 
           SET ${setClause}, updated_at = NOW() 
           WHERE id = $${values.length} 
           RETURNING id, title, authors, publisher, publish_date, summary, language, level, status, source_url, license, created_at, updated_at`,
          values
        );

        if (updateResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }

        response.statusCode = 200;
        response.body = JSON.stringify(updateResult[0]);
        break;

      // DELETE /admin/textbooks/{textbook_id} - Delete textbook
      case "DELETE /admin/textbooks/{textbook_id}":
        const deleteTextbookId = event.pathParameters?.textbook_id;
        if (!deleteTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const deletedTextbook = await sqlConnection`
          DELETE FROM textbooks WHERE id = ${deleteTextbookId} RETURNING id
        `;

        if (deletedTextbook.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }

        response.statusCode = 204;
        response.body = "";
        break;

      // GET /admin/textbooks/{textbook_id}/jobs - Get ingestion jobs for a textbook
      case "GET /admin/textbooks/{textbook_id}/jobs":
        const jobsTextbookId = event.pathParameters?.textbook_id;
        if (!jobsTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const jobs = await sqlConnection`
          SELECT 
            id,
            textbook_id,
            status,
            ingested_sections,
            total_sections,
            ingested_images,
            ingested_videos,
            error_message,
            started_at,
            completed_at,
            created_at,
            updated_at,
            metadata
          FROM jobs
          WHERE textbook_id = ${jobsTextbookId}
          ORDER BY created_at DESC
          LIMIT 10
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({ jobs });
        break;

      // GET /admin/textbooks/{textbook_id}/analytics - Get analytics for a specific textbook
      case "GET /admin/textbooks/{textbook_id}/analytics":
        const analyticsTextbookId = event.pathParameters?.textbook_id;
        if (!analyticsTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const analyticsTimeRange =
          event.queryStringParameters?.timeRange || "3m";

        // Calculate date range based on timeRange parameter
        let analyticsDaysBack = 90; // default 3 months
        if (analyticsTimeRange === "30d") analyticsDaysBack = 30;
        if (analyticsTimeRange === "7d") analyticsDaysBack = 7;

        const analyticsStartDate = new Date();
        analyticsStartDate.setDate(
          analyticsStartDate.getDate() - analyticsDaysBack
        );

        // Get time series data for users and questions specific to this textbook
        const textbookTimeSeriesData = await sqlConnection`
          WITH date_series AS (
            SELECT generate_series(
              DATE_TRUNC('day', ${analyticsStartDate.toISOString()}::timestamp),
              DATE_TRUNC('day', NOW()),
              '1 day'::interval
            )::date AS date
          ),
          daily_users AS (
            SELECT 
              DATE_TRUNC('day', cs.created_at)::date AS date,
              COUNT(DISTINCT cs.user_session_id) AS count
            FROM chat_sessions cs
            WHERE cs.textbook_id = ${analyticsTextbookId}
              AND cs.created_at >= ${analyticsStartDate.toISOString()}
            GROUP BY DATE_TRUNC('day', cs.created_at)::date
          ),
          daily_questions AS (
            SELECT 
              DATE_TRUNC('day', ui.created_at)::date AS date,
              COUNT(ui.id) AS count
            FROM user_interactions ui
            JOIN chat_sessions cs ON ui.chat_session_id = cs.id
            WHERE cs.textbook_id = ${analyticsTextbookId}
              AND ui.created_at >= ${analyticsStartDate.toISOString()}
            GROUP BY DATE_TRUNC('day', ui.created_at)::date
          )
          SELECT 
            TO_CHAR(ds.date, 'Mon DD') AS date,
            COALESCE(du.count, 0)::int AS users,
            COALESCE(dq.count, 0)::int AS questions
          FROM date_series ds
          LEFT JOIN daily_users du ON ds.date = du.date
          LEFT JOIN daily_questions dq ON ds.date = dq.date
          ORDER BY ds.date ASC
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          timeSeries: textbookTimeSeriesData,
        });
        break;

      // GET /admin/textbooks/{textbook_id}/faqs - Get FAQs for a specific textbook
      case "GET /admin/textbooks/{textbook_id}/faqs":
        const faqTextbookId = event.pathParameters?.textbook_id;
        if (!faqTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const faqs = await sqlConnection`
          SELECT 
            id,
            question_text,
            answer_text,
            usage_count,
            last_used_at,
            cached_at
          FROM faq_cache
          WHERE textbook_id = ${faqTextbookId}
          ORDER BY usage_count DESC, last_used_at DESC
          LIMIT 50
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({ faqs });
        break;

      // GET /admin/textbooks/{textbook_id}/shared_prompts - Get shared user prompts for a specific textbook
      case "GET /admin/textbooks/{textbook_id}/shared_prompts":
        const promptTextbookId = event.pathParameters?.textbook_id;
        if (!promptTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const sharedPrompts = await sqlConnection`
          SELECT 
            id,
            title,
            prompt_text,
            visibility,
            tags,
            role,
            reported,
            created_at,
            updated_at
          FROM shared_user_prompts
          WHERE textbook_id = ${promptTextbookId}
          ORDER BY created_at DESC
          LIMIT 50
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({ prompts: sharedPrompts });
        break;

      // GET /admin/analytics/practice - Get aggregated practice material analytics
      case "GET /admin/analytics/practice":
        // Get total count
        const totalPracticeAggResult = await sqlConnection`
          SELECT COUNT(*) as count 
          FROM practice_material_analytics
        `;
        const totalPracticeAgg = parseInt(totalPracticeAggResult[0].count) || 0;

        // Get count by type
        const typeBreakdownAgg = await sqlConnection`
          SELECT material_type, COUNT(*) as count
          FROM practice_material_analytics
          GROUP BY material_type
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          total_generated: totalPracticeAgg,
          by_type: typeBreakdownAgg,
        });
        break;

      // GET /admin/textbooks/{textbook_id}/practice_analytics - Get practice material analytics
      case "GET /admin/textbooks/{textbook_id}/practice_analytics":
        const practiceTextbookId = event.pathParameters?.textbook_id;
        if (!practiceTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        // Get total count
        const totalPracticeResult = await sqlConnection`
          SELECT COUNT(*) as count 
          FROM practice_material_analytics 
          WHERE textbook_id = ${practiceTextbookId}
        `;
        const totalPractice = parseInt(totalPracticeResult[0].count) || 0;

        // Get count by type
        const typeBreakdown = await sqlConnection`
          SELECT material_type, COUNT(*) as count
          FROM practice_material_analytics
          WHERE textbook_id = ${practiceTextbookId}
          GROUP BY material_type
        `;

        // Get count by difficulty
        const difficultyBreakdown = await sqlConnection`
          SELECT difficulty, COUNT(*) as count
          FROM practice_material_analytics
          WHERE textbook_id = ${practiceTextbookId}
          GROUP BY difficulty
        `;

        // Get recent generations
        const recentGenerations = await sqlConnection`
          SELECT 
            id,
            material_type,
            topic,
            num_items,
            difficulty,
            created_at
          FROM practice_material_analytics
          WHERE textbook_id = ${practiceTextbookId}
          ORDER BY created_at DESC
          LIMIT 20
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          total_generated: totalPractice,
          by_type: typeBreakdown,
          by_difficulty: difficultyBreakdown,
          recent_activity: recentGenerations,
        });
        break;

      // GET /admin/textbooks/{textbook_id}/ingestion_status - Get detailed ingestion status
      case "GET /admin/textbooks/{textbook_id}/ingestion_status":
        const statusTextbookId = event.pathParameters?.textbook_id;
        if (!statusTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        /* Get total expected sections from the latest ingest job
        const latestJob = await sqlConnection`
          SELECT total_sections 
          FROM jobs 
          WHERE textbook_id = ${statusTextbookId} AND type = 'ingest_textbook' 
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        const totalSections = latestJob.length > 0 ? latestJob[0].total_sections || 0 : 0;
        */

        // Get actual ingested sections count
        const ingestedSectionsResult = await sqlConnection`
          SELECT COUNT(*) as count FROM sections WHERE textbook_id = ${statusTextbookId}
        `;
        const ingestedSections = parseInt(ingestedSectionsResult[0].count) || 0;

        // Get collection ID for this textbook
        const collectionResult = await sqlConnection`
          SELECT uuid FROM langchain_pg_collection WHERE name = ${statusTextbookId}
        `;

        let imageCount = 0;
        let imagesList = [];

        if (collectionResult.length > 0) {
          const collectionId = collectionResult[0].uuid;

          // Get unique images from langchain embeddings
          // We deduplicate based on image src because multiple chunks in the same chapter
          // will contain the same media metadata
          const imagesListResult = await sqlConnection`
              WITH all_images AS (
                SELECT 
                  jsonb_array_elements(cmetadata->'media'->'images') as img_data,
                  cmetadata->>'chapter_number' as chapter_number,
                  cmetadata->>'source_title' as chapter_title
                FROM langchain_pg_embedding
                WHERE collection_id = ${collectionId}
                AND cmetadata->'media'->'images' IS NOT NULL
              )
              SELECT DISTINCT ON (img_data->>'src')
                 img_data, chapter_number, chapter_title
              FROM all_images
            `;

          imageCount = imagesListResult.length;

          imagesList = imagesListResult.map((row) => ({
            url: row.img_data.src,
            alt: row.img_data.alt,
            caption: row.img_data.caption,
            chapter_number: row.chapter_number,
            chapter_title: row.chapter_title,
          }));
        }

        response.statusCode = 200;
        response.body = JSON.stringify({
          total_sections: ingestedSections,
          ingested_sections: ingestedSections,
          image_count: imageCount,
          images: imagesList,
        });
        break;

      // POST /admin/textbooks/{textbook_id}/refresh - Trigger textbook re-ingestion
      case "POST /admin/textbooks/{textbook_id}/refresh":
        const refreshTextbookId = event.pathParameters?.textbook_id;
        if (!refreshTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        // Verify textbook exists
        const textbookToRefresh = await sqlConnection`
          SELECT id FROM textbooks WHERE id = ${refreshTextbookId}
        `;

        if (textbookToRefresh.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }

        // Create a new job for re-ingestion
        const newJob = await sqlConnection`
          INSERT INTO jobs (textbook_id, status, started_at)
          VALUES (${refreshTextbookId}, 'pending', NOW())
          RETURNING id, textbook_id, status, created_at
        `;

        // Update textbook status to 'Ingesting'
        await sqlConnection`
          UPDATE textbooks 
          SET status = 'Ingesting', updated_at = NOW()
          WHERE id = ${refreshTextbookId}
        `;

        response.statusCode = 201;
        response.body = JSON.stringify({
          message: "Refresh job created successfully",
          job: newJob[0],
        });
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

      // GET /admin/prompt_templates - Get all prompt templates
      case "GET /admin/prompt_templates":
        const promptTemplates = await sqlConnection`
          SELECT 
            id,
            name,
            description,
            type,
            current_version_id,
            created_by,
            visibility,
            metadata,
            created_at,
            updated_at
          FROM prompt_templates
          WHERE type = 'RAG' 
          ORDER BY created_at DESC
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({ templates: promptTemplates });
        break;

      // GET /admin/prompt_templates/{template_id} - Get single prompt template
      case "GET /admin/prompt_templates/{template_id}":
        const getTemplateId = event.pathParameters?.template_id;
        if (!getTemplateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        const templateDetails = await sqlConnection`
          SELECT 
            id,
            name,
            description,
            type,
            current_version_id,
            created_by,
            visibility,
            metadata,
            created_at,
            updated_at
          FROM prompt_templates
          WHERE id = ${getTemplateId}
        `;

        if (templateDetails.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Template not found" });
          break;
        }

        response.statusCode = 200;
        response.body = JSON.stringify(templateDetails[0]);
        break;

      // POST /admin/prompt_templates - Create new prompt template
      case "POST /admin/prompt_templates":
        let templateData;
        try {
          templateData = parseBody(event.body);
        } catch (error) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: error.message });
          break;
        }

        const { name, description, type, visibility, metadata } = templateData;

        // Validate required fields
        if (!name || !type) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "name and type are required",
          });
          break;
        }

        // Validate type enum
        const validTypes = [
          "RAG",
          "quiz_generation",
          "mcq_generation",
          "audio_generation",
        ];
        if (!validTypes.includes(type)) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
          });
          break;
        }

        // Validate visibility enum if provided
        const validVisibilities = ["private", "org", "public"];
        if (visibility && !validVisibilities.includes(visibility)) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: `Invalid visibility. Must be one of: ${validVisibilities.join(
              ", "
            )}`,
          });
          break;
        }

        const newTemplate = await sqlConnection`
          INSERT INTO prompt_templates (name, description, type, visibility, metadata)
          VALUES (
            ${name},
            ${description || null},
            ${type},
            ${visibility || "private"},
            ${metadata ? JSON.stringify(metadata) : "{}"}
          )
          RETURNING id, name, description, type, visibility, metadata, created_at, updated_at
        `;

        response.statusCode = 201;
        response.body = JSON.stringify(newTemplate[0]);
        break;

      // PUT /admin/prompt_templates/{template_id} - Update prompt template
      case "PUT /admin/prompt_templates/{template_id}":
        const updateTemplateId = event.pathParameters?.template_id;
        if (!updateTemplateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        let updateTemplateData;
        try {
          updateTemplateData = parseBody(event.body);
        } catch (error) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: error.message });
          break;
        }

        // Build dynamic update query for templates
        const allowedTemplateFields = [
          "name",
          "description",
          "type",
          "visibility",
          "metadata",
          "current_version_id",
        ];
        const templateUpdates = [];
        const templateValues = [];

        Object.keys(updateTemplateData).forEach((key) => {
          if (
            allowedTemplateFields.includes(key) &&
            updateTemplateData[key] !== undefined
          ) {
            // Validate type if being updated
            if (key === "type") {
              const validTypes = [
                "RAG",
                "quiz_generation",
                "mcq_generation",
                "audio_generation",
              ];
              if (!validTypes.includes(updateTemplateData[key])) {
                response.statusCode = 400;
                response.body = JSON.stringify({
                  error: `Invalid type. Must be one of: ${validTypes.join(
                    ", "
                  )}`,
                });
                return;
              }
            }
            // Validate visibility if being updated
            if (key === "visibility") {
              const validVisibilities = ["private", "org", "public"];
              if (!validVisibilities.includes(updateTemplateData[key])) {
                response.statusCode = 400;
                response.body = JSON.stringify({
                  error: `Invalid visibility. Must be one of: ${validVisibilities.join(
                    ", "
                  )}`,
                });
                return;
              }
            }
            templateUpdates.push(key);
            // Stringify metadata if it's an object
            if (
              key === "metadata" &&
              typeof updateTemplateData[key] === "object"
            ) {
              templateValues.push(JSON.stringify(updateTemplateData[key]));
            } else {
              templateValues.push(updateTemplateData[key]);
            }
          }
        });

        if (templateUpdates.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "No valid fields to update",
          });
          break;
        }

        // Construct the SET clause dynamically
        const templateSetClause = templateUpdates
          .map((field, idx) => `${field} = $${idx + 1}`)
          .join(", ");
        templateValues.push(updateTemplateId);

        const updateTemplateResult = await sqlConnection.unsafe(
          `UPDATE prompt_templates 
           SET ${templateSetClause}, updated_at = NOW() 
           WHERE id = $${templateValues.length} 
           RETURNING id, name, description, type, visibility, metadata, current_version_id, created_at, updated_at`,
          templateValues
        );

        if (updateTemplateResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Template not found" });
          break;
        }

        response.statusCode = 200;
        response.body = JSON.stringify(updateTemplateResult[0]);
        break;

      // DELETE /admin/prompt_templates/{template_id} - Delete prompt template
      case "DELETE /admin/prompt_templates/{template_id}":
        const deleteTemplateId = event.pathParameters?.template_id;
        if (!deleteTemplateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        const deletedTemplate = await sqlConnection`
          DELETE FROM prompt_templates WHERE id = ${deleteTemplateId} RETURNING id
        `;

        if (deletedTemplate.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Template not found" });
          break;
        }

        response.statusCode = 204;
        response.body = "";
        break;

      // GET /admin/analytics - Get analytics data
      case "GET /admin/analytics":
        const timeRange = event.queryStringParameters?.timeRange || "3m";

        // Calculate date range based on timeRange parameter
        let daysBack = 90; // default 3 months
        if (timeRange === "30d") daysBack = 30;
        if (timeRange === "7d") daysBack = 7;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        // Get time series data for users and questions
        const timeSeriesData = await sqlConnection`
          WITH date_series AS (
            SELECT generate_series(
              DATE_TRUNC('day', ${startDate.toISOString()}::timestamp),
              DATE_TRUNC('day', NOW()),
              '1 day'::interval
            )::date AS date
          ),
          daily_users AS (
            SELECT 
              DATE_TRUNC('day', us.created_at)::date AS date,
              COUNT(DISTINCT us.id) AS count
            FROM user_sessions us
            WHERE us.created_at >= ${startDate.toISOString()}
            GROUP BY DATE_TRUNC('day', us.created_at)::date
          ),
          daily_questions AS (
            SELECT 
              DATE_TRUNC('day', ui.created_at)::date AS date,
              COUNT(ui.id) AS count
            FROM user_interactions ui
            WHERE ui.created_at >= ${startDate.toISOString()}
            GROUP BY DATE_TRUNC('day', ui.created_at)::date
          )
          SELECT 
            TO_CHAR(ds.date, 'Mon DD') AS date,
            COALESCE(du.count, 0) AS users,
            COALESCE(dq.count, 0) AS questions
          FROM date_series ds
          LEFT JOIN daily_users du ON ds.date = du.date
          LEFT JOIN daily_questions dq ON ds.date = dq.date
          ORDER BY ds.date ASC
        `;

        // Get chat sessions per textbook
        const chatSessionsByTextbook = await sqlConnection`
          SELECT 
            t.id,
            t.title,
            COUNT(DISTINCT cs.id) AS session_count
          FROM textbooks t
          LEFT JOIN chat_sessions cs ON t.id = cs.textbook_id
          WHERE t.status = 'Active'
          GROUP BY t.id, t.title
          ORDER BY session_count DESC
          LIMIT 10
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          timeSeries: timeSeriesData,
          chatSessionsByTextbook: chatSessionsByTextbook.map((row) => ({
            name: row.title,
            sessions: parseInt(row.session_count),
          })),
        });
        break;

      // GET /admin/settings/token-limit - Get daily token limit
      case "GET /admin/settings/token-limit":
        try {
          const getCommand = new GetParameterCommand({
            Name: process.env.DAILY_TOKEN_LIMIT,
          });
          const parameterResult = await ssmClient.send(getCommand);

          response.statusCode = 200;
          response.body = JSON.stringify({
            tokenLimit: parameterResult.Parameter.Value,
          });
        } catch (error) {
          console.error("Error getting token limit:", error);
          response.statusCode = 500;
          response.body = JSON.stringify({
            error: "Failed to get token limit",
          });
        }
        break;

      // PUT /admin/settings/token-limit - Update daily token limit
      case "PUT /admin/settings/token-limit":
        let tokenLimitData;
        try {
          tokenLimitData = parseBody(event.body);
        } catch (error) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: error.message });
          break;
        }

        const { tokenLimit } = tokenLimitData;

        if (tokenLimit === undefined || tokenLimit === null) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "tokenLimit is required" });
          break;
        }

        // Validate tokenLimit is either "NONE" or a positive number
        if (
          tokenLimit !== "NONE" &&
          (isNaN(tokenLimit) || parseInt(tokenLimit) < 0)
        ) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "tokenLimit must be 'NONE' or a positive number",
          });
          break;
        }

        try {
          const putCommand = new PutParameterCommand({
            Name: process.env.DAILY_TOKEN_LIMIT,
            Value: String(tokenLimit),
            Overwrite: true,
          });
          await ssmClient.send(putCommand);

          response.statusCode = 200;
          response.body = JSON.stringify({
            message: "Token limit updated successfully",
            tokenLimit: String(tokenLimit),
          });
        } catch (error) {
          console.error("Error updating token limit:", error);
          response.statusCode = 500;
          response.body = JSON.stringify({
            error: "Failed to update token limit",
          });
        }
        break;

      // GET /admin/settings/system-prompt - Get system prompt
      case "GET /admin/settings/system-prompt":
        try {
          const result = await sqlConnection`
            SELECT value FROM system_settings WHERE key = 'system_prompt'
          `;

          const systemPrompt = result.length > 0 ? result[0].value : "";

          response.statusCode = 200;
          response.body = JSON.stringify({
            systemPrompt: systemPrompt,
          });
        } catch (error) {
          console.error("Error getting system prompt:", error);
          response.statusCode = 500;
          response.body = JSON.stringify({
            error: "Failed to get system prompt",
          });
        }
        break;

      // PUT /admin/settings/system-prompt - Update system prompt
      case "PUT /admin/settings/system-prompt":
        let promptData;
        try {
          promptData = parseBody(event.body);
        } catch (error) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: error.message });
          break;
        }

        const { systemPrompt } = promptData;

        if (systemPrompt === undefined || systemPrompt === null) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "systemPrompt is required" });
          break;
        }

        try {
          await sqlConnection`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('system_prompt', ${systemPrompt}, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
          `;

          response.statusCode = 200;
          response.body = JSON.stringify({
            message: "System prompt updated successfully",
            systemPrompt: String(systemPrompt),
          });
        } catch (error) {
          console.error("Error updating system prompt:", error);
          response.statusCode = 500;
          response.body = JSON.stringify({
            error: "Failed to update system prompt",
          });
        }
        break;

      // GET /admin/reported-items - Get all reported FAQs and shared prompts
      case "GET /admin/reported-items":
        // Get reported FAQs grouped by textbook
        const reportedFAQs = await sqlConnection`
          SELECT 
            f.id,
            f.textbook_id,
            f.question_text,
            f.answer_text,
            f.usage_count,
            f.last_used_at,
            f.cached_at,
            t.title as textbook_title
          FROM faq_cache f
          LEFT JOIN textbooks t ON f.textbook_id = t.id
          WHERE f.reported = true
          ORDER BY f.cached_at DESC
        `;

        // Get reported shared prompts grouped by textbook
        const reportedPrompts = await sqlConnection`
          SELECT 
            sp.id,
            sp.textbook_id,
            sp.title,
            sp.prompt_text,
            sp.visibility,
            sp.tags,
            sp.created_at,
            t.title as textbook_title
          FROM shared_user_prompts sp
          LEFT JOIN textbooks t ON sp.textbook_id = t.id
          WHERE sp.reported = true
          ORDER BY sp.created_at DESC
        `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          reportedFAQs: reportedFAQs,
          reportedPrompts: reportedPrompts,
        });
        break;

      // PUT /admin/reported-items/faq/{faq_id}/dismiss - Dismiss a reported FAQ
      case "PUT /admin/reported-items/faq/{faq_id}/dismiss":
        const dismissFaqId = event.pathParameters?.faq_id;
        if (!dismissFaqId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "FAQ ID is required" });
          break;
        }

        const dismissedFaq = await sqlConnection`
          UPDATE faq_cache
          SET reported = false
          WHERE id = ${dismissFaqId}
          RETURNING id
        `;

        if (dismissedFaq.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "FAQ not found" });
          break;
        }

        response.statusCode = 200;
        response.body = JSON.stringify({ message: "FAQ report dismissed" });
        break;

      // DELETE /admin/reported-items/faq/{faq_id} - Delete a reported FAQ
      case "DELETE /admin/reported-items/faq/{faq_id}":
        const deleteFaqId = event.pathParameters?.faq_id;
        if (!deleteFaqId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "FAQ ID is required" });
          break;
        }

        const deletedFaq = await sqlConnection`
          DELETE FROM faq_cache
          WHERE id = ${deleteFaqId}
          RETURNING id
        `;

        if (deletedFaq.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "FAQ not found" });
          break;
        }

        response.statusCode = 204;
        response.body = "";
        break;

      // PUT /admin/reported-items/prompt/{prompt_id}/dismiss - Dismiss a reported prompt
      case "PUT /admin/reported-items/prompt/{prompt_id}/dismiss":
        const dismissPromptId = event.pathParameters?.prompt_id;
        if (!dismissPromptId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Prompt ID is required" });
          break;
        }

        const dismissedPrompt = await sqlConnection`
          UPDATE shared_user_prompts
          SET reported = false
          WHERE id = ${dismissPromptId}
          RETURNING id
        `;

        if (dismissedPrompt.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Prompt not found" });
          break;
        }

        response.statusCode = 200;
        response.body = JSON.stringify({ message: "Prompt report dismissed" });
        break;

      // DELETE /admin/reported-items/prompt/{prompt_id} - Delete a reported prompt
      case "DELETE /admin/reported-items/prompt/{prompt_id}":
        const deletePromptId = event.pathParameters?.prompt_id;
        if (!deletePromptId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Prompt ID is required" });
          break;
        }

        const deletedPrompt = await sqlConnection`
          DELETE FROM shared_user_prompts
          WHERE id = ${deletePromptId}
          RETURNING id
        `;

        if (deletedPrompt.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Prompt not found" });
          break;
        }

        response.statusCode = 204;
        response.body = "";
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
