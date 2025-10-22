import logging
import psycopg2
import traceback
from typing import Dict, Optional
from langchain_postgres import PGVector
from langchain_aws import BedrockEmbeddings

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def get_textbook_retriever(llm, textbook_id: str, vectorstore_config_dict: Dict[str, str], embeddings: BedrockEmbeddings, selected_documents=None) -> Optional[object]:
    """
    Get a retriever for a specific textbook based on its ID.
    
    Args:
        llm: The language model (not used in this simplified version)
        textbook_id: The ID of the textbook (used as collection name)
        vectorstore_config_dict: Dictionary with database connection parameters
        embeddings: The embeddings instance to use for the vectorstore
        selected_documents: Not used in this simplified version
        
    Returns:
        A retriever for the textbook or None if no embeddings found
    """
    logger.info(f"Creating retriever for textbook ID: {textbook_id}")
    logger.info(f"Embedding model type: {type(embeddings).__name__}")
    logger.info(f"Embedding model ID: {getattr(embeddings, 'model_id', 'Unknown')}")
    
    try:
        # Connect to database to check if collection exists
        logger.info(f"Connecting to database at {vectorstore_config_dict['host']}:{vectorstore_config_dict['port']}")
        logger.info(f"Using database: {vectorstore_config_dict['dbname']}")
        
        conn = psycopg2.connect(
            dbname=vectorstore_config_dict['dbname'],
            user=vectorstore_config_dict['user'],
            password="*********",  # Password masked for security
            host=vectorstore_config_dict['host'],
            port=int(vectorstore_config_dict['port'])
        )
        logger.info("Database connection established successfully")
        
        # Check if collection exists with embeddings
        with conn.cursor() as cur:
            # Check if collection exists
            cur.execute("SELECT COUNT(*) FROM langchain_pg_collection WHERE name = %s", (textbook_id,))
            collection_exists = cur.fetchone()[0] > 0
            
            if not collection_exists:
                logger.warning(f"Collection for textbook {textbook_id} does not exist")
                conn.close()
                return None
            
            # Check if it has embeddings
            cur.execute("""
                SELECT COUNT(*) FROM langchain_pg_embedding 
                WHERE collection_id = (SELECT uuid FROM langchain_pg_collection WHERE name = %s)
            """, (textbook_id,))
            embedding_count = cur.fetchone()[0]
            logger.info(f"Collection {textbook_id} has {embedding_count} embeddings")
            
            if embedding_count == 0:
                logger.warning(f"No embeddings found for textbook {textbook_id}")
                conn.close()
                return None
        
        conn.close()
        
        # Create vectorstore connection string
        logger.info("Creating PGVector connection string")
        connection_string = (
            f"postgresql+psycopg://{vectorstore_config_dict['user']}:"
            f"********@{vectorstore_config_dict['host']}:"
            f"{vectorstore_config_dict['port']}/{vectorstore_config_dict['dbname']}"
        )
        logger.info(f"Connection string created (password masked): {connection_string}")
        
        # Initialize vector store with the textbook_id as collection name
        logger.info(f"Initializing PGVector with collection name: {textbook_id}")
        vectorstore = PGVector(
            embeddings=embeddings,
            collection_name=textbook_id,
            connection=connection_string,
            use_jsonb=True
        )
        logger.info("PGVector initialized successfully")
        
        # Create retriever with default search parameters
        logger.info("Creating retriever with similarity search")
        search_kwargs = {"k": 5}
        logger.info(f"Search parameters: {search_kwargs}")
        
        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs=search_kwargs
        )
        
        logger.info(f"Successfully created retriever for textbook: {textbook_id}")
        return retriever
        
    except Exception as e:
        logger.error(f"Error in get_textbook_retriever: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Textbook ID: {textbook_id}")
        logger.error(f"Database host: {vectorstore_config_dict.get('host', 'not provided')}")
        logger.error(f"Database name: {vectorstore_config_dict.get('dbname', 'not provided')}")
        return None
