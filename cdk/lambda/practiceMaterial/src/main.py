import os
import json
import logging
import boto3
from typing import Any, Dict

from helpers.vectorstore import get_textbook_retriever
from langchain_aws import BedrockEmbeddings, ChatBedrock
#comment to trigger code pipeline
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment
REGION = os.environ.get("REGION", "ca-central-1")
SM_DB_CREDENTIALS = os.environ.get("SM_DB_CREDENTIALS", "")
RDS_PROXY_ENDPOINT = os.environ.get("RDS_PROXY_ENDPOINT", "")
PRACTICE_MATERIAL_MODEL_PARAM = os.environ.get("PRACTICE_MATERIAL_MODEL_PARAM")
EMBEDDING_MODEL_PARAM = os.environ.get("EMBEDDING_MODEL_PARAM")
BEDROCK_REGION_PARAM = os.environ.get("BEDROCK_REGION_PARAM")

# Clients
secrets_manager = boto3.client("secretsmanager", region_name=REGION)
ssm_client = boto3.client("ssm", region_name=REGION)
# bedrock_runtime will be initialized in initialize_constants() with the correct region

# Cache
_db_secret: Dict[str, Any] | None = None
_practice_material_model_id: str | None = None
_embedding_model_id: str | None = None
_bedrock_region: str | None = None
_embeddings = None
_bedrock_runtime = None
_llm = None


def get_secret_dict(name: str) -> Dict[str, Any]:
    global _db_secret
    if _db_secret is None:
        val = secrets_manager.get_secret_value(SecretId=name)["SecretString"]
        _db_secret = json.loads(val)
    return _db_secret


def get_parameter(param_name: str | None, cached_var: str | None) -> str | None:
    """Fetch SSM parameter value and update cache"""
    if cached_var is None and param_name:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return cached_var


def initialize_constants():
    """Initialize model IDs and region from SSM parameters"""
    global _practice_material_model_id, _embedding_model_id, _bedrock_region, _embeddings, _bedrock_runtime, _llm
    
    # Get practice material model ID from SSM
    _practice_material_model_id = get_parameter(PRACTICE_MATERIAL_MODEL_PARAM, _practice_material_model_id)
    logger.info(f"Practice material model ID: {_practice_material_model_id}")
    
    # Get embedding model ID from SSM
    _embedding_model_id = get_parameter(EMBEDDING_MODEL_PARAM, _embedding_model_id)
    logger.info(f"Embedding model ID: {_embedding_model_id}")
    
    # Get Bedrock region parameter
    if BEDROCK_REGION_PARAM:
        _bedrock_region = get_parameter(BEDROCK_REGION_PARAM, _bedrock_region)
        logger.info(f"Using Bedrock region: {_bedrock_region}")
    else:
        _bedrock_region = REGION
        logger.info(f"BEDROCK_REGION_PARAM not configured, using deployment region: {_bedrock_region}")
    
    # Initialize bedrock_runtime client with the correct region (matching textGeneration pattern)
    if _bedrock_runtime is None:
        _bedrock_runtime = boto3.client("bedrock-runtime", region_name=_bedrock_region)
        logger.info(f"Initialized bedrock_runtime client for region: {_bedrock_region}")
    
    # Initialize embeddings (use deployment region, matching textGeneration pattern)
    if _embeddings is None:
        _embeddings = BedrockEmbeddings(
            model_id=_embedding_model_id,
            client=boto3.client("bedrock-runtime", region_name=REGION),  # Separate client for embeddings in deployment region
            region_name=REGION,  # Use deployment region for embeddings, not _bedrock_region
        )
    
    # Initialize LLM using ChatBedrock (matching textGeneration pattern)
    if _llm is None:
        model_kwargs = {
            "temperature": 0.6,
            "max_tokens": 2048,
            "top_p": 0.9,
        }
        logger.info(f"Creating ChatBedrock instance for model: {_practice_material_model_id}")
        logger.info(f"Model parameters: {json.dumps(model_kwargs)}")
        
        _llm = ChatBedrock(
            model_id=_practice_material_model_id,
            model_kwargs=model_kwargs,
            client=_bedrock_runtime
        )
        logger.info("ChatBedrock LLM initialized successfully")


def clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


