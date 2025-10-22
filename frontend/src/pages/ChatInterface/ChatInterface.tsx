import { useState, useEffect } from "react";
import { Send, ChevronDown, LibraryBig } from "lucide-react";
import PromptCard from "@/components/ChatInterface/PromptCard";
import AIChatMessage from "@/components/ChatInterface/AIChatMessage";
import UserChatMessage from "@/components/ChatInterface/UserChatMessage";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import PromptLibraryModal from "@/components/ChatInterface/PromptLibraryModal";
import Header from "@/components/Header";
import StudentSideBar from "@/components/ChatInterface/StudentSideBar";
import { SidebarProvider } from "@/components/ChatInterface/SidebarContext";
import { useLocation } from "react-router";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: number;
};

type PromptTemplate = {
  id: string;
  name: string;
  description?: string;
  type: string;
  visibility: string;
  created_at: string;
};

export default function AIChatPage() {
  const [message, setMessage] = useState("");
  const location = useLocation();

  const navTextbook = location.state?.textbook;
  const textbookTitle = navTextbook?.title ?? "Calculus: Volume 3";
  const textbookAuthor = navTextbook?.author
    ? navTextbook.author.join(", ")
    : "OpenStax";

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [seeMore, setSeeMore] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Fetch prompt templates from API
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/prompt_templates`);
        const data = await response.json();
        const templates = data.templates || [];
        setPrompts(templates.length > 0 ? templates : [
          { id: '1', name: "Summarize a Chapter", description: "Provide a concise summary of a specific chapter", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '2', name: "Define and explain a term", description: "Give a clear definition and explanation of a concept or term", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '3', name: "Generate an example problem", description: "Create a practice problem with step-by-step solution", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '4', name: "Explain a concept in simple terms", description: "Break down complex concepts into easy-to-understand language", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '5', name: "Create practice questions", description: "Generate quiz questions to test understanding", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '6', name: "Compare and contrast topics", description: "Analyze similarities and differences between related concepts", type: 'RAG', visibility: 'public', created_at: '' }
        ]);
      } catch (error) {
        console.error('Error fetching prompt templates:', error);
        // Fallback to default prompts
        setPrompts([
          { id: '1', name: "Summarize a Chapter", description: "Provide a concise summary of a specific chapter", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '2', name: "Define and explain a term", description: "Give a clear definition and explanation of a concept or term", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '3', name: "Generate an example problem", description: "Create a practice problem with step-by-step solution", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '4', name: "Explain a concept in simple terms", description: "Break down complex concepts into easy-to-understand language", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '5', name: "Create practice questions", description: "Generate quiz questions to test understanding", type: 'RAG', visibility: 'public', created_at: '' },
          { id: '6', name: "Compare and contrast topics", description: "Analyze similarities and differences between related concepts", type: 'RAG', visibility: 'public', created_at: '' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  async function sendMessage() {
    const text = message.trim();
    if (!text) return;

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
      // Generate a temporary chat session ID (in real app, this would come from session creation)
      const sessionId = "temp-session-id";
      const textbookId = navTextbook?.id || "temp-textbook-id";
      
      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/chat_sessions/${sessionId}/text_generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          textbook_id: textbookId,
          query: text
        })
      });

      const data = await response.json();
      
      const botMsg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sender: "bot",
        text: data.response || "Sorry, I couldn't generate a response.",
        time: Date.now(),
      };
      setMessages((m) => [...m, botMsg]);
    } catch (error) {
      console.error('Error generating text:', error);
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
      return <AIChatMessage key={message.id} text={message.text} />;
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
            className={`md:ml-64 flex flex-col flex-1 items-center justify-center`}
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
                  // messages area
                  <div className="flex flex-col gap-4 mb-6">
                    {messages.map((m) => messageFormatter(m))}
                  </div>
                )}
              </div>

              {/* thebottom section */}
              <div>
                {/* Input Area */}
                <div className="relative mb-6">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={`Ask anything about ${textbookTitle}`}
                    className="bg-input !border-[var(--border)] h-[120px] pr-12 resize-none text-sm"
                  />
                  <Button
                    onClick={sendMessage}
                    size="icon"
                    variant="link"
                    className="cursor-pointer absolute bottom-3 right-3 h-8 w-8 text-muted-foreground hover:text-gray-900 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
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
                            text={prompt.name}
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
                    className="cursor-pointer gap-2 text-sm font-normal text-muted-foreground hover:text-gray-900 transition-colors"
                  >
                    Prompt Library
                    <LibraryBig className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setSeeMore(!seeMore)}
                    variant={"link"}
                    className="cursor-pointer gap-2 text-sm font-normal text-muted-foreground hover:text-gray-900 transition-colors"
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
              prompts={prompts.map(p => p.name)}
              onSelectPrompt={(p) => {
                const template = prompts.find(t => t.name === p);
                setMessage(template?.description || p);
              }}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
