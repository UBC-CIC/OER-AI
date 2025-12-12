import logging
import psycopg2
import traceback
from typing import Dict, Optional
from langchain_postgres import PGVector
from langchain_aws import BedrockEmbeddings
from .helper import get_vectorstore
# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def get_vectorstore_retriever(llm, vectorstore_config_dict: Dict[str, str], embeddings):
    """Simple vectorstore retriever without complex history awareness."""
    
    try:
        vectorstore, _ = get_vectorstore(
            collection_name=vectorstore_config_dict['collection_name'],
            embeddings=embeddings,
            dbname=vectorstore_config_dict['dbname'],
            user=vectorstore_config_dict['user'],
            password=vectorstore_config_dict['password'],
            host=vectorstore_config_dict['host'],
            port=int(vectorstore_config_dict['port'])
        )
        
        if vectorstore is None:
            logger.error("Failed to initialize vectorstore")
            return None
            
        # Use similarity search with score threshold to ensure relevance
        # Score threshold of 0.7 means we only return documents with similarity >= 0.7
        # This helps filter out irrelevant content and keeps responses focused on textbook material
        search_kwargs = {
            "k": 5,  # Retrieve up to 5 documents
            "score_threshold": 0.2  # Only return documents with similarity >= 0.3
        }
        retriever = vectorstore.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs=search_kwargs
        )
        
        logger.info(f"Created retriever with similarity threshold: {search_kwargs['score_threshold']}")
        logger.info(f"Maximum documents to retrieve: {search_kwargs['k']}")
        
        return retriever
        
    except Exception as e:
        logger.error(f"Error in get_vectorstore_retriever: {str(e)}")
        logger.error(traceback.format_exc())
        return None

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
        logger.info(f"Connecting to database at")
        
        conn = None
        try:
            conn = psycopg2.connect(
                dbname=vectorstore_config_dict['dbname'],
                user=vectorstore_config_dict['user'],
                password=vectorstore_config_dict['password'],
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
                    return None
        
        finally:
            if conn and not conn.closed:
                conn.close()
        
        # Add collection_name to config for vectorstore creation
        vectorstore_config_dict['collection_name'] = textbook_id
        
        # Create vectorstore and retriever
        logger.info(f"Creating vectorstore retriever for collection: {textbook_id}")
        retriever = get_vectorstore_retriever(
            llm=llm,
            vectorstore_config_dict=vectorstore_config_dict,
            embeddings=embeddings
        )
        
        if retriever is None:
            logger.error(f"Failed to create retriever for textbook: {textbook_id}")
            return None
        
        logger.info(f"Successfully created retriever for textbook: {textbook_id}")
        return retriever
        
    except Exception as e:
        logger.error(f"Error in get_textbook_retriever: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error(f"Textbook ID: {textbook_id}")
        return None
