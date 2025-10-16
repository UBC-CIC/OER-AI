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
      case "GET /textbooks/{id}/media_items":
        const mediaTextbookId = event.pathParameters?.id;
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
        
      case "POST /textbooks/{id}/media_items":
        const postMediaTextbookId = event.pathParameters?.id;
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
        
      case "GET /media_items/{id}":
        const getMediaId = event.pathParameters?.id;
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
        
      case "PUT /media_items/{id}":
        const putMediaId = event.pathParameters?.id;
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
        
      case "DELETE /media_items/{id}":
        const deleteMediaId = event.pathParameters?.id;
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