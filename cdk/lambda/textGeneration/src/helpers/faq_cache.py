import logging
import json
import boto3
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
import psycopg2
from langchain_aws import BedrockEmbeddings

# Setup logging
logger = logging.getLogger(__name__)

# Similarity threshold for considering a question as cached
SIMILARITY_THRESHOLD = 0.85  # Adjust this value based on testing (0.0 to 1.0)
MAX_CACHE_SIZE = 100  # Maximum number of FAQs to keep in cache


def check_faq_cache(
    question: str,
    textbook_id: str,
    embeddings: BedrockEmbeddings,
    connection,
    similarity_threshold: float = SIMILARITY_THRESHOLD
) -> Optional[Dict[str, Any]]:
    """
    Check if a similar question exists in the FAQ cache using vector similarity.
    
    Args:
        question: The user's question
        textbook_id: The textbook ID
        embeddings: BedrockEmbeddings instance for generating question embedding
        connection: Database connection
        similarity_threshold: Minimum cosine similarity to consider a match (default: 0.85)
        
    Returns:
        Dict with cached answer, sources, and metadata if found, None otherwise
    """
    try:
        # Generate embedding for the input question
        logger.info(f"Generating embedding for question: {question[:100]}...")
        question_embedding = embeddings.embed_query(question)
        
        # Convert embedding to PostgreSQL vector format
        embedding_str = "[" + ",".join(map(str, question_embedding)) + "]"
        
        # Query for similar questions using cosine similarity
        # The <=> operator in pgvector computes cosine distance (1 - cosine_similarity)
        # So we need to convert it back to similarity
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    id,
                    question_text,
                    answer_text,
                    sources,
                    usage_count,
                    last_used_at,
                    cached_at,
                    metadata,
                    1 - (embedding <=> %s::vector) as similarity
                FROM faq_cache
                WHERE textbook_id = %s
                    AND embedding IS NOT NULL
                    AND 1 - (embedding <=> %s::vector) >= %s
                ORDER BY similarity DESC
                LIMIT 1
                """,
                (embedding_str, textbook_id, embedding_str, similarity_threshold)
            )
            
            result = cur.fetchone()
            
            if result:
                faq_id, question_text, answer_text, sources, usage_count, last_used_at, cached_at, metadata, similarity = result
                
                logger.info(f"Found cached FAQ with similarity {similarity:.4f}")
                logger.info(f"Cached question: {question_text[:100]}...")
                
                # Update usage statistics
                _update_faq_usage(faq_id, connection)
                
                # Parse sources from JSON if it exists
                sources_list = sources if sources else []
                
                return {
                    "id": str(faq_id),
                    "question_text": question_text,
                    "answer_text": answer_text,
                    "sources_used": sources_list,
                    "usage_count": usage_count + 1,  # Reflect the increment
                    "last_used_at": datetime.now().isoformat(),
                    "cached_at": cached_at.isoformat() if cached_at else None,
                    "similarity": float(similarity),
                    "from_cache": True
                }
            else:
                logger.info("No similar cached FAQ found")
                return None
                
    except Exception as e:
        logger.error(f"Error checking FAQ cache: {e}")
        logger.exception(e)
        # Don't fail the request if cache check fails
        return None


def _update_faq_usage(faq_id, connection) -> None:
    """
    Update the usage count and last_used_at timestamp for a cached FAQ.
    
    Args:
        faq_id: The FAQ entry ID
        connection: Database connection
    """
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                UPDATE faq_cache
                SET usage_count = usage_count + 1,
                    last_used_at = NOW()
                WHERE id = %s
                """,
                (faq_id,)
            )
        connection.commit()
        logger.info(f"Updated usage count for FAQ {faq_id}")
    except Exception as e:
        logger.error(f"Error updating FAQ usage: {e}")
        connection.rollback()
        # Don't fail the request if usage update fails


