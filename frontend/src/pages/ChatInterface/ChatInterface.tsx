import { useState, useEffect } from "react";
import { ChevronDown, LibraryBig } from "lucide-react";
import PromptCard from "@/components/ChatInterface/PromptCard";
import AIChatMessage from "@/components/ChatInterface/AIChatMessage";
import UserChatMessage from "@/components/ChatInterface/UserChatMessage";
import { Button } from "@/components/ui/button";
import PromptLibraryModal from "@/components/ChatInterface/PromptLibraryModal";
import Header from "@/components/Header";
import StudentSideBar from "@/components/ChatInterface/StudentSideBar";
import { SidebarProvider } from "@/providers/SidebarContext";
import { useLocation, useNavigate } from "react-router";
import { useUserSession } from "@/contexts/UserSessionContext";
import { AiChatInput } from "@/components/ChatInterface/userInput";
import type { PromptTemplate } from "@/types/Chat";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  sources_used?: string[];
  time: number;
};

export default function AIChatPage() {
  // State
  const [message, setMessage] = useState("");
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [seeMore, setSeeMore] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Hooks and location state
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionUuid } = useUserSession();

  const navTextbook = location.state?.textbook;
  const chatSessionId = location.state?.chatSessionId;
  const textbookTitle = navTextbook?.title ?? "Calculus: Volume 3";
  const textbookAuthor = navTextbook?.author
    ? navTextbook.author.join(", ")
    : "OpenStax";

  // Load chat history and redirect if no chat session ID
  useEffect(() => {
    if (!chatSessionId) {
      navigate("/");
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
          }/user_sessions/${sessionUuid}/chat_sessions/${chatSessionId}/interactions`,
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
  }, [chatSessionId, navigate, sessionUuid]);

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
        setPrompts(
          templates.length > 0
            ? templates
            : [
                {
                  id: "1",
                  name: "Summarize a Chapter",
                  description:
                    "Provide a concise summary of a specific chapter",
                  type: "RAG",
                  visibility: "public",
                  created_at: "",
                },
                {
                  id: "2",
                  name: "Define and explain a term",
                  description:
                    "Give a clear definition and explanation of a concept or term",
                  type: "RAG",
                  visibility: "public",
                  created_at: "",
                },
                {
                  id: "3",
                  name: "Generate an example problem",
                  description:
                    "Create a practice problem with step-by-step solution",
                  type: "RAG",
                  visibility: "public",
                  created_at: "",
                },
                {
                  id: "4",
                  name: "Explain a concept in simple terms",
                  description:
                    "Break down complex concepts into easy-to-understand language",
                  type: "RAG",
                  visibility: "public",
                  created_at: "",
                },
                {
                  id: "5",
                  name: "Create practice questions",
                  description: "Generate quiz questions to test understanding",
                  type: "RAG",
                  visibility: "public",
                  created_at: "",
                },
                {
                  id: "6",
                  name: "Compare and contrast topics",
                  description:
                    "Analyze similarities and differences between related concepts",
                  type: "RAG",
                  visibility: "public",
                  created_at: "",
                },
              ]
        );
      } catch (error) {
        console.error("Error fetching prompt templates:", error);
        // Fallback to default prompts
        setPrompts([
          {
            id: "1",
            name: "Summarize a Chapter",
            description: "Provide a concise summary of a specific chapter",
            type: "RAG",
            visibility: "public",
            created_at: "",
          },
          {
            id: "2",
            name: "Define and explain a term",
            description:
              "Give a clear definition and explanation of a concept or term",
            type: "RAG",
            visibility: "public",
            created_at: "",
          },
          {
            id: "3",
            name: "Generate an example problem",
            description: "Create a practice problem with step-by-step solution",
            type: "RAG",
            visibility: "public",
            created_at: "",
          },
          {
            id: "4",
            name: "Explain a concept in simple terms",
            description:
              "Break down complex concepts into easy-to-understand language",
            type: "RAG",
            visibility: "public",
            created_at: "",
          },
          {
            id: "5",
            name: "Create practice questions",
            description: "Generate quiz questions to test understanding",
            type: "RAG",
            visibility: "public",
            created_at: "",
          },
          {
            id: "6",
            name: "Compare and contrast topics",
            description:
              "Analyze similarities and differences between related concepts",
            type: "RAG",
            visibility: "public",
            created_at: "",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  async function sendMessage() {
    const text = message.trim();
    if (!text || !chatSessionId) return;

    const userMsg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sender: "user",
      text,
      time: Date.now(),
    };

    // append user message
    setMessages((m) => [...m, userMsg]);
    setMessage("");

    try {
      // Get fresh token for the request
      const tokenResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      const { token } = await tokenResponse.json();

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/chat_sessions/${chatSessionId}/text_generation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            textbook_id: navTextbook.id,
            query: text,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate response");
      }

      const data = await response.json();

      const botMsg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sender: "bot",
        text: data.response || "Sorry, I couldn't generate a response.",
        sources_used: data.sources || [],
        time: Date.now(),
      };
      setMessages((m) => [...m, botMsg]);
    } catch (error) {
      console.error("Error generating text:", error);
      const errorMsg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sender: "bot",
        text: "Sorry, there was an error processing your request.",
        time: Date.now(),
      };
      setMessages((m) => [...m, errorMsg]);
    }
  }

  function messageFormatter(message: Message) {
    if (message.sender === "user") {
      return <UserChatMessage key={message.id} text={message.text} />;
    } else {
      return (
        <AIChatMessage
          key={message.id}
          text={message.text}
          sources={message.sources_used}
        />
      );
    }
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <div className="pt-[70px] flex-1 flex">
          <StudentSideBar
            textbookTitle={textbookTitle}
            textbookAuthor={textbookAuthor}
          />

          <main
            className={`md:ml-64 flex flex-col flex-1 items-center justify-center max-w-screen`}
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
                      messages.map((m) => messageFormatter(m))
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
                </div>

                {/* Prompt Suggestions */}
                {(messages.length === 0 || seeMore) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    {loading ? (
                      <div className="col-span-full text-center py-4">
                        <p className="text-muted-foreground">
                          Loading prompts...
                        </p>
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
              onSelectPrompt={(msg) => {
                setMessage(msg);
              }}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
