import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, LibraryBig } from "lucide-react";
import PromptCard from "@/components/ChatInterface/PromptCard";
import AIChatMessage from "@/components/ChatInterface/AIChatMessage";
import UserChatMessage from "@/components/ChatInterface/UserChatMessage";
import GuidedQuestionMessage from "@/components/ChatInterface/GuidedQuestionMessage";
import ShareChatButton from "@/components/ChatInterface/ShareChatButton";
import { Button } from "@/components/ui/button";
import PromptLibraryModal from "@/components/ChatInterface/PromptLibraryModal";
import { useTextbookView } from "@/providers/textbookView";
import { AiChatInput } from "@/components/ChatInterface/userInput";
import { useWebSocket } from "@/hooks/useWebSocket";
import type {
  PromptTemplate,
  SharedUserPrompt,
  GuidedPromptTemplate,
  GuidedPromptQuestion,
  Message,
} from "@/types/Chat";
import { useUserSession } from "@/providers/usersession";
import { useMode } from "@/providers/mode";

export default function AIChatPage() {
  // URL search params for pre-filled questions (from FAQ page)
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [message, setMessage] = useState("");
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [sharedPrompts, setSharedPrompts] = useState<SharedUserPrompt[]>([]);
  const [guidedPrompts, setGuidedPrompts] = useState<GuidedPromptTemplate[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [seeMore, setSeeMore] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Shared chat state
  const [sharedChatSessionId, setSharedChatSessionId] = useState<string | null>(
    null
  );
  const [isLoadingSharedChat, setIsLoadingSharedChat] = useState(false);
  const [hasForkedChat, setHasForkedChat] = useState(false);
  const [sharedChatError, setSharedChatError] = useState<string | null>(null);

  const {
    textbook,
    activeChatSessionId,
    setActiveChatSessionId,
    chatSessions,
    createNewChatSession,
    isLoadingChatSessions,
    updateChatSessionName,
    refreshChatSessions,
  } = useTextbookView();
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );

  const { sessionUuid } = useUserSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mode } = useMode();

  const textbookTitle = textbook?.title ?? "Calculus: Volume 3";

  const [guidedState, setGuidedState] = useState<{
    isActive: boolean;
    templateId: string;
    questions: GuidedPromptQuestion[];
    currentIndex: number;
    answers: string[];
  }>({
    isActive: false,
    templateId: "",
    questions: [],
    currentIndex: 0,
    answers: [],
  });

  // Auto-scroll to bottom when messages change or when typing starts
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize chat session if needed
  useEffect(() => {
    const initializeChatSession = async () => {
      // Wait for chat sessions to load
      if (isLoadingChatSessions) return;

      // If no active chat session and no existing sessions, create one
      if (!activeChatSessionId && chatSessions.length === 0) {
        console.log("No chat sessions found, creating new one");
        await createNewChatSession();
      }
    };

    initializeChatSession();
  }, [
    activeChatSessionId,
    chatSessions.length,
    isLoadingChatSessions,
    createNewChatSession,
  ]);

  // WebSocket configuration
  const webSocketUrl = useMemo(() => import.meta.env.VITE_WEBSOCKET_URL, []);
  console.log("[WebSocket] Attempting connection to:", webSocketUrl);

  // WebSocket message handlers - memoized to prevent unnecessary reconnections
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      console.log("[WebSocket] Received message:", message);

      switch (message.type) {
        case "start":
          setIsStreaming(true);
          // Update the streaming message to show typing indicator
          if (streamingMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId ? { ...msg, isTyping: true } : msg
              )
            );
          }
          break;

        case "chunk":
          if (message.content && streamingMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? {
                      ...msg,
                      text: msg.text + message.content,
                      isTyping: false,
                    }
                  : msg
              )
            );
          }
          break;

        case "complete":
          setIsStreaming(false);
          setStreamingMessageId(null);
          if (message.sources && streamingMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? { ...msg, sources_used: message.sources, isTyping: false }
                  : msg
              )
            );
          }
          // Handle session name update
          if (message.session_name && activeChatSessionId) {
            updateChatSessionName(activeChatSessionId, message.session_name);
          }
          break;

        case "error":
          setIsStreaming(false);
          setStreamingMessageId(null);
          if (streamingMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageId
                  ? {
                      ...msg,
                      text: message.message || "An error occurred",
                      isTyping: false,
                    }
                  : msg
              )
            );
          }
          break;
      }
    },
    [streamingMessageId, activeChatSessionId, updateChatSessionName]
  ); // Only recreate when streamingMessageId changes

  const {
    sendMessage: sendWebSocketMessage,
    isConnected,
    connectionState,
    forceReconnect,
  } = useWebSocket(webSocketUrl, {
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      console.log("[WebSocket] Connected to:", webSocketUrl);
      console.log("Streaming: ", isStreaming);
    },
    onDisconnect: () => {
      console.log("[WebSocket] Disconnected from:", webSocketUrl);
      console.log("Streaming: ", isStreaming);
    },
    onError: (error) => {
      console.error("[WebSocket] Error:", error, "URL:", webSocketUrl);
      console.log("Streaming: ", isStreaming);
    },
  });

  // Detect and load shared chat from URL parameter
  useEffect(() => {
    const shareParam = searchParams.get("share");

    if (!shareParam || sharedChatSessionId) {
      return; // No share parameter or already loaded
    }

    const loadAndForkSharedChat = async () => {
      setIsLoadingSharedChat(true);
      setSharedChatError(null);

      try {
        // Get public token
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResponse.ok) throw new Error("Failed to get public token");
        const { token } = await tokenResponse.json();

        // Fetch shared chat history from the public endpoint
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/chat_sessions/${shareParam}/interactions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Chat session not found");
          }
          throw new Error("Failed to load shared chat");
        }

        interface SharedInteraction {
          id: string;
          sender_role: string;
          query_text?: string;
          response_text?: string;
          source_chunks?: string[];
          created_at: string;
          order_index?: number;
        }

        const data: {
          chat_session_id: string;
          textbook_id: string;
          interactions: SharedInteraction[];
        } = await response.json();

        const chatMessages: Message[] = [];

        // Convert interactions to messages - process in order
        data.interactions.forEach((interaction, index) => {
          // Use order_index if available, otherwise use array index
          const orderValue = interaction.order_index ?? index;
          const baseTime = orderValue * 1000; // Multiply by 1000 to create distinct timestamps

          // Add user message if query_text exists
          if (interaction.query_text) {
            chatMessages.push({
              id: `${interaction.id}-user`,
              sender: "user" as const,
              text: interaction.query_text,
              sources_used: [],
              time: baseTime,
            });
          }

          // Add AI response if response_text exists
          if (interaction.response_text) {
            chatMessages.push({
              id: `${interaction.id}-ai`,
              sender: "bot" as const,
              text: interaction.response_text,
              sources_used: interaction.source_chunks || [],
              time: baseTime + 1,
            });
          }
        });

        // Sort by time to ensure proper order
        chatMessages.sort((a, b) => a.time - b.time);

        setMessages(chatMessages);

        // Immediately fork the chat session
        const forkResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/chat_sessions/fork`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              source_chat_session_id: shareParam,
              user_session_id: sessionUuid,
              textbook_id: textbook?.id,
            }),
          }
        );

        if (!forkResponse.ok) {
          throw new Error("Failed to fork chat session");
        }

        const forkData = await forkResponse.json();
        const newChatSessionId = forkData.chat_session_id;

        // Update state to reflect the forked chat
        setHasForkedChat(true);
        setActiveChatSessionId(newChatSessionId);
        setSharedChatSessionId(shareParam);
      } catch (error) {
        console.error("Failed to load shared chat:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load shared chat";
        setSharedChatError(errorMessage);

        // Redirect to new chat after 3 seconds for invalid links
        setTimeout(() => {
          setSearchParams({});
          setSharedChatError(null);
        }, 3000);
      } finally {
        setIsLoadingSharedChat(false);
      }
    };

    loadAndForkSharedChat();
  }, [
    searchParams,
    sharedChatSessionId,
    textbook?.id,
    sessionUuid,
    setSearchParams,
    setActiveChatSessionId,
    refreshChatSessions,
  ]);

  // Load chat history and redirect if no chat session ID
  useEffect(() => {
    // Skip loading history if we're viewing a shared chat
    if (sharedChatSessionId && !hasForkedChat) {
      return;
    }

    if (!activeChatSessionId) {
      return;
    }

    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        // Get public token
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResponse.ok) throw new Error("Failed to get public token");
        const { token } = await tokenResponse.json();

        // Get interactions for the specific chat session
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/user_sessions/${sessionUuid}/chat_sessions/${activeChatSessionId}/interactions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to load chat history");

        interface Interaction {
          id: string;
          chat_session_id: string;
          sender_role: string;
          query_text?: string;
          response_text?: string;
          source_chunks?: string[];
          created_at: string;
        }

        const data: { interactions: Interaction[] } = await response.json();
        const chatMessages: Message[] = [];

        // Each interaction contains both user query and AI response
        // Process in order - backend already sorts by order_index
        data.interactions.forEach((interaction, index) => {
          // Use index to create distinct timestamps that preserve order
          const baseTime = index * 1000;

          // Add user message if query_text exists
          if (interaction.query_text) {
            chatMessages.push({
              id: `${interaction.id}-user`,
              sender: "user" as const,
              text: interaction.query_text,
              sources_used: [],
              time: baseTime,
            });
          }

          // Add AI response if response_text exists
          if (interaction.response_text) {
            chatMessages.push({
              id: `${interaction.id}-ai`,
              sender: "bot" as const,
              text: interaction.response_text,
              sources_used: interaction.source_chunks || [],
              time: baseTime + 1, // Ensure AI response comes after user message
            });
          }
        });

        // Sort by time to ensure proper order
        chatMessages.sort((a, b) => a.time - b.time);

        setMessages(chatMessages);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [activeChatSessionId, sessionUuid, sharedChatSessionId, hasForkedChat]);

  // Fetch prompt templates from API
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        // Acquire public token then call the endpoint with Authorization
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResponse.ok) throw new Error("Failed to get public token");
        const { token } = await tokenResponse.json();

        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/prompt_templates`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();
        const templates = data.templates || [];
        setPrompts(templates);

        // Set guided prompts without questions (lazy load later)
        const guidedTemplates = templates.filter(
          (t: PromptTemplate) => t.type === "guided"
        );
        setGuidedPrompts(guidedTemplates.length > 0 ? guidedTemplates : []);
      } catch (error) {
        console.error("Error fetching prompt templates:", error);
        setPrompts([]);
        setGuidedPrompts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  const fetchSharedPrompts = useCallback(async () => {
    if (!textbook?.id) return; // Need textbook_id
    try {
      // Acquire public token
      const tokenResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (!tokenResponse.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResponse.json();

      // Pass role as query param to backend
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${
          textbook.id
        }/shared_prompts?role=${mode}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      const allSharedPrompts = data.prompts || [];
      setSharedPrompts(allSharedPrompts);
    } catch (error) {
      console.error("Error fetching shared prompts:", error);
      setSharedPrompts([]);
    }
  }, [textbook?.id, mode]);

  const startGuidedConversation = async (template: GuidedPromptTemplate) => {
    try {
      // lazy fetch questions for template
      let questions = template.questions;
      if (!questions) {
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        const { token } = await tokenResponse.json();

        const questionsResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/prompt_templates/${
            template.id
          }/questions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const questionsData = await questionsResponse.json();
        questions = questionsData.questions || [];

        // Update the template in state with questions
        setGuidedPrompts((prev) =>
          prev.map((p) => (p.id === template.id ? { ...p, questions } : p))
        );
      }

      if (!questions.length) return;

      setGuidedState({
        isActive: true,
        templateId: template.id,
        questions,
        currentIndex: 0,
        answers: [],
      });

      // Send first question as AI message
      const firstQuestion = questions[0];
      const aiMsg: Message = {
        id: `guided-${Date.now()}`,
        sender: "bot",
        text: firstQuestion.question_text,
        time: Date.now(),
        isGuidedQuestion: true,
        guidedData: {
          templateId: template.id,
          questionIndex: 0,
          totalQuestions: questions.length,
        },
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Error starting guided conversation:", error);
    }
  };

  async function sendMessage() {
    let text = message.trim();
    if (!text || !textbook) return;

    // Handle forking shared chat on first message
    if (sharedChatSessionId && !hasForkedChat) {
      try {
        // Get public token
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResponse.ok) throw new Error("Failed to get public token");
        const { token } = await tokenResponse.json();

        // Call fork endpoint
        const forkResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/chat_sessions/fork`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              source_chat_session_id: sharedChatSessionId,
              user_session_id: sessionUuid,
              textbook_id: textbook.id,
            }),
          }
        );

        if (!forkResponse.ok) {
          throw new Error("Failed to fork chat session");
        }

        const forkData = await forkResponse.json();
        const newChatSessionId = forkData.chat_session_id;

        // Update state to reflect the forked chat
        setHasForkedChat(true);
        setActiveChatSessionId(newChatSessionId);

        // Refresh chat sessions to show the new forked session in sidebar
        await refreshChatSessions();

        // Remove 'share' parameter from URL
        setSearchParams({});

        // Mark all existing messages as no longer from shared chat
        setMessages((prev) =>
          prev.map((msg) => ({ ...msg, isFromSharedChat: false }))
        );

        // Continue with sending the message using the new chat session
        // The rest of the function will handle this
      } catch (error) {
        console.error("Failed to fork chat session:", error);

        // Show error message to user
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          sender: "bot",
          text: "Failed to create your copy of this chat. Please try again or start a new chat.",
          time: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }
    }

    // Ensure we have an active chat session
    if (!activeChatSessionId) return;

    // Handle guided conversation state
    if (guidedState.isActive) {
      const newAnswers = [...guidedState.answers, text];
      const nextIndex = guidedState.currentIndex + 1;

      // Add user's answer to chat
      const userMsg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sender: "user",
        text,
        time: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setMessage("");

      if (nextIndex < guidedState.questions.length) {
        // Ask next question
        const nextQuestion = guidedState.questions[nextIndex];
        const aiMsg: Message = {
          id: `guided-${Date.now()}`,
          sender: "bot",
          text: nextQuestion.question_text,
          time: Date.now() + 1,
          isGuidedQuestion: true,
          guidedData: {
            templateId: guidedState.templateId,
            questionIndex: nextIndex,
            totalQuestions: guidedState.questions.length,
          },
        };
        setMessages((prev) => [...prev, aiMsg]);
        setGuidedState((prev) => ({
          ...prev,
          currentIndex: nextIndex,
          answers: newAnswers,
        }));
        return;
      } else {
        // All questions answered - construct final prompt by replacing placeholders
        const template = guidedPrompts.find(
          (p) => p.id === guidedState.templateId
        );

        let finalPrompt = template?.description || "";

        // Extract all placeholders from the template description (e.g., [SUBJECT], [X], etc.)
        const placeholderRegex = /\[([^\]]+)\]/g;
        const placeholders: string[] = [];
        let match;

        while (
          (match = placeholderRegex.exec(template?.description || "")) !== null
        ) {
          placeholders.push(match[0]); // Store the full placeholder including brackets
        }

        // Replace each placeholder with the corresponding user answer
        newAnswers.forEach((answer, index) => {
          if (index < placeholders.length) {
            // replace placeholder with answer
            finalPrompt = finalPrompt.replace(placeholders[index], answer);
          }
        });

        setGuidedState({
          isActive: false,
          templateId: "",
          questions: [],
          currentIndex: 0,
          answers: [],
        });

        // Override text to send final prompt to AI
        console.log("Final constructed prompt:", finalPrompt);
        text = finalPrompt;
      }
    }

    // Create user message for AI generation
    const userMsg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sender: "user",
      text,
      time: Date.now(),
    };

    // Create bot message placeholder for streaming
    const botMsg: Message = {
      id: `${Date.now() + 1}-${Math.random().toString(36).slice(2, 9)}`,
      sender: "bot",
      text: "",
      sources_used: [],
      time: Date.now() + 1,
      isTyping: true, // Start with typing indicator
    };

    // Add user and bot messages
    setMessages((m) => [...m, userMsg, botMsg]);
    if (!guidedState.isActive) setMessage(""); // Only clear if not in guided state
    setStreamingMessageId(botMsg.id);
    setIsStreaming(true);

    // Try WebSocket streaming first, fallback to HTTP if not connected
    if (isConnected && webSocketUrl) {
      console.log("[WebSocket] Sending message via WebSocket:", {
        action: "generate_text",
        textbook_id: textbook.id,
        query: text,
        chat_session_id: activeChatSessionId,
      });
      const success = sendWebSocketMessage({
        action: "generate_text",
        textbook_id: textbook.id,
        query: text,
        chat_session_id: activeChatSessionId,
      });

      if (success) {
        console.log("[WebSocket] Message sent successfully.");
        return;
      } else {
        console.warn(
          "[WebSocket] Message send failed. Attempting reconnect..."
        );
        forceReconnect();
      }
    } else {
      console.warn(
        `[WebSocket] Not connected (state: ${connectionState}). Falling back to HTTP.`
      );
    }

    // Fallback to HTTP API if WebSocket is not available
    console.log("[WebSocket] Fallback: Sending message via HTTP API...");

    // Show typing indicator for HTTP fallback
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === botMsg.id ? { ...msg, isTyping: true } : msg
      )
    );

    try {
      // Get fresh token for the request
      const tokenResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      const { token } = await tokenResponse.json();

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/chat_sessions/${activeChatSessionId}/text_generation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            textbook_id: textbook.id,
            query: text,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate response");
      }

      const data = await response.json();

      // Update the bot message with the complete response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsg.id
            ? {
                ...msg,
                text: data.response || "Sorry, I couldn't generate a response.",
                sources_used: data.sources || [],
                isTyping: false,
              }
            : msg
        )
      );

      // Handle session name update for HTTP fallback
      if (data.session_name && activeChatSessionId) {
        updateChatSessionName(activeChatSessionId, data.session_name);
      }
    } catch (error) {
      console.error("Error generating text:", error);
      // Update the bot message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsg.id
            ? {
                ...msg,
                text: "Sorry, there was an error processing your request.",
                isTyping: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  }

  // Handle pre-filled question from URL (e.g., from FAQ page)
  useEffect(() => {
    const question = searchParams.get("question");
    const answer = searchParams.get("answer");

    // Wait for history to finish loading before processing FAQ params
    if (
      question &&
      activeChatSessionId &&
      textbook &&
      !isStreaming &&
      !isLoadingHistory
    ) {
      // If both question and answer are provided (from FAQ), display them directly
      if (answer) {
        const userMsg: Message = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          sender: "user",
          text: question,
          time: Date.now(),
        };

        const botMsg: Message = {
          id: `${Date.now() + 1}-${Math.random().toString(36).slice(2, 9)}`,
          sender: "bot",
          text: answer,
          sources_used: [],
          time: Date.now() + 1,
        };

        // Append to existing messages (history)
        setMessages((prev) => [...prev, userMsg, botMsg]);
        setSearchParams({});
      } else {
        // Only question provided, send it to LLM
        setMessage(question);
        setSearchParams({});

        setTimeout(() => {
          if (question.trim()) {
            sendMessage();
          }
        }, 100);
      }
    }
  }, [
    searchParams,
    activeChatSessionId,
    textbook,
    isStreaming,
    isLoadingHistory,
  ]);

  function messageFormatter(message: Message) {
    if (message.sender === "user") {
      return (
        <UserChatMessage
          key={message.id}
          text={message.text}
          textbookId={textbook?.id || ""}
        />
      );
    } else if (message.isGuidedQuestion && message.guidedData) {
      return (
        <GuidedQuestionMessage
          key={message.id}
          text={message.text}
          questionIndex={message.guidedData.questionIndex}
          totalQuestions={message.guidedData.totalQuestions}
        />
      );
    } else {
      return (
        <AIChatMessage
          key={message.id}
          text={message.text}
          sources={message.sources_used}
          isTyping={message.isTyping}
        />
      );
    }
  }

  return (
    <div className="w-full max-w-2xl 2xl:max-w-3xl px-4 py-4">
      <div
        className={`flex flex-col w-full ${
          messages.length === 0
            ? "justify-center"
            : "justify-between min-h-[90vh]"
        }`}
      >
        <div
          className={`flex flex-col w-full max-w-2xl 2xl:max-w-3xl px-4 py-4 ${
            messages.length === 0
              ? "justify-center"
              : "justify-between min-h-[90vh]"
          }`}
        >
          {/* top section */}
          <div>
            {messages.length === 0 ? (
              <>
                {/* Hero title */}
                <h1 className="text-4xl font-bold text-center mb-4 leading-tight max-w-full break-words">
                  What can I help with?
                </h1>

                {/* Source URL Button
                {textbook?.source_url && (
                  <div className="flex justify-center mb-12">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <a
                        href={textbook.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <LibraryBig className="h-4 w-4" />
                        View Original Textbook
                      </a>
                    </Button>
                  </div>
                )} */}
              </>
            ) : (
              /* messages area */
              <div className="flex flex-col gap-4 mb-6">
                {/* Chat header with share button */}
                {messages.length > 0 &&
                  activeChatSessionId &&
                  textbook?.id &&
                  !sharedChatSessionId && (
                    <div className="flex justify-end items-center mb-2">
                      <ShareChatButton
                        chatSessionId={activeChatSessionId}
                        textbookId={textbook.id}
                        disabled={false}
                      />
                    </div>
                  )}

                {/* Show shared chat loading state */}
                {isLoadingSharedChat ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">
                      Loading shared chat...
                    </p>
                  </div>
                ) : sharedChatError ? (
                  /* Show error message for invalid shared chat */
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <p className="text-destructive font-medium">
                      {sharedChatError}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Redirecting to new chat...
                    </p>
                  </div>
                ) : isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">
                      Loading chat history...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Show banner if viewing shared chat */}
                    {sharedChatSessionId && !hasForkedChat && (
                      <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
                        <p className="text-sm text-muted-foreground">
                          You're viewing a shared conversation. Send a message
                          to continue this chat in your own session.
                        </p>
                      </div>
                    )}
                    {messages.map((m) => messageFormatter(m))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* thebottom section */}
          <div>
            {/* Input Area */}
            <div className="relative mb-6">
              <AiChatInput
                value={message}
                onChange={(val: string) => setMessage(val)}
                placeholder={`Ask anything about ${textbookTitle}`}
                onSend={sendMessage}
              />
              {/* Connection Status Indicator (for debugging) */}
              {import.meta.env.DEV && (
                <div className="text-xs text-muted-foreground mt-1">
                  WebSocket: {connectionState} {isConnected && "🟢"}{" "}
                  {connectionState === "connecting" && "🟡"}{" "}
                  {connectionState === "disconnected" && "🔴"}
                </div>
              )}
            </div>

            {/* Prompt Suggestions */}
            {(messages.length === 0 || seeMore) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {loading ? (
                  <div className="col-span-full text-center py-4">
                    <p className="text-muted-foreground">Loading prompts...</p>
                  </div>
                ) : (
                  prompts
                    .slice(0, messages.length === 0 && !seeMore ? 3 : 12)
                    .map((prompt, index) => (
                      <PromptCard
                        key={prompt.id || index}
                        name={prompt.name}
                        onClick={() => {
                          setMessage(prompt.description || prompt.name);
                        }}
                      />
                    ))
                )}
              </div>
            )}

            {/* Prompt Options*/}
            <div className="w-full gap-4 flex justify-end items-center">
              <Button
                onClick={() => setShowLibrary(true)}
                variant={"link"}
                className="cursor-pointer gap-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                Prompt Library
                <LibraryBig className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setSeeMore(!seeMore)}
                variant={"link"}
                className="cursor-pointer gap-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                {seeMore ? "Show less" : "See more prompts"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    seeMore ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>

            {/* AI Disclaimer */}
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Opterna can make mistakes. Check important info.
              </p>
            </div>
          </div>
        </div>
        {/* Prompt Library Modal */}
        <PromptLibraryModal
          open={showLibrary}
          onOpenChange={setShowLibrary}
          prompts={prompts}
          sharedPrompts={sharedPrompts}
          guidedPrompts={guidedPrompts}
          onSelectPrompt={(msg) => {
            setMessage(msg);
          }}
          onSelectGuidedPrompt={startGuidedConversation}
          onFetchSharedPrompts={fetchSharedPrompts}
        />
      </div>
    </div>
  );
}
