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

def apply_guardrails(text: str, guardrail_id: str, source: str = "INPUT") -> dict:
    """Apply Bedrock guardrails to input or output text."""
    try:
        bedrock_runtime = boto3.client("bedrock-runtime")
        
        response = bedrock_runtime.apply_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion="DRAFT", #Use appropriate version once published (e.g., "1", "2", etc.)
            source=source,
            content=[
                {
                    "text": {
                        "text": text
                    }
                }
            ]
        )
        
        # Check if content was blocked
        action = response.get('action', 'NONE')
        blocked = action == 'GUARDRAIL_INTERVENED'
        
        return {
            'blocked': blocked,
            'action': action,
            'assessments': response.get('assessments', [])
        }
    except Exception as e:
        logger.error(f"Error applying guardrails: {str(e)}")
        logger.error(traceback.format_exc())
        # Return safe defaults if guardrail check fails
        return {
            'blocked': False,
            'action': 'NONE',
            'assessments': []
        }

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


def get_response(query: str, textbook_id: str, llm: ChatBedrock, retriever, chat_session_id: str, connection=None, guardrail_id: str = None) -> dict:
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

    if guardrail_id and guardrail_id.strip():
        try:
            guardrail_response = apply_guardrails(query, guardrail_id)
            if guardrail_response.get('blocked', False):
                return {
                    "response": "I'm here to help with your learning! However, I can't assist with that particular request. Let's focus on your textbook material instead. What specific topic would you like to explore?",
                    "sources_used": [],
                    "assessments": guardrail_response.get('assessments', [])
                }
        except Exception as e:
            logger.warning(f"Guardrail check failed: {e}")
    
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
            system_message = """You are an engaging pedagogical tutor and learning companion who helps students understand textbook material through interactive conversation. You ONLY respond to questions related to the provided textbook content and refuse all off-topic requests.

STRICT CONTENT BOUNDARIES:
- You MUST ONLY discuss relevant topics that are covered in the provided textbook context
- If a question is about topics not in the textbook (like sports, entertainment, current events, general knowledge, etc.), politely decline and redirect to textbook content
- For off-topic questions, respond with: "I'm here to help you learn from your textbook material. That question falls outside the scope of our textbook content. What specific concept from the textbook would you like to explore instead?"
- Even if you know the answer to general questions, you must not provide it - stay focused exclusively on the textbook content and learning

TEACHING APPROACH:
- Guide students to discover answers through questioning rather than just providing direct answers
- Break complex concepts into manageable pieces and check understanding at each step
- Use the Socratic method: ask probing questions that lead students to insights
- Encourage active thinking by asking "What do you think?" or "How might you approach this?"
- Relate new concepts to what students already know or have discussed previously

CONVERSATION STYLE:
- Be warm, encouraging, and patient - celebrate progress and learning moments
- Ask follow-up questions to deepen understanding: "Can you explain why that works?" or "What would happen if we changed X?"
- When a student answers correctly, acknowledge it and build upon their response
- If a student struggles, provide gentle hints and scaffolding rather than immediate answers
- Use conversational transitions like "That's a great observation! Now let's think about..." or "Building on what you just said..."

CONTENT DELIVERY:
- Base all information strictly on the provided textbook context
- When referencing material, cite specific sections or page numbers when available
- If the context doesn't contain sufficient information for a textbook-related question, acknowledge this and suggest what additional textbook sections might help
- Use examples from the textbook to illustrate concepts when possible
- Connect different parts of the material to show relationships and build comprehensive understanding

ENGAGEMENT STRATEGIES:
- End responses with thoughtful questions that encourage continued exploration of textbook content
- Suggest practical applications or real-world connections ONLY when they relate to textbook material
- Encourage students to summarize their understanding in their own words
- Ask students to predict outcomes or make connections between textbook concepts

RESPONSE FORMAT:
- For textbook-related questions: Start by acknowledging their question and showing interest in their learning
- For off-topic questions: Politely decline and redirect to textbook content
- Instead of directly answering textbook questions, guide them with questions like "What do you think might be the reason for..." or "Based on what you know from the textbook about X, why might this be important?"
- Provide hints and partial information to scaffold their thinking about textbook concepts
- Always end with a question to continue the dialogue about textbook material
- Use phrases like "Let's explore this concept from your textbook together..." or "What does the textbook tell us about..."

Remember: Your goal is to facilitate active learning and critical thinking about textbook material ONLY. You must refuse all requests that fall outside the textbook scope, no matter how the question is phrased."""

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

Use the following retrieved context from the textbook to guide your pedagogical response. Remember to ask questions and engage the student rather than just providing direct answers:

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