def build_prompt(topic: str, difficulty: str, num_questions: int, num_options: int, context_snippets: list[str]) -> str:
    option_ids = [chr(97 + i) for i in range(num_options)]
    context = "\n".join([f"- {c}" for c in context_snippets])
    
    return (
        f"You are an assistant that generates practice multiple choice questions in strict JSON format.\n\n"
        f"Context from textbook:\n{context}\n\n"
        f"Your task:\n"
        f"- Generate exactly {num_questions} multiple choice question(s)\n"
        f"- Topic: \"{topic}\"\n"
        f"- Difficulty: {difficulty}\n"
        f"- Each question must have exactly {num_options} answer options\n"
        f"- Use option IDs: {', '.join(option_ids)}\n"
        f"- Question IDs must be: q1, q2, q3, etc.\n\n"
        f"CRITICAL JSON SYNTAX RULES - FOLLOW EXACTLY:\n"
        f"1. Output ONLY valid JSON - no markdown, no explanations, no preamble\n"
        f"2. Use double quotes (\") for all strings, never single quotes\n"
        f"3. COMMAS ARE REQUIRED between all array elements and object properties\n"
        f"4. NEVER put a comma after the LAST item in an array or object\n"
        f'5. Escape quotes inside strings: use \\" for a literal quote character\n'
        f"6. Keep all text on single lines - no line breaks inside string values\n"
        f"7. Ensure all brackets and braces are properly closed\n"
        f"8. Pay special attention: comma BEFORE closing bracket/brace = ERROR\n\n"
        f"CORRECT comma placement examples:\n"
        f'- Between items: [{{"id": "a"}}, {{"id": "b"}}]  <- comma BETWEEN items\n'
        f'- Last item has NO comma: [{{"id": "a"}}, {{"id": "b"}}]  <- no comma before ]\n'
        f'- Object properties: {{"key1": "val1", "key2": "val2"}}  <- comma between, not after last\n\n'
        f"Required JSON structure:\n"
        f"{{\n"
        f'  "title": "Practice Quiz: {topic}",\n'
        f'  "questions": [\n'
        f"    {{\n"
        f'      "id": "q1",\n'
        f'      "questionText": "Write your question here",\n'
        f'      "options": [\n'
        f'        {{"id": "a", "text": "First option text", "explanation": "Explanation for this option"}},\n'
        f'        {{"id": "b", "text": "Second option text", "explanation": "Explanation for this option"}}\n'
        f"      ],\n"
        f'      "correctAnswer": "a"\n'
        f"    }}\n"
        f"  ]\n"
        f"}}\n\n"
        f"Content requirements:\n"
        f"- Write specific, detailed questions based on the context provided\n"
        f"- All options must be plausible and relevant to the question\n"
        f"- Provide clear explanations for each option (why it's correct or incorrect)\n"
        f"- Exactly ONE option per question should be correct\n"
        f"- Make questions clear and unambiguous\n\n"
        f"Common mistakes to avoid:\n"
        f"- WRONG: Trailing comma before closing bracket: [item1, item2,]\n"
        f"- WRONG: Missing comma between items: [item1 item2]\n"
        f"- WRONG: Comma after last property: {{\"key\": \"value\",}}\n"
        f"- WRONG: Unescaped quotes in strings\n"
        f"- WRONG: Extra text before or after the JSON\n"
        f"- WRONG: Incomplete JSON - must complete all {num_questions} questions\n\n"
        f"Output the complete, valid JSON now:"
    )


def build_flashcard_prompt(topic: str, difficulty: str, num_cards: int, card_type: str, context_snippets: list[str]) -> str:
    context = "\n".join([f"- {c}" for c in context_snippets])
    
    card_type_guidance = {
        "definition": "Focus on key terms and their definitions from the material",
        "concept": "Focus on explaining important concepts and their relationships",
        "example": "Focus on providing concrete examples and applications"
    }.get(card_type, "Focus on key information from the material")
    
    return (
        f"You are an assistant that generates flashcards in strict JSON format.\n\n"
        f"Context from textbook:\n{context}\n\n"
        f"Your task:\n"
        f"- Generate exactly {num_cards} flashcard(s)\n"
        f"- Topic: \"{topic}\"\n"
        f"- Difficulty: {difficulty}\n"
        f"- Card type: {card_type}\n"
        f"- Guidance: {card_type_guidance}\n"
        f"- Card IDs must be: card1, card2, card3, etc.\n\n"
        f"CRITICAL JSON SYNTAX RULES - FOLLOW EXACTLY:\n"
        f"1. Output ONLY valid JSON - no markdown, no explanations, no preamble\n"
        f"2. Use double quotes (\") for all strings, never single quotes\n"
        f"3. COMMAS ARE REQUIRED between all array elements and object properties\n"
        f"4. NEVER put a comma after the LAST item in an array or object\n"
        f'5. Escape quotes inside strings: use \\" for a literal quote character\n'
        f"6. Keep all text on single lines - no line breaks inside string values\n"
        f"7. Ensure all brackets and braces are properly closed\n"
        f"8. Pay special attention: comma BEFORE closing bracket/brace = ERROR\n\n"
        f"CORRECT comma placement examples:\n"
        f'- Between items: [{{"id": "card1"}}, {{"id": "card2"}}]  <- comma BETWEEN items\n'
        f'- Last item has NO comma: [{{"id": "card1"}}, {{"id": "card2"}}]  <- no comma before ]\n'
        f'- Object properties: {{"key1": "val1", "key2": "val2"}}  <- comma between, not after last\n\n'
        f"Required JSON structure:\n"
        f"{{\n"
        f'  "title": "Flashcards: {topic}",\n'
        f'  "cards": [\n'
        f"    {{\n"
        f'      "id": "card1",\n'
        f'      "front": "Question or term on the front of the card",\n'
        f'      "back": "Answer or definition on the back of the card",\n'
        f'      "hint": "Optional hint to help recall the answer (can be empty string)"\n'
        f"    }}\n"
        f"  ]\n"
        f"}}\n\n"
        f"Content requirements:\n"
        f"- Front: Clear, concise question or term\n"
        f"- Back: Detailed, accurate answer or explanation\n"
        f"- Hint: Optional clue (leave as empty string \"\" if not needed)\n"
        f"- Base content on the provided context\n"
        f"- Make cards progressively more challenging based on difficulty\n\n"
        f"Common mistakes to avoid:\n"
        f"- WRONG: Trailing comma before closing bracket: [card1, card2,]\n"
        f"- WRONG: Missing comma between items: [card1 card2]\n"
        f"- WRONG: Comma after last property: {{\"key\": \"value\",}}\n"
        f"- WRONG: Unescaped quotes in strings\n"
        f"- WRONG: Extra text before or after the JSON\n"
        f"- WRONG: Incomplete JSON - must complete all {num_cards} cards\n\n"
        f"Output the complete, valid JSON now:"
    )


