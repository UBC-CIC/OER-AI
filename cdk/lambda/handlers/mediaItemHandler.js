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
      case "GET /textbooks/{textbook_id}/media_items":
        const mediaTextbookId = event.pathParameters?.textbook_id;
        if (!mediaTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const mediaItems = await sqlConnection`
          SELECT id, textbook_id, media_type, uri, size_bytes, mime_type, description, page_start, page_end, created_at
          FROM media_items
          WHERE textbook_id = ${mediaTextbookId}
          ORDER BY created_at ASC
        `;
        
        data = mediaItems;
        response.body = JSON.stringify(data);
        break;
        
      case "POST /textbooks/{textbook_id}/media_items":
        const postMediaTextbookId = event.pathParameters?.textbook_id;
        if (!postMediaTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const mediaData = parseBody(event.body);
        const { media_type, uri, size_bytes, mime_type, description, page_start: mediaPageStart, page_end: mediaPageEnd } = mediaData;
        if (!media_type || !uri) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "media_type and uri are required" });
          break;
        }
        
        const mediaTextbookExists = await sqlConnection`
          SELECT id FROM textbooks WHERE id = ${postMediaTextbookId}
        `;
        if (mediaTextbookExists.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        const newMediaItem = await sqlConnection`
          INSERT INTO media_items (textbook_id, media_type, uri, size_bytes, mime_type, description, page_start, page_end)
          VALUES (${postMediaTextbookId}, ${media_type}, ${uri}, ${size_bytes || null}, ${mime_type || null}, ${description || null}, ${mediaPageStart || null}, ${mediaPageEnd || null})
          RETURNING id, textbook_id, media_type, uri, size_bytes, mime_type, description, page_start, page_end, created_at
        `;
        
        response.statusCode = 201;
        data = newMediaItem[0];
        response.body = JSON.stringify(data);
        break;
        
      case "GET /media_items/{media_item_id}":
        const getMediaId = event.pathParameters?.media_item_id;
        if (!getMediaId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Media item ID is required" });
          break;
        }
        
        const mediaItem = await sqlConnection`
          SELECT id, textbook_id, media_type, uri, size_bytes, mime_type, description, page_start, page_end, created_at
          FROM media_items
          WHERE id = ${getMediaId}
        `;
        
        if (mediaItem.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Media item not found" });
          break;
        }
        
        data = mediaItem[0];
        response.body = JSON.stringify(data);
        break;
        
      case "PUT /media_items/{media_item_id}":
        const putMediaId = event.pathParameters?.media_item_id;
        if (!putMediaId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Media item ID is required" });
          break;
        }
        
        const putMediaData = parseBody(event.body);
        const { media_type: putMediaType, uri: putUri, size_bytes: putSizeBytes, mime_type: putMimeType, description: putDescription, page_start: putMediaPageStart, page_end: putMediaPageEnd } = putMediaData;
        
        const updatedMediaItem = await sqlConnection`
          UPDATE media_items 
          SET media_type = ${putMediaType}, uri = ${putUri}, size_bytes = ${putSizeBytes || null}, mime_type = ${putMimeType || null}, description = ${putDescription || null}, page_start = ${putMediaPageStart || null}, page_end = ${putMediaPageEnd || null}
          WHERE id = ${putMediaId}
          RETURNING id, textbook_id, media_type, uri, size_bytes, mime_type, description, page_start, page_end, created_at
        `;
        
        if (updatedMediaItem.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Media item not found" });
          break;
        }
        
        data = updatedMediaItem[0];
        response.body = JSON.stringify(data);
        break;
        
      case "DELETE /media_items/{media_item_id}":
        const deleteMediaId = event.pathParameters?.media_item_id;
        if (!deleteMediaId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Media item ID is required" });
          break;
        }
        
        const deletedMediaItem = await sqlConnection`
          DELETE FROM media_items WHERE id = ${deleteMediaId} RETURNING id
        `;
        
        if (deletedMediaItem.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Media item not found" });
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