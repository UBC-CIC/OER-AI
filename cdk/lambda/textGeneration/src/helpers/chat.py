import re
import boto3
from langchain_aws import ChatBedrock, BedrockLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
import logging
import json




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
    # Default model parameters for most models
    model_kwargs = {
        "temperature": temperature,
        "max_tokens": 4096
    }
    
    # Special handling for different model families
    if "llama" in bedrock_llm_id.lower():
        model_kwargs = {
            "temperature": temperature,
            "max_gen_len": 2048
        }
    elif "titan" in bedrock_llm_id.lower():
        model_kwargs = {
            "temperature": temperature,
            "maxTokenCount": 4096
        }
    
    logging.info(f"Initializing Bedrock LLM {bedrock_llm_id}")
    
    return ChatBedrock(
        model_id=bedrock_llm_id,
        model_kwargs=model_kwargs,
    )

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


def get_response(query: str, textbook_id: str, llm: ChatBedrock, retriever, connection=None) -> dict:
    """
    Generate a response to a query using the provided retriever and LLM.
    
    Args:
        query: The user's question
        textbook_id: The ID of the textbook being queried
        llm: The language model to use for generation
        retriever: The retriever to use for getting relevant document chunks
        connection: Database connection for fetching custom prompts (can be None)
        
    Returns:
        A dictionary containing the response and sources_used
    """
    logger = logging.getLogger()
    logger.info(f"Generating response for query: {query[:50]}...")
    
    try:
        # Get relevant documents from retriever
        docs = retriever.get_relevant_documents(query)
        logger.info(f"Retrieved {len(docs)} documents")
        
        if not docs:
            return {
                "response": f"I don't have any information about this in textbook {textbook_id}.",
                "sources_used": []
            }
        
        # Get custom prompt if available
        custom_prompt = get_textbook_prompt(textbook_id, connection)
        
        # Set up system prompt
        if custom_prompt:
            system_message = custom_prompt
        else:
            system_message = """You are a helpful assistant that answers questions about textbooks. 
                              Provide accurate information based only on the content provided.
                              If the context doesn't contain relevant information to fully answer the question, acknowledge this limitation.
                              When appropriate, reference specific sections or page numbers from the textbook."""
        
        # Set up prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            ("human", "{input}\n\nContext from textbook:\n{context}")
        ])
        
        # Create document chain
        document_chain = create_stuff_documents_chain(llm, prompt)
        
        # Generate response
        result = document_chain.invoke({"context": docs, "input": query})
        response_text = result["answer"]
        
        # Extract sources used
        sources_used = []
        for doc in docs:
            if hasattr(doc, "metadata"):
                source = doc.metadata.get("source", "")
                page = doc.metadata.get("page", "")
                if source and source not in sources_used:
                    source_entry = f"{source}"
                    if page:
                        source_entry += f" (p. {page})"
                    sources_used.append(source_entry)
        
        return {
            "response": response_text,
            "sources_used": sources_used
        }
        
    except Exception as e:
        logger.error(f"Error in get_response: {e}", exc_info=True)
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

