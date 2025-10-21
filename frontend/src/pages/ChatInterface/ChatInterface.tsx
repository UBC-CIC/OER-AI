import { useState } from "react";
import { Send, ChevronDown, LibraryBig } from "lucide-react";
import PromptCard from "./PromptCard";
import AIChatMessage from "./AIChatMessage";
import UserChatMessage from "./UserChatMessage";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import PromptLibraryModal from "./PromptLibraryModal";
import Header from "@/components/Header";
import StudentSideBar from "../../components/ChatInterface/StudentSideBar";
import { SidebarProvider } from "../../components/ChatInterface/SidebarContext";
import { useLocation } from "react-router";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: number;
};

export default function AIChatPage() {
  const [message, setMessage] = useState("");
  const location = useLocation();

  const navTextbook = location.state?.textbook;
  const textbookTitle = navTextbook?.title ?? "Calculus: Volume 3";
  const textbookAuthor = navTextbook?.author
    ? navTextbook.author.join(", ")
    : "OpenStax";

  const prompts = [
    "Summarize a Chapter",
    "Define and explain a term",
    "Generate an example problem",
    "Explain a concept in simple terms",
    "Create practice questions",
    "Compare and contrast topics",
    "Provide real-world applications",
    "Break down a complex formula",
    "Suggest study strategies",
    "Quiz me on key concepts",
    "Create a study guide outline",
    "Explain with analogies",
  ];

  // chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [seeMore, setSeeMore] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  function sendMessage() {
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

    // fake bot reply after a short delay
    setTimeout(() => {
      const botMsg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        sender: "bot",
        text: `This is a placeholder reply to: "${text}"`,
        time: Date.now(),
      };
      setMessages((m) => [...m, botMsg]);
    }, 700);
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
                    {prompts
                      .slice(0, messages.length === 0 && !seeMore ? 3 : 12)
                      .map((prompt, index) => (
                        <PromptCard
                          key={index}
                          text={prompt}
                          onClick={() => {
                            setMessage(prompt);
                          }}
                        />
                      ))}
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
              prompts={prompts}
              onSelectPrompt={(p) => setMessage(p)}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
