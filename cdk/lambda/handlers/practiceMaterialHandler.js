// Minimal handler for generating practice materials (MCQs)
// For MVP, this returns structured dummy data based on input. Later, integrate Bedrock.

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

        // For MVP: generate a deterministic, placeholder quiz structure
        const questions = Array.from({ length: numQuestions }).map((_, qi) => {
          const correctIndex = 0; // Always 'a' for placeholder
          const options = Array.from({ length: numOptions }).map((__, oi) => ({
            id: generateOptionId(oi),
            text: oi === correctIndex ? `Correct option for Q${qi + 1}` : `Incorrect option ${oi + 1} for Q${qi + 1}`,
            explanation:
              oi === correctIndex
                ? `Correct. This aligns with the topic '${topic}' at ${difficulty} level.`
                : `Incorrect. Review the concepts in '${topic}' to understand why this is not correct.`,
          }));

        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            questionText: `(${difficulty}) [${topic}] Placeholder question ${qi + 1}?`,
            options,
            correctAnswer: generateOptionId(correctIndex),
          };
        });

        const result = {
          title: `Practice Quiz: ${topic}`,
          questions,
        };

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
