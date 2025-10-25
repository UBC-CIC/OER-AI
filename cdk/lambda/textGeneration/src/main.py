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
DB_SECRET_NAME = os.environ["SM_DB_CREDENTIALS"]
REGION = os.environ["REGION"]
RDS_PROXY_ENDPOINT = os.environ["RDS_PROXY_ENDPOINT"]
BEDROCK_LLM_PARAM = os.environ.get("BEDROCK_LLM_PARAM")
EMBEDDING_MODEL_PARAM = os.environ.get("EMBEDDING_MODEL_PARAM")
GUARDRAIL_ID_PARAM = os.environ.get("GUARDRAIL_ID_PARAM")

# AWS Clients
secrets_manager = boto3.client("secretsmanager", region_name=REGION)
ssm_client = boto3.client("ssm", region_name=REGION)
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)

connection = None
db_secret = None
BEDROCK_LLM_ID = None
EMBEDDING_MODEL_ID = None
GUARDRAIL_ID = None
embeddings = None

def get_secret(secret_name, expect_json=True):
    global db_secret
    if db_secret is None:
        try:
            response = secrets_manager.get_secret_value(SecretId=secret_name)["SecretString"]
            db_secret = json.loads(response) if expect_json else response
        except Exception as e:
            logger.error(f"Error fetching secret: {e}")
            raise
    return db_secret

def get_parameter(param_name, cached_var):
    if cached_var is None:
        try:
            response = ssm_client.get_parameter(Name=param_name, WithDecryption=True)
            cached_var = response["Parameter"]["Value"]
        except Exception as e:
            logger.error(f"Error fetching parameter {param_name}: {e}")
            raise
    return cached_var

def initialize_constants():
    global BEDROCK_LLM_ID, EMBEDDING_MODEL_ID, embeddings
    BEDROCK_LLM_ID = get_parameter(BEDROCK_LLM_PARAM, BEDROCK_LLM_ID)
    EMBEDDING_MODEL_ID = get_parameter(EMBEDDING_MODEL_PARAM, EMBEDDING_MODEL_ID)

    if embeddings is None:
        embeddings = BedrockEmbeddings(
            model_id=EMBEDDING_MODEL_ID,
            client=bedrock_runtime,
            region_name=REGION,
        )

def get_db_credentials():
    """Get database credentials from Secrets Manager"""
    try:
        response = secrets_manager.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"]
        return json.loads(response)
    except Exception as e:
        logger.error(f"Error fetching DB credentials: {e}")
        raise

def connect_to_db():
    global connection
    if connection is None or connection.closed:
        try:
            secret = get_secret(DB_SECRET_NAME)
            connection_params = {
                'dbname': secret["dbname"],
                'user': secret["username"],
                'password': secret["password"],
                'host': RDS_PROXY_ENDPOINT,
                'port': secret["port"]
            }
            connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
            connection = psycopg2.connect(connection_string)
            logger.info("Connected to the database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    return connection



# This function is now a wrapper for the helper function in chat.py
def process_query(query, textbook_id, retriever, chat_session_id, connection=None):
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
        
        # Test the LLM with a simple message to verify it works
        try:
            logger.info(f"Testing LLM with a simple message...")
            test_message = llm.invoke("This is a test. Respond with 'OK' if you receive this message.")
            logger.info(f"LLM test successful. Response content type: {type(test_message)}")
        except Exception as test_error:
            logger.error(f"LLM test failed: {str(test_error)}")
            logger.error(f"This may indicate the model ID {BEDROCK_LLM_ID} is not available in region {REGION}")
            raise
        
        # Log the embeddings model ID for context
        logger.info(f"Using embedding model ID: {EMBEDDING_MODEL_ID}")
        
        # Use the helper function from chat.py to generate the response
        logger.info(f"Calling get_response with textbook_id: {textbook_id}")
        return get_response(
            query=query,
            textbook_id=textbook_id,
            llm=llm,
            retriever=retriever,
            chat_session_id=chat_session_id,
            connection=connection
        )
    except Exception as e:
        logger.error(f"Error in process_query: {str(e)}", exc_info=True)
        logger.error(f"Model ID: {BEDROCK_LLM_ID}, Region: {REGION}")
        # Return a graceful error message
        return {
            "response": f"I'm sorry, I encountered an error while processing your question. The error has been logged for our team to investigate.",
            "sources_used": []
        }

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
    logger.info(f"Model parameter paths - LLM: {BEDROCK_LLM_PARAM}, Embeddings: {EMBEDDING_MODEL_PARAM}")
    
    # Extract parameters from the request
    query_params = event.get("queryStringParameters", {})
    path_params = event.get("pathParameters", {})
    logger.info(f"Request path parameters: {path_params}")
    
    chat_session_id = path_params.get("id", "")
    
    # Parse request body
    body = {} if event.get("body") is None else json.loads(event.get("body"))
    question = body.get("query", "")
    textbook_id = body.get("textbook_id", "")

    try:
        initialize_constants()
    except Exception as e:
        logger.error(f"❌ Failed to initialize constants: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Configuration error: {str(e)}')
        }
    
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
        try:
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
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*"
                    },
                    "body": json.dumps({"error": f"No embeddings found for textbook {textbook_id}"})
                }
        except Exception as retriever_error:
            logger.error(f"Error initializing retriever: {str(retriever_error)}", exc_info=True)
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*"
                },
                "body": json.dumps({"error": f"Failed to initialize retriever: {str(retriever_error)}"})
            }
        
        # Connect to database for custom prompts and logging
        connection = connect_to_db()
        
        # Generate response using helper function
        try:
            response_data = process_query(
                query=question,
                textbook_id=textbook_id,
                retriever=retriever,
                connection=connection,
                chat_session_id=chat_session_id
            )
        except Exception as query_error:
            logger.error(f"Error processing query: {str(query_error)}", exc_info=True)
            response_data = {
                "response": "I apologize, but I'm experiencing technical difficulties at the moment. Our team has been notified of the issue.",
                "sources_used": []
            }
        
        try:
            # Log the interaction for analytics purposes
            with connection.cursor() as cur:
                # Check if chat_session_id is provided for the log
                if chat_session_id:
                    cur.execute(
                        """
                        INSERT INTO user_interactions
                        (chat_session_id, sender_role, query_text, response_text)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (chat_session_id, "User", question, response_data["response"])
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO user_interactions
                        (sender_role, query_text, response_text)
                        VALUES (%s, %s, %s)
                        """,
                        ("User", question, response_data["response"])
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
