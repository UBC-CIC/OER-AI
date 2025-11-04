// Handler for generating practice materials (MCQs)
// Now wired to Amazon Bedrock (Titan) to generate JSON questions directly.

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

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
    return JSON.parse(body || "{}");
  } catch {
    throw new Error("Invalid JSON body");
  }
};

const handleError = (error, response) => {
  response.statusCode = 500;
  console.error(error);
  response.body = JSON.stringify({ error: error.message || "Internal Server Error" });
};

function generateOptionId(index) {
  // 'a', 'b', 'c', ... up to 'z'
  return String.fromCharCode(97 + index);
}

// Clamp helper to bound numeric inputs
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Environment
const REGION = process.env.REGION || process.env.AWS_REGION || "ca-central-1";
// Provide a model id via env for flexibility; fallback to Titan Text Express if not set
// Example for env: PRACTICE_MATERIAL_MODEL_ID="amazon.titan-text-express-v1" or Titan multimodal ID when available
const MODEL_ID = process.env.PRACTICE_MATERIAL_MODEL_ID || "amazon.titan-text-express-v1";

// Build JSON-only prompt with fixed schema and counts
function buildPrompt({ topic, difficulty, numQuestions, numOptions }) {
  const optionIds = Array.from({ length: numOptions }, (_, i) => generateOptionId(i)).join('", "');
  return `
You are an assistant that generates practice materials in strict JSON. Output ONLY valid JSON. No markdown, no commentary.

Requirements:
- Topic: "${topic}"
- Difficulty: "${difficulty}" (beginner/intermediate/advanced difficulty of the question)
- Generate exactly ${numQuestions} question(s) with exactly ${numOptions} option(s) each
- Question IDs must be: q1, q2, q3, etc. (up to q${numQuestions})
- Option IDs per question: ${optionIds}
- Each question must be substantive and related to the topic
- Each option must be a complete, meaningful answer choice (not just "option-a" or "option-b")
- Each explanation must clearly explain why the option is correct or incorrect
- correctAnswer must be one of the option IDs
- The questions array MUST contain exactly ${numQuestions} question objects
- Output valid JSON only, no extra text

Expected JSON structure:
{
  "title": "Practice Quiz: ${topic}",
  "questions": [
    {
      "id": "q1",
      "questionText": "A complete, substantive question about ${topic}?",
      "options": [
        { "id": "a", "text": "A complete, meaningful answer option", "explanation": "Detailed explanation of why this is correct/incorrect" },
        { "id": "b", "text": "Another complete answer option", "explanation": "Another detailed explanation" }
      ],
      "correctAnswer": "a"
    }
  ]
}

CRITICAL: Generate exactly ${numQuestions} questions and exactly ${numOptions} options per question. The questions array must have ${numQuestions} items. Output JSON only.
`.trim();
}

// Invoke Titan model and return raw text output
async function invokeTitanJSON(prompt) {
  const client = new BedrockRuntimeClient({ region: REGION });

  const payload = {
    inputText: prompt,
    textGenerationConfig: {
      // Balanced temperature for focused but varied content
      temperature: 0.6,
      maxTokenCount: 512,
      topP: 0.9,
    },
  };

  const cmd = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const res = await client.send(cmd);
  const utf8 = Buffer.from(res.body).toString("utf-8");
  try {
    const parsed = JSON.parse(utf8);
    return (
      parsed?.results?.[0]?.outputText || parsed?.outputText || parsed?.generation || ""
    );
  } catch {
    return utf8;
  }
}

// Extract the first JSON object and parse
function tryParseJsonStrict(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON object");
  }
  const jsonSlice = text.slice(start, end + 1);
  return JSON.parse(jsonSlice);
}

