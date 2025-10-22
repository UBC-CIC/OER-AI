import { useState } from "react";
import { ChevronDown, LibraryBig } from "lucide-react";
import PromptCard from "@/components/ChatInterface/PromptCard";
import AIChatMessage from "@/components/ChatInterface/AIChatMessage";
import UserChatMessage from "@/components/ChatInterface/UserChatMessage";
import { Button } from "@/components/ui/button";
import PromptLibraryModal from "@/components/ChatInterface/PromptLibraryModal";
import Header from "@/components/Header";
import StudentSideBar from "@/components/ChatInterface/StudentSideBar";
import { SidebarProvider } from "@/components/ChatInterface/SidebarContext";
import { useLocation } from "react-router";
import { AiChatInput } from "@/components/ChatInterface/userInput";

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
    {
      id: 1,
      name: "Summarize a Chapter",
      description:
        "Act as an expert academic assistant. Your task is to provide a concise and comprehensive summary of a single chapter.\n\n1. Identify the three primary learning objectives or core arguments of [CHAPTER_TITLE] from the [TEXTBOOK_NAME] text.\n\n2. Synthesize the main content into a maximum of [NUMBER] paragraphs.\n\n3. Ensure the summary is tailored for a student at the [GRADE_LEVEL_OR_COURSE] level.\n\n4. Conclude the summary with a list of three critical vocabulary terms from the chapter.",
    },
    {
      id: 2,
      name: "Define and explain a term",
      description:
        "Provide a detailed and authoritative explanation of a key concept.\n\n1. Start with a formal, single-sentence definition of the term [TERM_TO_DEFINE].\n\n2. Provide a clear breakdown of its [NUMBER] essential components or characteristics.\n\n3. Describe the historical context or origin of the term in [ONE_SENTENCE].\n\n4. Explain the significance of [TERM_TO_DEFINE] within the broader field of [ACADEMIC_FIELD].",
    },
    {
      id: 3,
      name: "Generate an example problem",
      description:
        "Generate a realistic and challenging problem that requires understanding of a specific concept.\n\n1. Create a word problem or scenario based on [CONCEPT_OR_FORMULA].\n\n2. Set the problem difficulty to [DIFFICULTY_LEVEL: e.g., Beginner, Intermediate, Advanced].\n\n3. The problem should be applicable to [REAL_WORLD_CONTEXT: e.g., finance, physics, engineering].\n\n4. Provide a clear question at the end that asks the user to calculate [FINAL_ANSWER_UNIT: e.g., velocity, net profit, historical date].\n\n5. Include the [TYPE_OF_DATA_REQUIRED: e.g., constants, initial conditions, dates] needed to solve it.",
    },
    {
      id: 4,
      name: "Explain a concept in simple terms",
      description:
        "Your goal is to simplify a complex idea for easy understanding.\n\n1. Take the concept [COMPLEX_CONCEPT] and explain it using language appropriate for a [CHILD_AGE_OR_GRADE] audience.\n\n2. Use a single, relatable [TYPE_OF_ANALOGY: e.g., sports, cooking, building blocks] to illustrate the main mechanism.\n\n3. Avoid using any specialized jargon. If a key term must be mentioned, it should be defined immediately.\n\n4. The final explanation should not exceed [WORD_COUNT_MAX] words.",
    },
    {
      id: 5,
      name: "Create practice questions",
      description:
        "Generate a targeted set of mixed-format questions for self-assessment.\n\n1. Generate a total of [NUMBER] questions covering the topic [SUBJECT_TOPIC].\n\n2. The set should include a mix of [NUMBER_MCQ] multiple-choice questions, [NUMBER_T/F] true/false questions, and [NUMBER_SHORT_ANSWER] short-answer questions.\n\n3. Focus primarily on the material presented in [SPECIFIC_SECTION_OR_SOURCE].\n\n4. Provide the correct answer immediately after each question, clearly marked as [ANSWER_LABEL: e.g., Answer, Solution, Key].",
    },
    {
      id: 6,
      name: "Compare and contrast topics",
      description:
        "Draft a comprehensive comparative analysis of two related subjects.\n\n1. Identify the three most significant similarities between [TOPIC_A] and [TOPIC_B].\n\n2. Identify the three most fundamental differences between [TOPIC_A] and [TOPIC_B].\n\n3. Analyze the [RELATIONSHIP_TYPE: e.g., competitive, sequential, dependent] between the two topics.\n\n4. Present the analysis structured into two clear paragraphs, focusing on the context of [ACADEMIC_COURSE_NAME].",
    },
    {
      id: 7,
      name: "Provide real-world applications",
      description:
        "Find specific, practical examples where a theory is used outside of the classroom.\n\n1. List three distinct real-world applications of the principle or theory [THEORY_OR_PRINCIPLE].\n\n2. For each application, provide a detailed description of how the principle is implemented in [INDUSTRY_OR_FIELD].\n\n3. Each description should be a minimum of [SENTENCE_MINIMUM] sentences.\n\n4. The applications should be geared toward a [STUDENT_AUDIENCE_LEVEL] audience.",
    },
    {
      id: 8,
      name: "Break down a complex formula",
      description:
        "Provide a step-by-step deconstruction of a mathematical or scientific equation.\n\n1. Identify the formula: [FORMULA_TO_BREAK_DOWN].\n\n2. For each variable or constant in the formula, provide a simple explanation of its meaning and its [UNIT_OF_MEASUREMENT].\n\n3. Explain, step-by-step, the [NUMBER] steps required to use the formula to solve for the [TARGET_VARIABLE].\n\n4. Explain the overall purpose or meaning of the formula in [SIMPLE_TERMS].",
    },
    {
      id: 9,
      name: "Suggest study strategies",
      description:
        "Generate personalized and effective strategies for mastering a challenging subject.\n\n1. Suggest [NUMBER] specific study techniques tailored for improving comprehension of [CHALLENGING_SUBJECT].\n\n2. One strategy must involve [ACTIVE_LEARNING_METHOD: e.g., teaching someone, flashcards, problem-solving].\n\n3. Another strategy must focus on [TIME_MANAGEMENT_METHOD: e.g., Pomodoro, spaced repetition].\n\\n4. Explain the rationale behind each strategy in a maximum of [SENTENCE_MAX] sentences.",
    },
    {
      id: 10,
      name: "Quiz me on key concepts",
      description:
        "Generate a short, interactive quiz to test my knowledge immediately.\n\n1. Create a quiz of [NUMBER] questions focused strictly on [NARROW_TOPIC_FOCUS].\n\n2. The quiz format must be [QUIZ_FORMAT: e.g., Multiple Choice, Fill-in-the-Blank, Short Answer].\n\n3. I will provide my answer after each question. Your response should contain only the next question until I say [COMMAND_TO_END_QUIZ: e.g., 'End Quiz' or 'Stop'].\n\n4. The first question is: [FIRST_QUESTION_TEXT]",
    },
    {
      id: 11,
      name: "Create a study guide outline",
      description:
        "Generate a structured, hierarchical outline for a comprehensive study guide.\n\n1. Create a detailed outline for a study guide covering the [BROAD_COURSE_OR_UNIT].\n\n2. The outline must contain at least [NUMBER] main sections and a total of [NUMBER_OF_SUBPOINTS] sub-points across all sections.\n\n3. The structure should prioritize the most crucial concepts, specifically [MOST_CRITICAL_CONCEPT].\n\n4. The outline must use standard hierarchical notation (e.g., I., A., 1., a.).",
    },
    {
      id: 12,
      name: "Explain with analogies",
      description:
        "Provide a series of different conceptual metaphors for a single abstract idea.\n\n1. Generate [NUMBER] distinct, creative analogies to explain the abstract concept of [ABSTRACT_CONCEPT].\n\n2. Ensure each analogy is drawn from a different domain (e.g., one from nature, one from technology, one from social life).\n\n3. For each analogy, explain why the comparison holds true in a single sentence, focusing on the property [KEY_PROPERTY_OF_CONCEPT].",
    },
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
                  <div className="flex flex-col gap-2 mb-6">
                    {messages.map((m) => messageFormatter(m))}
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
                    {prompts
                      .slice(0, messages.length === 0 && !seeMore ? 3 : 12)
                      .map((prompt) => (
                        <PromptCard
                          key={prompt.id}
                          name={prompt.name}
                          onClick={() => {
                            setMessage(prompt.description);
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
              onSelectPrompt={(p) => setMessage(p)}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
