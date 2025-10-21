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
      case "GET /textbooks/{id}/chunks":
        const chunksTextbookId = event.pathParameters?.id;
        if (!chunksTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const chunksPage = parseInt(event.queryStringParameters?.page || '1');
        const chunksLimit = Math.min(parseInt(event.queryStringParameters?.limit || '50'), 100);
        const chunksOffset = (chunksPage - 1) * chunksLimit;
        
        const chunksTotalResult = await sqlConnection`
          SELECT COUNT(*) as total FROM document_chunks WHERE textbook_id = ${chunksTextbookId}
        `;
        const chunksTotal = parseInt(chunksTotalResult[0].total);
        
        const chunks = await sqlConnection`
          SELECT id, textbook_id, section_id, media_item_id, chunk_text, chunk_meta, created_at
          FROM document_chunks
          WHERE textbook_id = ${chunksTextbookId}
          ORDER BY created_at ASC
          LIMIT ${chunksLimit} OFFSET ${chunksOffset}
        `;
        
        data = {
          chunks: chunks,
          pagination: {
            page: chunksPage,
            limit: chunksLimit,
            total: chunksTotal,
            total_pages: Math.ceil(chunksTotal / chunksLimit)
          }
        };
        response.body = JSON.stringify(data);
        break;
        
      case "GET /chunks/{id}":
        const getChunkId = event.pathParameters?.id;
        if (!getChunkId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Chunk ID is required" });
          break;
        }
        
        const chunk = await sqlConnection`
          SELECT id, textbook_id, section_id, media_item_id, chunk_text, chunk_meta, created_at
          FROM document_chunks
          WHERE id = ${getChunkId}
        `;
        
        if (chunk.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Chunk not found" });
          break;
        }
        
        data = chunk[0];
        response.body = JSON.stringify(data);
        break;
        
      case "POST /textbooks/{id}/chunks":
        const postChunkTextbookId = event.pathParameters?.id;
        if (!postChunkTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const chunkData = parseBody(event.body);
        const { section_id, media_item_id, chunk_text, chunk_meta } = chunkData;
        if (!chunk_text) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "chunk_text is required" });
          break;
        }
        
        const newChunk = await sqlConnection`
          INSERT INTO document_chunks (textbook_id, section_id, media_item_id, chunk_text, chunk_meta)
          VALUES (${postChunkTextbookId}, ${section_id || null}, ${media_item_id || null}, ${chunk_text}, ${chunk_meta || {}})
          RETURNING id, textbook_id, section_id, media_item_id, chunk_text, chunk_meta, created_at
        `;
        
        response.statusCode = 201;
        data = newChunk[0];
        response.body = JSON.stringify(data);
        break;
        
      case "PUT /chunks/{id}":
        const putChunkId = event.pathParameters?.id;
        if (!putChunkId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Chunk ID is required" });
          break;
        }
        
        const updateChunkData = parseBody(event.body);
        const { section_id: updateSectionId, media_item_id: updateMediaItemId, chunk_text: updateChunkText, chunk_meta: updateChunkMeta } = updateChunkData;
        
        const updateFields = [];
        const updateValues = [];
        
        if (updateSectionId !== undefined) {
          updateFields.push('section_id = $' + (updateValues.length + 1));
          updateValues.push(updateSectionId);
        }
        
        if (updateMediaItemId !== undefined) {
          updateFields.push('media_item_id = $' + (updateValues.length + 1));
          updateValues.push(updateMediaItemId);
        }
        
        if (updateChunkText) {
          updateFields.push('chunk_text = $' + (updateValues.length + 1));
          updateValues.push(updateChunkText);
        }
        
        if (updateChunkMeta !== undefined) {
          updateFields.push('chunk_meta = $' + (updateValues.length + 1));
          updateValues.push(updateChunkMeta);
        }
        
        if (updateFields.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "No valid fields to update" });
          break;
        }
        
        updateValues.push(putChunkId);
        const updateQuery = `
          UPDATE document_chunks 
          SET ${updateFields.join(', ')}
          WHERE id = $${updateValues.length}
          RETURNING id, textbook_id, section_id, media_item_id, chunk_text, chunk_meta, created_at
        `;
        
        const updatedChunk = await sqlConnection.unsafe(updateQuery, updateValues);
        
        if (updatedChunk.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Chunk not found" });
          break;
        }
        
        data = updatedChunk[0];
        response.body = JSON.stringify(data);
        break;
        
      case "DELETE /chunks/{id}":
        const deleteChunkId = event.pathParameters?.id;
        if (!deleteChunkId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Chunk ID is required" });
          break;
        }
        
        const deleteResult = await sqlConnection`
          DELETE FROM document_chunks
          WHERE id = ${deleteChunkId}
        `;
        
        if (deleteResult.count === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Chunk not found" });
          break;
        }
        
        response.statusCode = 204;
        response.body = '';
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