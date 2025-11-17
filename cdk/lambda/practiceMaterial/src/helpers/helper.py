import logging

from langchain_aws import BedrockEmbeddings
from langchain_postgres import PGVector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_vectorstore(
    collection_name: str,
    embeddings: BedrockEmbeddings,
    dbname: str,
    user: str,
    password: str,
    host: str,
    port: int,
):
    try:
        connection_string = (
            f"postgresql+psycopg://{user}:{password}@{host}:{port}/{dbname}"
        )
        logger.info("Initializing the VectorStore for collection %s", collection_name)
        vectorstore = PGVector(
            embeddings=embeddings,
            collection_name=collection_name,
            connection=connection_string,
            use_jsonb=True,
        )
        logger.info("VectorStore initialized")
        return vectorstore, connection_string
    except Exception as e:
        logger.error(f"Error initializing vector store: {e}")
        return None