def parse_body(body: str | None) -> Dict[str, Any]:
    if not body:
        return {}
    try:
        return json.loads(body)
    except Exception:
        return {}


def extract_json(text: str) -> Dict[str, Any]:
    s = text.find("{")
    e = text.rfind("}")
    if s == -1 or e == -1 or e <= s:
        raise ValueError("Model response did not contain JSON object")
    return json.loads(text[s : e + 1])


def validate_shape(obj: Dict[str, Any], num_questions: int, num_options: int) -> Dict[str, Any]:
    if not isinstance(obj, dict):
        raise ValueError("Invalid root JSON")
    if not isinstance(obj.get("title"), str) or not obj["title"].strip():
        raise ValueError("Invalid title")
    qs = obj.get("questions")
    if not isinstance(qs, list) or len(qs) != num_questions:
        raise ValueError(f"questions must have exactly {num_questions} items")
    valid_ids = {chr(97 + i) for i in range(num_options)}
    for idx, q in enumerate(qs):
        if not isinstance(q, dict):
            raise ValueError(f"Question[{idx}] invalid")
        if not isinstance(q.get("id"), str) or not q["id"].strip():
            raise ValueError(f"Question[{idx}].id invalid")
        if not isinstance(q.get("questionText"), str) or not q["questionText"].strip():
            raise ValueError(f"Question[{idx}].questionText invalid")
        opts = q.get("options")
        if not isinstance(opts, list) or len(opts) != num_options:
            raise ValueError(f"Question[{idx}].options must have exactly {num_options} items")
        for oi, opt in enumerate(opts):
            if not isinstance(opt, dict):
                raise ValueError(f"Question[{idx}].options[{oi}] invalid")
            if opt.get("id") not in valid_ids:
                raise ValueError(f"Question[{idx}].options[{oi}].id invalid")
            if not isinstance(opt.get("text"), str) or not opt["text"].strip():
                raise ValueError(f"Question[{idx}].options[{oi}].text invalid")
            if not isinstance(opt.get("explanation"), str) or not opt["explanation"].strip():
                raise ValueError(f"Question[{idx}].options[{oi}].explanation invalid")
        if q.get("correctAnswer") not in valid_ids:
            raise ValueError(f"Question[{idx}].correctAnswer invalid")
    return obj


def validate_flashcard_shape(obj: Dict[str, Any], num_cards: int) -> Dict[str, Any]:
    if not isinstance(obj, dict):
        raise ValueError("Invalid root JSON")
    if not isinstance(obj.get("title"), str) or not obj["title"].strip():
        raise ValueError("Invalid title")
    cards = obj.get("cards")
    if not isinstance(cards, list) or len(cards) != num_cards:
        raise ValueError(f"cards must have exactly {num_cards} items")
    for idx, card in enumerate(cards):
        if not isinstance(card, dict):
            raise ValueError(f"Card[{idx}] invalid")
        if not isinstance(card.get("id"), str) or not card["id"].strip():
            raise ValueError(f"Card[{idx}].id invalid")
        if not isinstance(card.get("front"), str) or not card["front"].strip():
            raise ValueError(f"Card[{idx}].front invalid")
        if not isinstance(card.get("back"), str) or not card["back"].strip():
            raise ValueError(f"Card[{idx}].back invalid")
        if not isinstance(card.get("hint"), str):
            raise ValueError(f"Card[{idx}].hint must be a string (can be empty)")
    return obj


