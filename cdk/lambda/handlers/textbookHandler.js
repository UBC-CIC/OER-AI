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

exports.handler = async (event) => {
  const response = createResponse();
  let data;

  try {
    // Ensure connection is initialized before proceeding
    await initConnection();
    const pathData = event.httpMethod + " " + event.resource;

    switch (pathData) {
      case "GET /textbooks":
        const limit = Math.min(
          parseInt(event.queryStringParameters?.limit) || 20,
          100
        );
        const offset = parseInt(event.queryStringParameters?.offset) || 0;

        const result = await sqlConnection`
          SELECT 
            id, title, authors, publisher, publish_date, summary, language, level, textbook_logo_url, created_at,
            COUNT(*) OVER() as total_count
          FROM textbooks
          WHERE status = 'Active'
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        const total = result.length > 0 ? parseInt(result[0].total_count) : 0;
        const textbooks = result.map(({ total_count, ...book }) => book);

        data = {
          textbooks,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total,
          },
        };
        response.body = JSON.stringify(data);
        break;

      case "GET /textbooks/{textbook_id}":
        const textbookId = event.pathParameters?.textbook_id;
        if (!textbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const textbook = await sqlConnection`
          SELECT id, title, authors, license, source_url, publisher, publish_date, summary, language, level, textbook_logo_url, created_at, updated_at, metadata
          FROM textbooks
          WHERE id = ${textbookId}
        `;

        if (textbook.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }

        data = textbook[0];
        response.body = JSON.stringify(data);
        break;

      case "POST /textbooks":
        const createData = parseBody(event.body);
        const {
          title: createTitle,
          authors: createAuthors,
          license: createLicense,
          source_url: createSourceUrl,
          publisher: createPublisher,
          publish_date: createPublishDate,
          summary: createSummary,
          language: createLanguage,
          level: createLevel,
          created_by: createCreatedBy,
          metadata: createMetadata,
        } = createData;

        if (!createTitle) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Title is required" });
          break;
        }

        const newTextbook = await sqlConnection`
          INSERT INTO textbooks (title, authors, license, source_url, publisher, publish_date, summary, language, level, created_by, metadata)
          VALUES (${createTitle}, ${createAuthors || []}, ${
          createLicense || null
        }, ${createSourceUrl || null}, ${createPublisher || null}, ${
          createPublishDate || null
        }, ${createSummary || null}, ${createLanguage || null}, ${
          createLevel || null
        }, ${createCreatedBy || null}, ${createMetadata || {}})
          RETURNING id, title, authors, license, source_url, publisher, publish_date, summary, language, level, created_at, updated_at, metadata
        `;

        response.statusCode = 201;
        data = newTextbook[0];
        response.body = JSON.stringify(data);
        break;

      case "PUT /textbooks/{textbook_id}":
        const updateId = event.pathParameters?.textbook_id;
        if (!updateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const updateData = parseBody(event.body);
        const {
          title,
          authors,
          license,
          source_url,
          publisher,
          publish_date,
          summary,
          language,
          level,
          metadata,
        } = updateData;

        const updated = await sqlConnection`
          UPDATE textbooks 
          SET title = ${title}, authors = ${authors}, license = ${license}, source_url = ${source_url}, 
              publisher = ${publisher}, publish_date = ${publish_date}, summary = ${summary}, language = ${language}, 
              level = ${level}, metadata = ${metadata || {}}, updated_at = NOW()
          WHERE id = ${updateId}
          RETURNING id, title, authors, license, source_url, publisher, publish_date, summary, language, level, created_at, updated_at, metadata
        `;

        if (updated.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }

        data = updated[0];
        response.body = JSON.stringify(data);
        break;

      case "DELETE /textbooks/{textbook_id}":
        const deleteId = event.pathParameters?.textbook_id;
        if (!deleteId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

        const deleted = await sqlConnection`
          DELETE FROM textbooks WHERE id = ${deleteId} RETURNING id
        `;

        if (deleted.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
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
