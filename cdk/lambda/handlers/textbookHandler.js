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
      case "GET /textbooks":
        const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 20, 100);
        const offset = parseInt(event.queryStringParameters?.offset) || 0;
        
        const result = await sqlConnection`
          SELECT 
            id, title, authors, publisher, year, summary, language, level, created_at,
            COUNT(*) OVER() as total_count
          FROM textbooks
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        const total = result.length > 0 ? parseInt(result[0].total_count) : 0;
        const textbooks = result.map(({total_count, ...book}) => book);
        
        data = {
          textbooks,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
          }
        };
        response.body = JSON.stringify(data);
        break;
        
      case "GET /textbooks/{id}":
        const textbookId = event.pathParameters?.id;
        if (!textbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const textbook = await sqlConnection`
          SELECT id, title, authors, license, source_url, publisher, year, summary, language, level, created_at, updated_at, metadata
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
        const { title: createTitle, authors: createAuthors, license: createLicense, source_url: createSourceUrl, publisher: createPublisher, year: createYear, summary: createSummary, language: createLanguage, level: createLevel, created_by: createCreatedBy, metadata: createMetadata } = createData;
        
        if (!createTitle) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Title is required" });
          break;
        }
        
        const newTextbook = await sqlConnection`
          INSERT INTO textbooks (title, authors, license, source_url, publisher, year, summary, language, level, created_by, metadata)
          VALUES (${createTitle}, ${createAuthors || []}, ${createLicense || null}, ${createSourceUrl || null}, ${createPublisher || null}, ${createYear || null}, ${createSummary || null}, ${createLanguage || null}, ${createLevel || null}, ${createCreatedBy || null}, ${createMetadata || {}})
          RETURNING id, title, authors, license, source_url, publisher, year, summary, language, level, created_at, updated_at, metadata
        `;
        
        response.statusCode = 201;
        data = newTextbook[0];
        response.body = JSON.stringify(data);
        break;
        
      case "PUT /textbooks/{id}":
        const updateId = event.pathParameters?.id;
        if (!updateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const updateData = parseBody(event.body);
        const { title, authors, license, source_url, publisher, year, summary, language, level, metadata } = updateData;
        
        const updated = await sqlConnection`
          UPDATE textbooks 
          SET title = ${title}, authors = ${authors}, license = ${license}, source_url = ${source_url}, 
              publisher = ${publisher}, year = ${year}, summary = ${summary}, language = ${language}, 
              level = ${level}, metadata = ${metadata || {}}, updated_at = NOW()
          WHERE id = ${updateId}
          RETURNING id, title, authors, license, source_url, publisher, year, summary, language, level, created_at, updated_at, metadata
        `;
        
        if (updated.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Textbook not found" });
          break;
        }
        
        data = updated[0];
        response.body = JSON.stringify(data);
        break;
        
      case "DELETE /textbooks/{id}":
        const deleteId = event.pathParameters?.id;
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