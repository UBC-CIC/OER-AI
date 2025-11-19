import os
import json
import logging
import boto3
from typing import Any, Dict

from helpers.vectorstore import get_textbook_retriever
from langchain_aws import BedrockEmbeddings, ChatBedrock
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


def build_short_answer_prompt(
    topic: str,
    difficulty: str,
    num_questions: int,
    snippets: list[str]
) -> str:
    """
    Build a prompt for generating short answer questions with sample answers and grading rubrics.
    """
    context_str = "\n\n".join(f"[Chunk {i+1}]\n{s}" for i, s in enumerate(snippets))
    
    return (
        f"You are an expert educational content creator specializing in creating short answer questions.\n\n"
        f"Topic: {topic}\n"
        f"Difficulty: {difficulty}\n"
        f"Number of questions: {num_questions}\n\n"
        f"Context from textbook:\n{context_str}\n\n"
        f"CRITICAL JSON FORMATTING RULES:\n"
        f'- Use double quotes for all strings, property names, and array items\n'
        f'- Do NOT use trailing commas (no comma after last item in array or object)\n'
        f'- Array items: ["item1", "item2", "item3"]  <- comma between, not after last\n'
        f'- Object properties: {{"key1": "val1", "key2": "val2"}}  <- comma between, not after last\n\n'
        f"Required JSON structure:\n"
        f"{{\n"
        f'  "title": "Short Answer: {topic}",\n'
        f'  "questions": [\n'
        f"    {{\n"
        f'      "id": "q1",\n'
        f'      "questionText": "Clear, specific question requiring detailed explanation",\n'
        f'      "context": "Optional background information or scenario (can be empty string)",\n'
        f'      "sampleAnswer": "Comprehensive answer (100-150 words) that fully addresses the question with accurate details from the textbook",\n'
        f'      "keyPoints": ["Key concept 1", "Key concept 2", "Key concept 3", "Key concept 4", "Key concept 5"],\n'
        f'      "rubric": "Clear grading criteria explaining what a complete answer should include",\n'
        f'      "expectedLength": 100\n'
        f"    }}\n"
        f"  ]\n"
        f"}}\n\n"
        f"Content requirements:\n"
        f"- questionText: Ask open-ended questions requiring explanation, analysis, or comparison\n"
        f"- context: Provide relevant background only if needed (use empty string \"\" if not)\n"
        f"- sampleAnswer: Write thorough, accurate answers (100-150 words) based on textbook content\n"
        f"- keyPoints: List 3-5 essential concepts that should be included in the answer\n"
        f"- rubric: Explain how to evaluate answer quality and what earns full credit\n"
        f"- expectedLength: Set to 100 for most questions\n"
        f"- Base all content on the provided textbook context\n"
        f"- Questions should be progressively more challenging based on difficulty level\n"
        f"- For beginner: Focus on definitions and basic concepts\n"
        f"- For intermediate: Require explanation of processes and relationships\n"
        f"- For advanced: Demand analysis, evaluation, or synthesis\n\n"
        f"Common mistakes to avoid:\n"
        f"- WRONG: Trailing comma before closing bracket: [item1, item2,]\n"
        f"- WRONG: Missing comma between items: [item1 item2]\n"
        f"- WRONG: Comma after last property: {{\"key\": \"value\",}}\n"
        f"- WRONG: Unescaped quotes in strings - use \\\" inside strings\n"
        f"- WRONG: Extra text before or after the JSON\n"
        f"- WRONG: Incomplete JSON - must complete all {num_questions} questions\n"
        f"- WRONG: Sample answers that are too short or vague\n\n"
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


def validate_short_answer_shape(obj: Dict[str, Any], num_questions: int) -> Dict[str, Any]:
    """
    Validate the shape of a short answer JSON object.
    """
    if not isinstance(obj, dict):
        raise ValueError("Invalid root JSON")
    if not isinstance(obj.get("title"), str) or not obj["title"].strip():
        raise ValueError("Invalid title")
    
    questions = obj.get("questions")
    if not isinstance(questions, list) or len(questions) != num_questions:
        raise ValueError(f"questions must have exactly {num_questions} items")
    
    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            raise ValueError(f"Question[{idx}] invalid")
        
        # Validate id
        if not isinstance(q.get("id"), str) or not q["id"].strip():
            raise ValueError(f"Question[{idx}].id invalid")
        
        # Validate questionText
        if not isinstance(q.get("questionText"), str) or not q["questionText"].strip():
            raise ValueError(f"Question[{idx}].questionText invalid")
        
        # Validate context (optional, can be empty string)
        if not isinstance(q.get("context"), str):
            raise ValueError(f"Question[{idx}].context must be a string (can be empty)")
        
        # Validate sampleAnswer
        if not isinstance(q.get("sampleAnswer"), str) or not q["sampleAnswer"].strip():
            raise ValueError(f"Question[{idx}].sampleAnswer invalid")
        
        # Validate keyPoints (array of strings)
        key_points = q.get("keyPoints")
        if not isinstance(key_points, list) or len(key_points) < 3:
            raise ValueError(f"Question[{idx}].keyPoints must be an array with at least 3 items")
        for kp_idx, kp in enumerate(key_points):
            if not isinstance(kp, str) or not kp.strip():
                raise ValueError(f"Question[{idx}].keyPoints[{kp_idx}] must be a non-empty string")
        
        # Validate rubric
        if not isinstance(q.get("rubric"), str) or not q["rubric"].strip():
            raise ValueError(f"Question[{idx}].rubric invalid")
        
        # Validate expectedLength (optional number)
        expected_length = q.get("expectedLength")
        if expected_length is not None and not isinstance(expected_length, (int, float)):
            raise ValueError(f"Question[{idx}].expectedLength must be a number")
    
    return obj


def build_grading_prompt(
    question: str,
    student_answer: str,
    sample_answer: str,
    key_points: list[str],
    rubric: str
) -> str:
    """
    Build a prompt for the LLM to grade a student's short answer response.
    """
    key_points_str = "\n".join(f"{i+1}. {kp}" for i, kp in enumerate(key_points))
    
    return (
        f"You are an expert educational assessor providing constructive feedback on student answers.\n\n"
        f"Question:\n{question}\n\n"
        f"Student's Answer:\n{student_answer}\n\n"
        f"Sample Answer (for reference):\n{sample_answer}\n\n"
        f"Key Points to Cover:\n{key_points_str}\n\n"
        f"Grading Rubric:\n{rubric}\n\n"
        f"CRITICAL JSON FORMATTING RULES:\n"
        f'- Use double quotes for all strings and property names\n'
        f'- Do NOT use trailing commas\n'
        f'- Escape quotes within strings using \\"\n\n'
        f"Required JSON structure:\n"
        f"{{\n"
        f'  "feedback": "Overall qualitative assessment of the answer (2-3 sentences)",\n'
        f'  "strengths": ["Strength 1", "Strength 2"],\n'
        f'  "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"],\n'
        f'  "keyPointsCovered": ["Key point covered 1", "Key point covered 2"],\n'
        f'  "keyPointsMissed": ["Key point missed 1"]\n'
        f"}}\n\n"
        f"Instructions:\n"
        f"- Provide constructive, encouraging feedback\n"
        f"- Identify 2-3 specific strengths in the student's answer\n"
        f"- Suggest 2-3 concrete ways to improve the answer\n"
        f"- List which key points were adequately covered\n"
        f"- List which key points were missing or insufficiently addressed\n"
        f"- Be specific and educational, not just critical\n"
        f"- Arrays can be empty if no items apply\n\n"
        f"Output the complete, valid JSON now:"
    )


def handler(event, context):
    logger.info("PracticeMaterial Lambda (Docker) invoked")

    # Validate path and parse inputs
    resource = (event.get("httpMethod", "") + " " + event.get("resource", "")).strip()
    
    # Handle grading endpoint
    if resource == "POST /textbooks/{textbook_id}/practice_materials/grade":
        return handle_grading(event, context)
    
    # Handle generation endpoint
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
    if material_type not in ["mcq", "flashcard", "short_answer"]:
        return {"statusCode": 400, "body": json.dumps({"error": "material_type must be 'mcq', 'flashcard', or 'short_answer'"})}

    difficulty = str(body.get("difficulty", "intermediate")).lower().strip()
    
    # MCQ-specific parameters
    num_questions = clamp(int(body.get("num_questions", 5)), 1, 20)
    num_options = clamp(int(body.get("num_options", 4)), 2, 6)
    
    # Flashcard-specific parameters
    num_cards = clamp(int(body.get("num_cards", 10)), 1, 20)
    card_type = str(body.get("card_type", "definition")).lower().strip()
    
    # Short answer-specific parameters
    # For short answers, reuse num_questions but with different limits
    if material_type == "short_answer":
        num_questions = clamp(int(body.get("num_questions", 3)), 1, 10)

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
        elif material_type == "flashcard":
            prompt = build_flashcard_prompt(topic, difficulty, num_cards, card_type, snippets)
        else:  # short_answer
            prompt = build_short_answer_prompt(topic, difficulty, num_questions, snippets)

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
            elif material_type == "flashcard":
                result = validate_flashcard_shape(extract_json(output_text), num_cards)
            else:  # short_answer
                result = validate_short_answer_shape(extract_json(output_text), num_questions)
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
                elif material_type == "flashcard":
                    result = validate_flashcard_shape(extract_json(output_text2), num_cards)
                else:  # short_answer
                    result = validate_short_answer_shape(extract_json(output_text2), num_questions)
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


def handle_grading(event, context):
    """
    Handle grading of a student's short answer response.
    """
    logger.info("Grading endpoint invoked")
    
    body = parse_body(event.get("body"))
    
    # Extract required fields
    question = str(body.get("question", "")).strip()
    student_answer = str(body.get("student_answer", "")).strip()
    sample_answer = str(body.get("sample_answer", "")).strip()
    key_points = body.get("key_points", [])
    rubric = str(body.get("rubric", "")).strip()
    
    # Validate inputs
    if not question:
        return {"statusCode": 400, "body": json.dumps({"error": "question is required"})}
    if not student_answer:
        return {"statusCode": 400, "body": json.dumps({"error": "student_answer is required"})}
    if not sample_answer:
        return {"statusCode": 400, "body": json.dumps({"error": "sample_answer is required"})}
    if not isinstance(key_points, list) or len(key_points) == 0:
        return {"statusCode": 400, "body": json.dumps({"error": "key_points must be a non-empty array"})}
    if not rubric:
        return {"statusCode": 400, "body": json.dumps({"error": "rubric is required"})}
    
    try:
        # Initialize constants if needed
        initialize_constants()
        
        # Build grading prompt
        prompt = build_grading_prompt(question, student_answer, sample_answer, key_points, rubric)
        
        # Get LLM response
        logger.info("Invoking LLM for grading")
        response = _llm.invoke(prompt)
        output_text = response.content
        logger.info(f"Received grading response from LLM, length: {len(output_text)}")
        logger.info(f"Raw grading output: {output_text}")
        
        # Parse JSON response
        try:
            result = extract_json(output_text)
            
            # Validate expected fields
            if not isinstance(result.get("feedback"), str):
                raise ValueError("feedback must be a string")
            if not isinstance(result.get("strengths"), list):
                raise ValueError("strengths must be an array")
            if not isinstance(result.get("improvements"), list):
                raise ValueError("improvements must be an array")
            if not isinstance(result.get("keyPointsCovered"), list):
                raise ValueError("keyPointsCovered must be an array")
            if not isinstance(result.get("keyPointsMissed"), list):
                raise ValueError("keyPointsMissed must be an array")
                
        except Exception as e1:
            logger.warning(f"First grading parse failed: {e1}")
            # Retry with enhanced prompt
            retry_prompt = prompt + "\n\nIMPORTANT: Your previous response was invalid. Return valid JSON only."
            logger.info("Retrying grading with enhanced prompt")
            response2 = _llm.invoke(retry_prompt)
            output_text2 = response2.content
            logger.info(f"Retry grading response: {output_text2}")
            
            try:
                result = extract_json(output_text2)
            except Exception as e2:
                logger.error(f"Retry grading also failed: {e2}")
                return {
                    "statusCode": 500,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps({
                        "error": f"Failed to parse grading response: {str(e2)}",
                        "rawResponse": output_text2
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
        logger.exception("Error grading answer")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps({"error": f"Error grading answer: {str(e)}"}),
        }

