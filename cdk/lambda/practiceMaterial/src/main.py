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
            "max_tokens": 512,
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
        f"You are an assistant that generates practice MCQs in strict JSON. Output ONLY valid JSON.\n\n"
        f"Context (from textbook):\n{context}\n\n"
        f"Constraints:\n"
        f"- Topic: \"{topic}\"\n"
        f"- Difficulty: \"{difficulty}\" (beginner|intermediate|advanced)\n"
        f"- Produce exactly {num_questions} question(s) with exactly {num_options} option(s) each\n"
        f"- Question IDs: q1..q{num_questions}\n"
        f"- Allowed option IDs per question: {', '.join(option_ids)}\n\n"
        f"Content requirements:\n"
        f"- Write real, specific questions based on the context; no placeholders or template phrases.\n"
        f"- Exactly one correct answer per question; include explanations for all options.\n\n"
        f"JSON structure (keys and types only):\n"
        f"{{\n  \"title\": \"Practice Quiz: {topic}\",\n  \"questions\": [{{\n    \"id\": \"q1\",\n    \"questionText\": string,\n    \"options\": [{{\"id\": \"a\", \"text\": string, \"explanation\": string}}],\n    \"correctAnswer\": \"a\"\n  }}]\n}}\n\n"
        f"Return JSON only, no extra text."
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
    if material_type != "mcq":
        return {"statusCode": 400, "body": json.dumps({"error": "Only 'mcq' material_type is supported at this time"})}

    num_questions = clamp(int(body.get("num_questions", 5)), 1, 20)
    num_options = clamp(int(body.get("num_options", 4)), 2, 6)
    difficulty = str(body.get("difficulty", "intermediate")).lower().strip()

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
        snippets = [d.page_content.strip()[:500] for d in docs][:6]

        prompt = build_prompt(topic, difficulty, num_questions, num_options, snippets)

        # Use ChatBedrock LLM (matching textGeneration pattern)
        logger.info("Invoking LLM for practice material generation")
        response = _llm.invoke(prompt)
        output_text = response.content
        logger.info(f"Received response from LLM, length: {len(output_text)}")

        try:
            result = validate_shape(extract_json(output_text), num_questions, num_options)
        except Exception as e1:
            logger.warning(f"First parse/validation failed: {e1}")
            retry_prompt = prompt + "\n\nIMPORTANT: Your previous response was invalid. You MUST return valid JSON only, exactly matching the schema and lengths. No extra commentary."
            logger.info("Retrying with enhanced prompt")
            response2 = _llm.invoke(retry_prompt)
            output_text2 = response2.content
            try:
                result = validate_shape(extract_json(output_text2), num_questions, num_options)
            except Exception as e2:
                logger.warning(f"Second parse/validation failed: {e2}")
                return {
                    "statusCode": 500,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                    },
                    "body": json.dumps({
                        "error": "Practice material generation failed after two attempts.",
                        "first_error": str(e1),
                        "second_error": str(e2),
                    }),
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