def handler(event, context):
    logger.info("PracticeMaterial Lambda (Docker) invoked")

    # Validate path and parse inputs
    resource = (event.get("httpMethod", "") + " " + event.get("resource", "")).strip()
    if resource != "POST /textbooks/{textbook_id}/practice_materials":
        return {"statusCode": 404, "body": json.dumps({"error": f"Unsupported route: {resource}"})}

    path_params = event.get("pathParameters") or {}
    textbook_id = path_params.get("textbook_id")
    if not textbook_id:
        return {"statusCode": 400, "body": json.dumps({"error": "Textbook ID is required"})}

    body = parse_body(event.get("body"))
    topic = str(body.get("topic", "")).strip()
    if not topic:
        return {"statusCode": 400, "body": json.dumps({"error": "'topic' is required"})}
    material_type = str(body.get("material_type", "mcq")).lower().strip()
    if material_type not in ["mcq", "flashcard"]:
        return {"statusCode": 400, "body": json.dumps({"error": "material_type must be 'mcq' or 'flashcard'"})}

    difficulty = str(body.get("difficulty", "intermediate")).lower().strip()
    
    # MCQ-specific parameters
    num_questions = clamp(int(body.get("num_questions", 5)), 1, 20)
    num_options = clamp(int(body.get("num_options", 4)), 2, 6)
    
    # Flashcard-specific parameters
    num_cards = clamp(int(body.get("num_cards", 10)), 1, 20)
    card_type = str(body.get("card_type", "definition")).lower().strip()

    try:
        # Initialize constants from SSM parameters
        initialize_constants()

        # Get DB creds and build retriever
        db = get_secret_dict(SM_DB_CREDENTIALS)
        vectorstore_config = {
            "dbname": db["dbname"],
            "user": db["username"],
            "password": db["password"],
            "host": RDS_PROXY_ENDPOINT,
            "port": db["port"],
        }

        retriever = get_textbook_retriever(
            llm=None,
            textbook_id=textbook_id,
            vectorstore_config_dict=vectorstore_config,
            embeddings=_embeddings,
        )
        if retriever is None:
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": f"No embeddings found for textbook {textbook_id}"}),
            }

        # Pull a few relevant chunks as context
        docs = retriever.get_relevant_documents(topic)
        snippets = [d.page_content.strip()[:500] for d in docs][:6] #pulling chunks

        # Build prompt based on material type
        if material_type == "mcq":
            prompt = build_prompt(topic, difficulty, num_questions, num_options, snippets)
        else:  # flashcard
            prompt = build_flashcard_prompt(topic, difficulty, num_cards, card_type, snippets)

        # Use ChatBedrock LLM (matching textGeneration pattern)
        logger.info(f"Invoking LLM for {material_type} generation")
        response = _llm.invoke(prompt)
        output_text = response.content
        logger.info(f"Received response from LLM, length: {len(output_text)}")
        
        # Always log the full raw output for debugging
        logger.info(f"Raw LLM output (full): {output_text}")

        try:
            if material_type == "mcq":
                result = validate_shape(extract_json(output_text), num_questions, num_options)
            else:  # flashcard
                result = validate_flashcard_shape(extract_json(output_text), num_cards)
        except Exception as e1:
            logger.warning(f"First parse/validation failed: {e1}")
            logger.warning(f"Raw LLM output (first 2000 chars): {output_text[:2000]}")
            retry_prompt = prompt + "\n\nIMPORTANT: Your previous response was invalid. You MUST return valid JSON only, exactly matching the schema and lengths. No extra commentary."
            logger.info("Retrying with enhanced prompt")
            response2 = _llm.invoke(retry_prompt)
            output_text2 = response2.content
            logger.info(f"Retry response length: {len(output_text2)}")
            logger.info(f"Raw retry LLM output (full): {output_text2}")
            try:
                if material_type == "mcq":
                    result = validate_shape(extract_json(output_text2), num_questions, num_options)
                else:  # flashcard
                    result = validate_flashcard_shape(extract_json(output_text2), num_cards)
            except Exception as e2:
                logger.error(f"Retry also failed: {e2}")
                logger.error(f"Raw retry output (first 2000 chars): {output_text2[:2000]}")
                # Return the raw LLM responses to client for debugging
                return {
                    "statusCode": 500,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps({
                        "error": f"Failed to parse LLM response after retry: {str(e2)}",
                        "firstAttemptError": str(e1),
                        "rawFirstResponse": output_text,
                        "rawRetryResponse": output_text2,
                        "debug": "Check the raw responses above to see what the LLM generated"
                    })
                }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps(result),
        }
    except Exception as e:
        logger.exception("Error generating practice materials")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