// Validate structure and counts
function validateResultShape(obj, { numQuestions, numOptions }) {
  if (!obj || typeof obj !== "object") throw new Error("Invalid JSON root");
  if (typeof obj.title !== "string" || !obj.title.trim()) throw new Error("Invalid title");
  if (!Array.isArray(obj.questions)) throw new Error("questions must be an array");
  if (obj.questions.length !== numQuestions)
    throw new Error(`questions must have exactly ${numQuestions} items`);

  const allowedIds = new Set(
    Array.from({ length: numOptions }, (_, i) => generateOptionId(i))
  );

  obj.questions.forEach((q, idx) => {
    if (!q || typeof q !== "object") throw new Error(`Question[${idx}] invalid`);
    if (typeof q.id !== "string" || !q.id.trim()) throw new Error(`Question[${idx}].id invalid`);
    if (typeof q.questionText !== "string" || !q.questionText.trim())
      throw new Error(`Question[${idx}].questionText invalid`);
    if (!Array.isArray(q.options)) throw new Error(`Question[${idx}].options must be array`);
    if (q.options.length !== numOptions)
      throw new Error(`Question[${idx}].options must have exactly ${numOptions} items`);
    q.options.forEach((opt, oi) => {
      if (!opt || typeof opt !== "object")
        throw new Error(`Question[${idx}].options[${oi}] invalid`);
      if (!allowedIds.has(opt.id))
        throw new Error(
          `Question[${idx}].options[${oi}].id must be one of ${[...allowedIds].join(", ")}`
        );
      if (typeof opt.text !== "string" || !opt.text.trim())
        throw new Error(`Question[${idx}].options[${oi}].text invalid`);
      if (typeof opt.explanation !== "string" || !opt.explanation.trim())
        throw new Error(`Question[${idx}].options[${oi}].explanation invalid`);
    });
    if (!allowedIds.has(q.correctAnswer))
      throw new Error(
        `Question[${idx}].correctAnswer must be one of ${[...allowedIds].join(", ")}`
      );
  });

  return obj;
}

exports.handler = async (event) => {
  const response = createResponse();
  try {
    const pathData = event.httpMethod + " " + event.resource;

    switch (pathData) {
      case "POST /textbooks/{textbook_id}/practice_materials": {
        const textbookId = event.pathParameters?.textbook_id;
        if (!textbookId) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Textbook ID is required" });
          break;
        }

  const body = parseBody(event.body);
  const topic = String(body?.topic ?? "").trim();
  const materialType = String(body?.material_type ?? "mcq").trim().toLowerCase();

  const numQuestionsParsed = Number.parseInt(String(body?.num_questions ?? ""), 10);
  const numQuestions = clamp(Number.isNaN(numQuestionsParsed) ? 5 : numQuestionsParsed, 1, 20);

  const numOptionsParsed = Number.parseInt(String(body?.num_options ?? ""), 10);
  const numOptions = clamp(Number.isNaN(numOptionsParsed) ? 4 : numOptionsParsed, 2, 6);

  const difficulty = String(body?.difficulty ?? "intermediate").trim().toLowerCase();

        if (!topic) {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "'topic' is required" });
          break;
        }

        if (materialType !== "mcq") {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Only 'mcq' material_type is supported at this time" });
          break;
        }

        // Build prompt and invoke Titan to generate JSON
        const prompt = buildPrompt({ topic, difficulty, numQuestions, numOptions });

        let modelText = await invokeTitanJSON(prompt);
        let result;
        try {
          result = validateResultShape(tryParseJsonStrict(modelText), { numQuestions, numOptions });
        } catch (e1) {
          console.warn("First parse/validation failed:", e1?.message);
          const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response was invalid. You MUST return valid JSON only, exactly matching the schema and lengths. No extra commentary.`;
          modelText = await invokeTitanJSON(retryPrompt);
          result = validateResultShape(tryParseJsonStrict(modelText), { numQuestions, numOptions });
        }

        response.statusCode = 200;
        response.body = JSON.stringify(result);
        break;
      }

      default:
        response.statusCode = 404;
        response.body = JSON.stringify({ error: `Unsupported route: ${pathData}` });
    }
  } catch (err) {
    handleError(err, response);
  }

  return response;
};
