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
      case "GET /prompt_templates":
        const limit = Math.min(
          parseInt(event.queryStringParameters?.limit) || 20,
          100
        );
        const offset = parseInt(event.queryStringParameters?.offset) || 0;

        const result = await sqlConnection`
          SELECT 
            id, name, description, type, current_version_id, created_by, visibility, metadata, created_at, updated_at,
            COUNT(*) OVER() as total_count
          FROM prompt_templates
          WHERE visibility = 'public'
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        const total = result.length > 0 ? parseInt(result[0].total_count) : 0;
        const templates = result.map(
          ({ total_count, ...template }) => template
        );

        data = {
          templates,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total,
          },
        };
        response.body = JSON.stringify(data);
        break;

      case "POST /prompt_templates":
        const createData = parseBody(event.body);
        const {
          name,
          description,
          type,
          current_version_id,
          created_by,
          visibility,
          metadata,
        } = createData;

        if (!name || !type) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Name and type are required",
          });
          break;
        }

        const newTemplate = await sqlConnection`
          INSERT INTO prompt_templates (name, description, type, current_version_id, created_by, visibility, metadata)
          VALUES (${name}, ${description || null}, ${type}, ${
          current_version_id || null
        }, ${created_by || null}, ${visibility || "private"}, ${metadata || {}})
          RETURNING id, name, description, type, current_version_id, created_by, visibility, metadata, created_at, updated_at
        `;

        response.statusCode = 201;
        data = newTemplate[0];
        response.body = JSON.stringify(data);
        break;

      case "GET /prompt_templates/{prompt_template_id}":
        const templateId = event.pathParameters?.prompt_template_id;
        if (!templateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        const template = await sqlConnection`
          SELECT id, name, description, type, current_version_id, created_by, visibility, metadata, created_at, updated_at
          FROM prompt_templates
          WHERE id = ${templateId}
        `;

        if (template.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Template not found" });
          break;
        }

        data = template[0];
        response.body = JSON.stringify(data);
        break;

      case "PUT /prompt_templates/{prompt_template_id}":
        const updateId = event.pathParameters?.prompt_template_id;
        if (!updateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        const updateData = parseBody(event.body);
        const {
          name: updateName,
          description: updateDescription,
          type: updateType,
          current_version_id: updateVersionId,
          visibility: updateVisibility,
          metadata: updateMetadata,
        } = updateData;

        const updated = await sqlConnection`
          UPDATE prompt_templates 
          SET name = ${updateName}, description = ${updateDescription}, type = ${updateType}, 
              current_version_id = ${updateVersionId}, visibility = ${updateVisibility}, 
              metadata = ${updateMetadata || {}}, updated_at = NOW()
          WHERE id = ${updateId}
          RETURNING id, name, description, type, current_version_id, created_by, visibility, metadata, created_at, updated_at
        `;

        if (updated.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Template not found" });
          break;
        }

        data = updated[0];
        response.body = JSON.stringify(data);
        break;

      case "DELETE /prompt_templates/{prompt_template_id}":
        const deleteId = event.pathParameters?.prompt_template_id;
        if (!deleteId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        const deleted = await sqlConnection`
          DELETE FROM prompt_templates WHERE id = ${deleteId} RETURNING id
        `;

        if (deleted.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Template not found" });
          break;
        }

        response.statusCode = 204;
        response.body = "";
        break;

      case "GET /prompt_templates/{prompt_template_id}/questions":
        const questionsTemplateId = event.pathParameters?.prompt_template_id;
        if (!questionsTemplateId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Template ID is required" });
          break;
        }

        const questions = await sqlConnection`
          SELECT id, question_text, order_index, created_at
          FROM guided_prompt_questions
          WHERE prompt_template_id = ${questionsTemplateId}
          ORDER BY order_index ASC
        `;

        response.body = JSON.stringify({ questions });
        break;

      case "POST /prompt_templates/{prompt_template_id}/questions":
        const newTemplateId = event.pathParameters?.prompt_template_id;
        const questionData = parseBody(event.body);
        const { questions: questionsToCreate } = questionData;

        if (
          !newTemplateId ||
          !questionsToCreate ||
          !Array.isArray(questionsToCreate) ||
          questionsToCreate.length === 0
        ) {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Template ID and questions array are required",
          });
          break;
        }

        const createdQuestions = [];
        for (const question of questionsToCreate) {
          const { question_text, order_index } = question;
          if (!question_text || order_index === undefined) {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "Each question must have question_text and order_index",
            });
            break;
          }

          const newQuestion = await sqlConnection`
            INSERT INTO guided_prompt_questions (prompt_template_id, question_text, order_index)
            VALUES (${newTemplateId}, ${question_text}, ${order_index})
            RETURNING id, question_text, order_index, created_at
          `;

          createdQuestions.push(newQuestion[0]);
        }

        response.statusCode = 201;
        response.body = JSON.stringify({ questions: createdQuestions });
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