def cache_faq(
    question: str,
    answer: str,
    textbook_id: str,
    embeddings: BedrockEmbeddings,
    connection,
    sources: Optional[list] = None,
    metadata: Optional[Dict] = None
) -> Optional[str]:
    """
    Cache a new FAQ entry with its embedding and sources.
    
    Args:
        question: The user's question
        answer: The generated answer
        textbook_id: The textbook ID
        embeddings: BedrockEmbeddings instance
        connection: Database connection
        sources: Optional list of source documents used
        metadata: Optional metadata to store with the FAQ
        
    Returns:
        The ID of the cached FAQ entry, or None if caching failed
    """
    try:
        # Generate embedding for the question
        logger.info(f"Caching FAQ for question: {question[:100]}...")
        question_embedding = embeddings.embed_query(question)
        
        # Convert embedding to PostgreSQL vector format
        embedding_str = "[" + ",".join(map(str, question_embedding)) + "]"
        
        # Prepare metadata and sources
        metadata_json = json.dumps(metadata or {})
        sources_json = json.dumps(sources or [])
        
        # Insert the FAQ into cache
        with connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO faq_cache 
                (textbook_id, question_text, answer_text, embedding, sources, usage_count, metadata)
                VALUES (%s, %s, %s, %s::vector, %s::json, 1, %s::json)
                RETURNING id
                """,
                (textbook_id, question, answer, embedding_str, sources_json, metadata_json)
            )
            
            faq_id = cur.fetchone()[0]
            
        connection.commit()
        logger.info(f"Successfully cached FAQ with ID: {faq_id}")
        
        # Maintain cache size limit
        _maintain_cache_size(textbook_id, connection)
        
        return str(faq_id)
        
    except Exception as e:
        logger.error(f"Error caching FAQ: {e}")
        logger.exception(e)
        connection.rollback()
        return None


def _maintain_cache_size(textbook_id: str, connection, max_size: int = MAX_CACHE_SIZE) -> None:
    """
    Ensure the FAQ cache doesn't exceed the maximum size by removing least frequently used entries.
    
    Args:
        textbook_id: The textbook ID
        connection: Database connection
        max_size: Maximum number of FAQs to keep per textbook (default: 100)
    """
    try:
        with connection.cursor() as cur:
            # Count current FAQs for this textbook
            cur.execute(
                """
                SELECT COUNT(*) 
                FROM faq_cache 
                WHERE textbook_id = %s
                """,
                (textbook_id,)
            )
            
            count = cur.fetchone()[0]
            
            if count > max_size:
                # Delete excess FAQs, keeping the most frequently used ones
                # Also prioritize more recently used FAQs as a tiebreaker
                excess = count - max_size
                
                cur.execute(
                    """
                    DELETE FROM faq_cache
                    WHERE id IN (
                        SELECT id
                        FROM faq_cache
                        WHERE textbook_id = %s
                            AND reported = false  -- Don't delete reported FAQs
                        ORDER BY usage_count ASC, last_used_at ASC
                        LIMIT %s
                    )
                    """,
                    (textbook_id, excess)
                )
                
                deleted_count = cur.rowcount
                connection.commit()
                logger.info(f"Removed {deleted_count} least used FAQs to maintain cache size")
            else:
                logger.info(f"Cache size OK: {count}/{max_size} FAQs")
                
    except Exception as e:
        logger.error(f"Error maintaining cache size: {e}")
        logger.exception(e)
        connection.rollback()


def get_cache_statistics(textbook_id: str, connection) -> Dict[str, Any]:
    """
    Get statistics about the FAQ cache for a textbook.
    
    Args:
        textbook_id: The textbook ID
        connection: Database connection
        
    Returns:
        Dictionary with cache statistics
    """
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    COUNT(*) as total_faqs,
                    SUM(usage_count) as total_uses,
                    AVG(usage_count) as avg_usage,
                    MAX(usage_count) as max_usage,
                    MIN(cached_at) as oldest_cache,
                    MAX(cached_at) as newest_cache
                FROM faq_cache
                WHERE textbook_id = %s
                """,
                (textbook_id,)
            )
            
            result = cur.fetchone()
            
            if result:
                return {
                    "total_faqs": result[0],
                    "total_uses": result[1] or 0,
                    "avg_usage": float(result[2]) if result[2] else 0,
                    "max_usage": result[3] or 0,
                    "oldest_cache": result[4].isoformat() if result[4] else None,
                    "newest_cache": result[5].isoformat() if result[5] else None
                }
            else:
                return {
                    "total_faqs": 0,
                    "total_uses": 0,
                    "avg_usage": 0,
                    "max_usage": 0,
                    "oldest_cache": None,
                    "newest_cache": None
                }
                
    except Exception as e:
        logger.error(f"Error getting cache statistics: {e}")
        logger.exception(e)
        return {}


def stream_cached_response(
    cached_faq: Dict[str, Any],
    websocket_endpoint: str,
    connection_id: str
) -> Dict[str, Any]:
    """
    Stream a cached FAQ response via WebSocket, mimicking the normal streaming behavior.
    
    Args:
        cached_faq: The cached FAQ dictionary from check_faq_cache
        websocket_endpoint: WebSocket API endpoint URL
        connection_id: WebSocket connection ID
        
    Returns:
        Dict with response and sources_used
    """
    try:
        logger.info(f"Streaming cached response via WebSocket (similarity: {cached_faq.get('similarity', 0):.4f})")
        
        # Initialize WebSocket client
        apigatewaymanagementapi = boto3.client('apigatewaymanagementapi', endpoint_url=websocket_endpoint)
        
        # Send start message
        try:
            apigatewaymanagementapi.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps({
                    "type": "start",
                    "message": "Retrieved from cache..."
                })
            )
        except Exception as ws_error:
            logger.error(f"WebSocket connection closed during start message: {ws_error}")
            return {
                "response": cached_faq["answer_text"],
                "sources_used": cached_faq.get("sources_used", [])
            }
        
        # Stream the cached answer
        # For cached responses, we send the full text as one chunk to maintain consistency
        answer_text = cached_faq["answer_text"]
        sources_used = cached_faq.get("sources_used", [])
        
        try:
            apigatewaymanagementapi.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps({
                    "type": "chunk",
                    "content": answer_text
                })
            )
        except Exception as chunk_error:
            logger.error(f"WebSocket connection closed during chunk: {chunk_error}")
            # Still return the response even if WebSocket fails
            return {
                "response": answer_text,
                "sources_used": sources_used
            }
        
        # Send completion message with sources
        completion_data = {
            "type": "complete",
            "sources": sources_used,
            "from_cache": True,
            "cache_similarity": cached_faq.get("similarity", 0)
        }
        
        try:
            apigatewaymanagementapi.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(completion_data)
            )
        except Exception:
            logger.warning("WebSocket connection closed during completion")
        
        logger.info(f"Successfully streamed cached response ({len(answer_text)} chars, {len(sources_used)} sources)")
        
        return {
            "response": answer_text,
            "sources_used": sources_used,
            "from_cache": True,
            "cache_similarity": cached_faq.get("similarity", 0)
        }
        
    except Exception as e:
        logger.error(f"Error streaming cached response: {e}")
        logger.exception(e)
        # Return the response anyway
        return {
            "response": cached_faq.get("answer_text", ""),
            "sources_used": cached_faq.get("sources_used", [])
        }
