import logging
from typing import Optional

import psycopg2
from langchain_aws import BedrockEmbeddings
from langchain_postgres import PGVector

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_vectorstore(
    collection_name: str, 
    embeddings: BedrockEmbeddings, 
    dbname: str, 
    user: str, 
    password: str, 
    host: str, 
    port: int
) -> Optional[PGVector]:
    """
    Initialize and return a PGVector instance. 
    
    Args:
    collection_name (str): The textbook ID.
    embeddings (BedrockEmbeddings): The embeddings instance.
    dbname (str): The name of the database.
    user (str): The database user.
    password (str): The database password.
    host (str): The database host.
    port (int): The database port.
    
    Returns:
    Optional[PGVector]: The initialized PGVector instance, or None if an error occurred.
    """
    try:
        connection_string = (
            f"postgresql+psycopg://{user}:{password}@{host}:{port}/{dbname}"
        )

        logger.info("Initializing the VectorStore")
        vectorstore = PGVector(
            embeddings=embeddings,
            collection_name=collection_name,
            connection=connection_string,
            use_jsonb=True
        )

        logger.info("VectorStore initialized")
        return vectorstore, connection_string

    except Exception as e:
        logger.error(f"Error initializing vector store: {e}")
        return None