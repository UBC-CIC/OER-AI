import re
import boto3
import os
import time
from langchain_aws import ChatBedrock, BedrockLLM
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain, create_history_aware_retriever
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain_core.pydantic_v1 import BaseModel, Field
import logging
import json
import traceback

# Set up logging for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Validate required environment variables
TABLE_NAME = os.environ.get("TABLE_NAME_PARAM")
if not TABLE_NAME:
    logger.error("TABLE_NAME_PARAM environment variable is not set")
    raise ValueError("TABLE_NAME_PARAM environment variable is required for chat history functionality")

def get_bedrock_llm(
    bedrock_llm_id: str,
    temperature: float = 0
) -> ChatBedrock:
    """
    Create a Bedrock LLM instance based on the provided model ID.

    Args:
    bedrock_llm_id (str): The unique identifier for the Bedrock LLM model.
    temperature (float, optional): The temperature parameter for the LLM. Defaults to 0.

    Returns:
    ChatBedrock: An instance of the Bedrock LLM
    """
    try:
        logger.info(f"Initializing Bedrock LLM with ID: '{bedrock_llm_id}'")
        logger.info(f"Current environment: REGION={os.environ.get('REGION', 'not set')}")
        
        # Default model parameters for most models
        model_kwargs = {
            "temperature": temperature,
            "max_tokens": 4096
        }
        
        # Special handling for different model families
        if "llama" in bedrock_llm_id.lower():
            logger.info("Using llama-specific parameters")
            model_kwargs = {
                "temperature": temperature,
                "max_gen_len": 2048
            }
        elif "titan" in bedrock_llm_id.lower():
            logger.info("Using titan-specific parameters")
            model_kwargs = {
                "temperature": temperature,
                "maxTokenCount": 4096
            }
        elif "claude" in bedrock_llm_id.lower():
            logger.info("Using claude-specific parameters")
            model_kwargs = {
                "temperature": temperature,
                "max_tokens": 4096,
                "anthropic_version": "bedrock-2023-05-31"
            }
        
        logger.info(f"Model parameters: {json.dumps(model_kwargs)}")
        
        # Create Bedrock runtime client for this region
        region = os.environ.get('REGION')
        if region:
            bedrock_runtime = boto3.client("bedrock-runtime", region_name=region)
            logger.info(f"Created Bedrock runtime client for region: {region}")
        else:
            logger.warning("REGION environment variable not set, using default region")
            bedrock_runtime = boto3.client("bedrock-runtime")
        
        # Create and return the ChatBedrock instance
        logger.info(f"Creating ChatBedrock instance for model: {bedrock_llm_id}")
        return ChatBedrock(
            model_id=bedrock_llm_id,
            model_kwargs=model_kwargs,
            client=bedrock_runtime
        )
    except Exception as e:
        logger.error(f"Error initializing Bedrock LLM: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def get_textbook_prompt(textbook_id: str, connection) -> str:
    """Get a custom prompt for a textbook from the database if available."""
    if connection is None:
        return None
    
    try:
        with connection.cursor() as cur:
            # Try to get a textbook-specific prompt
            cur.execute("""
                SELECT prompt_text FROM textbook_prompts 
                WHERE textbook_id = %s
                ORDER BY created_at DESC LIMIT 1
            """, (textbook_id,))
            
            result = cur.fetchone()
            if result:
                return result[0]
                
            # Fall back to default prompt
            return None
    except Exception as e:
        logging.error(f"Error fetching textbook prompt: {e}")
        return None


def get_response(query: str, textbook_id: str, llm: ChatBedrock, retriever, chat_session_id: str, connection=None) -> dict:
    """
    Generate a response to a query using the provided retriever and LLM with chat history support.
    
    Args:
        query: The user's question
        textbook_id: The ID of the textbook being queried
        llm: The language model to use for generation
        retriever: The retriever to use for getting relevant document chunks
        chat_session_id: The session ID for maintaining chat history in DynamoDB
        connection: Database connection for fetching custom prompts (can be None)
        
    Returns:
        A dictionary containing the response and sources_used
    """
    # Validate required parameters
    if not chat_session_id:
        logger.warning("No chat_session_id provided, chat history will not be maintained")
        chat_session_id = f"default-{int(time.time())}"  # Fallback session ID
    logger.info(f"Processing query for textbook ID: {textbook_id}")
    logger.info(f"Query: '{query[:100]}...' (truncated)")
    logger.info(f"LLM model: {getattr(llm, 'model_id', 'Unknown model')}")
    
    start_time = time.time()
    
    try:
        # Log retriever info
        logger.info(f"Retriever type: {type(retriever).__name__}")
        logger.info(f"Using search parameters: {getattr(retriever, 'search_kwargs', {})}")
        
        # Get relevant documents from retriever
        logger.info("Retrieving relevant documents...")
        docs = retriever.get_relevant_documents(query)
        logger.info(f"Retrieved {len(docs)} documents")
        
        if not docs:
            logger.warning(f"No documents found for textbook {textbook_id} with query: {query[:50]}...")
            return {
                "response": f"I don't have any information about this in textbook {textbook_id}.",
                "sources_used": []
            }
        
        # Log document info
        for i, doc in enumerate(docs[:3]):  # Log only first 3 docs to avoid too much output
            doc_content = str(doc.page_content)[:100] + "..." if len(str(doc.page_content)) > 100 else str(doc.page_content)
            logger.info(f"Document {i+1}: {doc_content}")
            if hasattr(doc, "metadata"):
                logger.info(f"Document {i+1} metadata: {doc.metadata}")
        
        # Get custom prompt if available
        #custom_prompt = get_textbook_prompt(textbook_id, connection)
        custom_prompt = None
        logger.info(f"Using {'custom' if custom_prompt else 'default'} prompt template")
        
        # Set up system prompt
        if custom_prompt:
            system_message = custom_prompt
        else:
            system_message = """You are a helpful assistant that answers questions about textbooks. 
                              Provide accurate information based only on the content provided.
                              If the context doesn't contain relevant information to fully answer the question, acknowledge this limitation.
                              When appropriate, reference specific sections or page numbers from the textbook.
                              """

        # Initialize chat history with proper error handling
        try:
            chat_history = DynamoDBChatMessageHistory(
                table_name=TABLE_NAME,
                session_id=chat_session_id,
                ttl=3600*24*30 # 30 days expiration (matches DynamoDB table TTL configuration)
            )
            
            # Retrieve existing messages for logging
            messages = chat_history.messages
            logger.info(f"Current conversation has {len(messages)} messages in history")
            for i, msg in enumerate(messages[-4:]):  # Log last 4 messages for context
                logger.info(f"History[{i}]: {msg.type} - {msg.content[:50]}...")
                
        except Exception as history_error:
            logger.error(f"Error initializing DynamoDB chat history: {history_error}")
            logger.warning("Proceeding without chat history due to DynamoDB error")
            # In case of DynamoDB issues, we can still provide a response without history
            chat_history = None
        
        contextualize_q_system_prompt = """Given a chat history and the latest user question \
                                            which might reference context in the chat history, formulate a standalone question \
                                            which can be understood without the chat history. Do NOT answer the question, \
                                            just reformulate it if needed and otherwise return it as is."""
        
        contextualize_q_prompt = ChatPromptTemplate.from_messages([
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])

        # Create history-aware retriever
        history_aware_retriever_chain = create_history_aware_retriever(
            llm, retriever, contextualize_q_prompt
        )

        qa_system_prompt = f"""{system_message}

                            Use the following retrieved context to answer the question. If you don't know the answer, just say that you don't know.

                            {{context}}"""

        qa_prompt = ChatPromptTemplate.from_messages([
            ("system", qa_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])

        # Create document chain
        question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)


        # Create the full RAG chain
        rag_chain = create_retrieval_chain(history_aware_retriever_chain, question_answer_chain)
        
        # Create conversational RAG chain with or without message history
        if chat_history is not None:
            # Use conversational chain with history
            conversational_rag_chain = RunnableWithMessageHistory(
                rag_chain,
                lambda session_id: DynamoDBChatMessageHistory(
                    table_name=TABLE_NAME,
                    session_id=session_id,  # This session_id comes from the lambda parameter
                    ttl=3600*24*30 # 30 days expiration
                ),
                input_messages_key="input",
                history_messages_key="chat_history",
                output_messages_key="answer",
            )
            
            result = conversational_rag_chain.invoke(
                {"input": query},
                config={"configurable": {"session_id": chat_session_id}}
            )
        else:
            # Fallback: use basic RAG chain without history
            logger.info("Using RAG chain without chat history due to DynamoDB error")
            result = rag_chain.invoke({"input": query})
        
        # Log the complete result object structure for debugging
        logger.info(f"RAG chain result type: {type(result)}")
        logger.info(f"RAG chain result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
        logger.info(f"RAG chain result: {json.dumps(result, indent=2, default=str)[:1000]}...")  # Truncate to avoid too much output
        
        response_text = result["answer"]
        docs = result["context"]
        end_time = time.time()
        logger.info(f"Response generated in {end_time - start_time:.2f} seconds")
        logger.info(f"Response length: {len(response_text)} characters")
        
        # Extract sources used
        sources_used = []
        for doc in docs:
            if hasattr(doc, "metadata"):
                source = doc.metadata.get("source", "")
                page = doc.metadata.get("page", None)
                if source and source not in sources_used:
                    source_entry = f"{source}"
                    if page:
                        source_entry += f" (p. {page})"
                    sources_used.append(source_entry)
        
        logger.info(f"Sources used: {sources_used}")
        
        return {
            "response": response_text,
            "sources_used": sources_used,
        }
        
    except Exception as e:
        logger.error(f"Error in get_response: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "response": f"Sorry, I encountered an error when trying to answer your question: {str(e)}",
            "sources_used": []
        }


def split_into_sentences(paragraph: str) -> list[str]:
    """
    Splits a given paragraph into individual sentences.
    
    Args:
        paragraph: The input text paragraph to be split into sentences
        
    Returns:
        A list of sentences from the input paragraph
    """
    # Regular expression pattern
    sentence_endings = r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s'
    sentences = re.split(sentence_endings, paragraph)
    return sentences

