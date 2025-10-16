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
        
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    handleError(error, response);
  }
  
  console.log(response);
  return response;
};