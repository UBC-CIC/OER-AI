import os
import json
import boto3
import logging
import psycopg2
from langchain_aws import BedrockEmbeddings
from helpers.vectorstore import get_textbook_retriever
from helpers.chat import get_bedrock_llm, get_response

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]  # Secret containing database credentials
REGION = os.environ["REGION"]  # AWS region
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]  # Database proxy endpoint
BEDROCK_LLM_ID = os.environ.get("BEDROCK_LLM_ID", "meta.llama3-70b-instruct-v1:0")  # LLM model ID
EMBEDDING_MODEL_ID = os.environ.get("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v1")  # Embedding model ID

# AWS Clients
secrets_manager = boto3.client("secretsmanager", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

# Initialize embeddings
try:
    logger.info(f"Initializing embeddings with model ID: {EMBEDDING_MODEL_ID}")
    embeddings = BedrockEmbeddings(
        model_id=EMBEDDING_MODEL_ID,
        client=bedrock_runtime,
        region_name=REGION
    )
    logger.info("Embeddings initialized successfully")
except Exception as e:
    logger.error(f"Error initializing embeddings: {str(e)}", exc_info=True)
    raise

def get_db_credentials():
    """Get database credentials from Secrets Manager"""
    try:
        response = secrets_manager.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"]
        return json.loads(response)
    except Exception as e:
        logger.error(f"Error fetching DB credentials: {e}")
        raise

def connect_to_db():
    """Create a database connection"""
    try:
        secret = get_db_credentials()
        conn = psycopg2.connect(
            dbname=secret["dbname"],
            user=secret["username"],
            password=secret["password"],
            host=RDS_PROXY_ENDPOINT,
            port=secret["port"]
        )
        logger.info("Connected to database")
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise



# This function is now a wrapper for the helper function in chat.py
def process_query(query, textbook_id, retriever, connection=None):
    """
    Process a query using the chat helper function
    
    Args:
        query: The user's question
        textbook_id: ID of the textbook
        retriever: Vector store retriever for the textbook
        connection: Optional database connection for fetching custom prompts
        
    Returns:
        Response dictionary with answer and sources used
    """
    # Log the model ID being used
    logger.info(f"Processing query with LLM model ID: '{BEDROCK_LLM_ID}'")
    logger.info(f"Environment variables: REGION={REGION}, RDS_PROXY_ENDPOINT={RDS_PROXY_ENDPOINT}")
    
    try:
        # Initialize LLM
        logger.info(f"Initializing Bedrock LLM with model ID: {BEDROCK_LLM_ID}")
        llm = get_bedrock_llm(BEDROCK_LLM_ID)
        
        # Log the embeddings model ID for context
        logger.info(f"Using embedding model ID: {EMBEDDING_MODEL_ID}")
        
        # Use the helper function from chat.py to generate the response
        logger.info(f"Calling get_response with textbook_id: {textbook_id}")
        return get_response(
            query=query,
            textbook_id=textbook_id,
            llm=llm,
            retriever=retriever,
            connection=connection
        )
    except Exception as e:
        logger.error(f"Error in process_query: {str(e)}", exc_info=True)
        raise

def handler(event, context):
    """
    Lambda handler function for textbook question answering API endpoint
    
    Takes an API Gateway event with a textbook_id and question,
    retrieves relevant passages from the vectorstore, and generates
    an answer using the helper functions in chat.py
    """
    logger.info("Starting textbook question answering Lambda")
    logger.info(f"AWS Region: {REGION}")
    logger.info(f"Lambda function ARN: {context.invoked_function_arn}")
    logger.info(f"Lambda function name: {context.function_name}")
    logger.info(f"Using model IDs - LLM: {BEDROCK_LLM_ID}, Embeddings: {EMBEDDING_MODEL_ID}")
    
    # Extract parameters from the request
    query_params = event.get("queryStringParameters", {})
    path_params = event.get("pathParameters", {})
    logger.info(f"Request path parameters: {path_params}")
    
    session_id = path_params.get("session_id", "")
    
    # Parse request body
    body = {} if event.get("body") is None else json.loads(event.get("body"))
    question = body.get("query", "")
    textbook_id = body.get("textbook_id", "")
    
    # Validate required parameters
    if not textbook_id:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Missing textbook_id parameter"})
        }
    
    if not question:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "No question provided in the query field"})
        }
    
    try:
        # Get database credentials for vectorstore
        db_creds = get_db_credentials()
        vectorstore_config = {
            "dbname": db_creds["dbname"],
            "user": db_creds["username"],
            "password": db_creds["password"],
            "host": RDS_PROXY_ENDPOINT,
            "port": db_creds["port"]
        }
        
        # Get retriever for the textbook
        retriever = get_textbook_retriever(
            llm=None,  # Not needed for basic retriever initialization
            textbook_id=textbook_id,
            vectorstore_config_dict=vectorstore_config,
            embeddings=embeddings
        )
        
        if retriever is None:
            logger.warning(f"No retriever available for textbook {textbook_id}")
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": f"No embeddings found for textbook {textbook_id}"})
            }
        
        # Connect to database for custom prompts and logging
        connection = connect_to_db()
        
        # Generate response using helper function
        response_data = process_query(
            query=question,
            textbook_id=textbook_id,
            retriever=retriever,
            connection=connection
        )
        
        try:
            # Log the interaction for analytics purposes
            with connection.cursor() as cur:
                # Check if session_id is provided for the log
                if session_id:
                    cur.execute(
                        """
                        INSERT INTO user_interactions
                        (session_id, sender_role, query_text, response_text)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (session_id, "user", question, response_data["response"])
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO user_interactions
                        (sender_role, query_text, response_text)
                        VALUES (%s, %s, %s, %s)
                        """,
                        ("user", question, response_data["response"])
                    )
            
            connection.commit()
            logger.info(f"Logged question for textbook {textbook_id}")
        except Exception as db_error:
            connection.rollback()
            logger.error(f"Error logging question: {db_error}")
        finally:
            # Always close the connection when done
            if connection:
                connection.close()
        
        # Return successful response
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*", 
                "Access-Control-Allow-Methods": "*"
            },
            "body": json.dumps({
                "textbook_id": textbook_id,
                "response": response_data["response"],
                "sources": response_data["sources_used"]
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*"
            },
            "body": json.dumps({"error": f"Internal server error: {str(e)}"})
        }
