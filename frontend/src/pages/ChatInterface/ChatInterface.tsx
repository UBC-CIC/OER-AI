import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CornerUpRight, Send, ChevronDown, LibraryBig } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import StudentSideBar from "./StudentSideBar";
import { useLocation } from "react-router";

export default function AIChatPage() {
  const [message, setMessage] = useState("");
  const location = useLocation();

  // try to get textbook data from navigation state
  const navTextbook = location.state?.textbook;

  // fallback textbook data (if user navigates directly)
  const textbookTitle = navTextbook?.title ?? "Calculus: Volume 3";
  const textbookAuthor = navTextbook?.author
    ? navTextbook.author.join(", ")
    : "OpenStax";

  const prompts = [
    "Summarize a Chapter",
    "Define and explain a term",
    "Generate an example problem",
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <StudentSideBar
          textbookTitle={textbookTitle}
          textbookAuthor={textbookAuthor}
        />

        <main className="md:ml-64 flex flex-1 overflow-y-auto p-8 justify-center items-center">
          <div className="w-full max-w-2xl px-4">
            {/* Hero title */}
            <h1 className="text-4xl font-bold text-center mb-12 leading-tight max-w-full break-words">
              What can I help with?
            </h1>

            {/* Input Area */}
            <div className="relative mb-6">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Ask anything about ${textbookTitle}`}
                className="bg-input !border-[var(--border)] h-[120px] pr-12 resize-none text-sm"
              />
              <Button
                size="icon"
                variant="link"
                className="cursor-pointer absolute bottom-3 right-3 h-8 w-8 text-muted-foreground hover:text-gray-900 transition-colors"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Prompt Suggestions */}
            <div className="flex gap-3 mb-6">
              {prompts.map((prompt, index) => (
                <Card
                  key={index}
                  className="flex-1 p-[10px] cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="relative h-full flex flex-col items-start">
                    <p className="text-md text-muted-foreground mb-auto">
                      {prompt}
                    </p>
                    <CornerUpRight className="absolute bottom-0 right-0 h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              ))}
            </div>

            {/* Prompt Options*/}
            <div className="w-full flex gap-4 justify-end items-center">
              <Button
                variant={"link"}
                className="cursor-pointer gap-2 text-sm font-normal text-muted-foreground hover:text-gray-900 transition-colors"
              >
                Prompt Library
                <LibraryBig className="h-4 w-4" />
              </Button>
              <Button
                variant={"link"}
                className="cursor-pointer gap-2 text-sm font-normal text-muted-foreground hover:text-gray-900 transition-colors"
              >
                See more prompts
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
