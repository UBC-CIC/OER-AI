import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronDown, LibraryBig } from "lucide-react";
import PromptCard from "@/components/ChatInterface/PromptCard";
import AIChatMessage from "@/components/ChatInterface/AIChatMessage";
import UserChatMessage from "@/components/ChatInterface/UserChatMessage";
import { Button } from "@/components/ui/button";
import PromptLibraryModal from "@/components/ChatInterface/PromptLibraryModal";
import { useTextbookView } from "@/providers/textbookView";
import { AiChatInput } from "@/components/ChatInterface/userInput";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { PromptTemplate, SharedUserPrompt } from "@/types/Chat";
import { useUserSession } from "@/providers/usersession";
import { useMode } from "@/providers/mode";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  sources_used?: string[];
  time: number;
  isTyping?: boolean;
};

export default function AIChatPage() {
  // State
  const [message, setMessage] = useState("");
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [sharedPrompts, setSharedPrompts] = useState<SharedUserPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [seeMore, setSeeMore] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const {
    textbook,
    activeChatSessionId,
    chatSessions,
    createNewChatSession,
    isLoadingChatSessions,
    updateChatSessionName,
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

  // Load chat history and redirect if no chat session ID
  useEffect(() => {
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
        data.interactions.forEach((interaction) => {
          const baseTime = new Date(interaction.created_at).getTime();

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

        // Sort by creation time
        chatMessages.sort((a, b) => a.time - b.time);

        setMessages(chatMessages);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [activeChatSessionId, sessionUuid]);

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
      } catch (error) {
        console.error("Error fetching prompt templates:", error);
        setPrompts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  // Fetch shared prompts from API filtered by current mode
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

  async function sendMessage() {
    const text = message.trim();
    if (!text || !activeChatSessionId || !textbook) return;

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

    // append user and bot messages
    setMessages((m) => [...m, userMsg, botMsg]);
    setMessage("");
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

  function messageFormatter(message: Message) {
    if (message.sender === "user") {
      return (
        <UserChatMessage
          key={message.id}
          text={message.text}
          textbookId={textbook?.id || ""}
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
                <h1 className="text-4xl font-bold text-center mb-12 leading-tight max-w-full break-words">
                  What can I help with?
                </h1>
              </>
            ) : (
              /* messages area */
              <div className="flex flex-col gap-4 mb-6">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">
                      Loading chat history...
                    </p>
                  </div>
                ) : (
                  <>
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
          </div>
        </div>
        {/* Prompt Library Modal */}
        <PromptLibraryModal
          open={showLibrary}
          onOpenChange={setShowLibrary}
          prompts={prompts}
          sharedPrompts={sharedPrompts}
          onSelectPrompt={(msg) => {
            setMessage(msg);
          }}
          onFetchSharedPrompts={fetchSharedPrompts}
        />
      </div>
    </div>
  );
}
