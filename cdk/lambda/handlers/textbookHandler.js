const { initializeConnection } = require("./initializeConnection.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;

// Initialize connection outside handler for Lambda performance
let sqlConnection;

const initConnection = async () => {
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }
};

// Initialize on cold start
(async () => {
  await initConnection();
})();

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  let data;
  try {
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
      case "PUT /textbooks/{id}":
        const updateId = event.pathParameters?.id;
        if (!updateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        let updateData;
        try {
          updateData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
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
      case "GET /textbooks/{id}/faq":
        const faqTextbookId = event.pathParameters?.id;
        if (!faqTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const faqs = await sqlConnection`
          SELECT id, question_text, answer_text, usage_count, last_used_at, cached_at
          FROM faq_cache
          WHERE textbook_id = ${faqTextbookId}
          ORDER BY usage_count DESC, cached_at DESC
        `;
        
        data = faqs;
        response.body = JSON.stringify(data);
        break;
      case "POST /textbooks/{id}/faq":
        const postFaqTextbookId = event.pathParameters?.id;
        if (!postFaqTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        let faqData;
        try {
          faqData = JSON.parse(event.body || '{}');
        } catch {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Invalid JSON body" });
          break;
        }
        
        const { question_text, answer_text } = faqData;
        if (!question_text || !answer_text) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "question_text and answer_text are required" });
          break;
        }
        
        const normalized_question = question_text.toLowerCase().trim();
        
        const newFaq = await sqlConnection`
          INSERT INTO faq_cache (textbook_id, question_text, answer_text, normalized_question)
          VALUES (${postFaqTextbookId}, ${question_text}, ${answer_text}, ${normalized_question})
          RETURNING id, question_text, answer_text, usage_count, last_used_at, cached_at
        `;
        
        response.statusCode = 201;
        data = newFaq[0];
        response.body = JSON.stringify(data);
        break;
      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 500;
    console.log(error);
    response.body = JSON.stringify(error.message);
  }
  console.log(response);
  return response;
};