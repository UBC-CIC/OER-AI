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
      case "GET /textbooks/{textbook_id}/faq":
        const faqTextbookId = event.pathParameters?.textbook_id;
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
        
      case "POST /textbooks/{textbook_id}/faq":
        const postFaqTextbookId = event.pathParameters?.textbook_id;
        if (!postFaqTextbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }
        
        const faqData = parseBody(event.body);
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
        
      case "GET /faq/{faq_id}":
        const faqId = event.pathParameters?.faq_id;
        if (!faqId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "FAQ ID is required" });
          break;
        }
        
        const faq = await sqlConnection`
          SELECT id, question_text, answer_text, usage_count, last_used_at, cached_at
          FROM faq_cache
          WHERE id = ${faqId}
        `;
        
        if (faq.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "FAQ entry not found" });
          break;
        }
        
        data = faq[0];
        response.body = JSON.stringify(data);
        break;
        
      case "PUT /faq/{faq_id}":
        const putFaqId = event.pathParameters?.faq_id;
        if (!putFaqId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "FAQ ID is required" });
          break;
        }
        
        const updateData = parseBody(event.body);
        const { question_text: updateQuestion, answer_text: updateAnswer } = updateData;
        
        const updateFields = [];
        const updateValues = [];
        
        if (updateQuestion) {
          updateFields.push('question_text = $' + (updateValues.length + 1));
          updateValues.push(updateQuestion);
          updateFields.push('normalized_question = $' + (updateValues.length + 1));
          updateValues.push(updateQuestion.toLowerCase().trim());
        }
        
        if (updateAnswer) {
          updateFields.push('answer_text = $' + (updateValues.length + 1));
          updateValues.push(updateAnswer);
        }
        
        if (updateFields.length === 0) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "No valid fields to update" });
          break;
        }
        
        updateValues.push(putFaqId);
        const updateQuery = `
          UPDATE faq_cache 
          SET ${updateFields.join(', ')}
          WHERE id = $${updateValues.length}
          RETURNING id, question_text, answer_text, usage_count, last_used_at, cached_at
        `;
        
        const updatedFaq = await sqlConnection.unsafe(updateQuery, updateValues);
        
        if (updatedFaq.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "FAQ entry not found" });
          break;
        }
        
        data = updatedFaq[0];
        response.body = JSON.stringify(data);
        break;
        
      case "DELETE /faq/{faq_id}":
        const deleteFaqId = event.pathParameters?.faq_id;
        if (!deleteFaqId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "FAQ ID is required" });
          break;
        }
        
        const deleteResult = await sqlConnection`
          DELETE FROM faq_cache
          WHERE id = ${deleteFaqId}
        `;
        
        if (deleteResult.count === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "FAQ entry not found" });
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