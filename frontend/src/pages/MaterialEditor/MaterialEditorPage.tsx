import { useState } from "react";
import { MCQEditableContainer } from "@/components/MaterialEditorPage/MCQEditableContainer";
import { EssayEditableContainer } from "@/components/MaterialEditorPage/EssayEditableContainer";
import { FlashcardEditableContainer } from "@/components/MaterialEditorPage/FlashcardEditableContainer";
import type {
  I5HPMultiChoiceQuestion,
  I5HPEssayQuestion,
  IH5PFlashcard,
  IH5PQuestion,
} from "@/types/MaterialEditor";
import {
  isMultiChoiceQuestion,
  isEssayQuestion,
  isFlashcard,
} from "@/types/MaterialEditor";
import { Card, CardDescription } from "@/components/ui/card";
import { MaterialEditorForm } from "@/components/MaterialEditorPage/MaterialEditorForm";
import { useTextbookView } from "@/providers/textbookView";

export default function MaterialEditorPage() {
  const [mcqQuestionSets, setMcqQuestionSets] = useState<
    I5HPMultiChoiceQuestion[][]
  >([]);
  const [essayQuestionSets, setEssayQuestionSets] = useState<
    I5HPEssayQuestion[][]
  >([]);
  const [flashcardSets, setFlashcardSets] = useState<IH5PFlashcard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { textbook } = useTextbookView();

  const handleQuizDelete = (index: number) => {
    const newQuestionSets = mcqQuestionSets.filter((_, i) => i !== index);
    setMcqQuestionSets(newQuestionSets);
  };

  const handleEssayDelete = (index: number) => {
    const newQuestionSets = essayQuestionSets.filter((_, i) => i !== index);
    setEssayQuestionSets(newQuestionSets);
  };

  const handleFlashcardDelete = (index: number) => {
    const newFlashcardSets = flashcardSets.filter((_, i) => i !== index);
    setFlashcardSets(newFlashcardSets);
  };

  const handleGenerate = async (formData: any) => {
    console.log("Generate form data:", formData);
    setErrorMsg(null);

    if (!textbook?.id) {
      setErrorMsg(
        "Please select a textbook before generating practice materials."
      );
      return;
    }

    try {
      setIsGenerating(true);

      // Get public token
      const tokenResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (!tokenResp.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResp.json();

      // Build request body based on material type
      let requestBody: any = {
        topic: formData.topic,
        difficulty: formData.difficulty,
      };

      if (formData.materialType === "flashcards") {
        requestBody.material_type = "flashcard";
        requestBody.num_cards = formData.numCards;
        requestBody.card_type = formData.cardType;
      } else if (formData.materialType === "shortAnswer") {
        requestBody.material_type = "short_answer";
        requestBody.num_questions = formData.numQuestions;
      } else {
        requestBody.material_type = "mcq";
        requestBody.num_questions = formData.numQuestions;
        requestBody.num_options = formData.numOptions;
      }

      // Call practice materials API
      const resp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${
          textbook.id
        }/practice_materials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to generate practice materials");
      }

      const data = await resp.json();

      // Convert based on material type
      if (formData.materialType === "flashcards" && data.cards) {
        // Convert flashcards to H5P format
        const h5pFlashcard: IH5PFlashcard = {
          library: "H5P.Flashcards 1.5",
          params: {
            cards: data.cards.map((card: any) => ({
              text: card.front || card.text || "",
              answer: card.back || card.answer || "",
              tip: card.tip || "",
            })),
            description: formData.topic || "Flashcard Set",
          },
        };

        setFlashcardSets((prev) => [h5pFlashcard, ...prev]);
      } else if (formData.materialType === "shortAnswer" && data.questions) {
        // Convert short answer to H5P Essay format
        const h5pQuestions: I5HPEssayQuestion[] = data.questions.map(
          (q: any) => ({
            library: "H5P.Essay 1.5",
            params: {
              taskDescription:
                q.questionText + (q.context ? `\n\nContext: ${q.context}` : ""),
              keywords: (q.keyPoints || []).map((kp: string) => ({
                keyword: kp,
                alternatives: [],
                options: {
                  points: 1,
                  occurrences: 1,
                  caseSensitive: false,
                  forgiveMistakes: true,
                  feedbackIncluded: `Good! You mentioned: ${kp}`,
                  feedbackMissed: `Consider including: ${kp}`,
                  feedbackIncludedWord: "keyword" as const,
                  feedbackMissedWord: "keyword" as const,
                },
              })),
            },
          })
        );

        setEssayQuestionSets((prev) => [h5pQuestions, ...prev]);
      } else if (data.questions) {
        // Convert MCQ to H5P format
        const h5pQuestions: I5HPMultiChoiceQuestion[] = data.questions.map(
          (q: any) => ({
            library: "H5P.MultiChoice 1.17",
            params: {
              question: q.questionText,
              answers: q.options.map((opt: any) => ({
                text: opt.text,
                correct: opt.id === q.correctAnswer,
                tipsAndFeedback: {
                  tip: "",
                  chosenFeedback: opt.explanation || "",
                  notChosenFeedback: "",
                },
              })),
            },
          })
        );

        setMcqQuestionSets((prev) => [h5pQuestions, ...prev]);
      }
    } catch (e) {
      const err = e as Error;
      console.error("Error generating practice material:", err);
      setErrorMsg(err.message || "Unknown error generating practice materials");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportToH5P = (questions: IH5PQuestion[]) => {
    // Determine question type and handle accordingly
    if (questions.length === 0) {
      console.warn("No questions to export");
      return;
    }

    const firstQuestion = questions[0];
    if (isMultiChoiceQuestion(firstQuestion)) {
      console.log("Exporting MCQ questions:", questions);
      // TODO: call api to export MCQ questions as h5p
    } else if (isEssayQuestion(firstQuestion)) {
      console.log("Exporting Essay questions:", questions);
      // TODO: call api to export Essay questions as h5p
    } else if (isFlashcard(firstQuestion)) {
      console.log("Exporting Flashcard questions:", questions);
      // TODO: call api to export Flashcard questions as h5p
    } else {
      console.error(
        "Unknown question type:",
        (firstQuestion as IH5PQuestion).library
      );
    }
  };

  return (
    <div className="w-full max-w-[1800px] px-4 py-4">
      <div className="min-h-screen flex flex-col md:flex-row md:items-start md:justify-center gap-6">
        <div className="w-full md:w-[30%]">
          <MaterialEditorForm onGenerate={handleGenerate} />
          {isGenerating && (
            <p className="text-sm text-muted-foreground mt-2">
              Generating practice materials...
            </p>
          )}
          {errorMsg && (
            <p className="text-sm text-destructive mt-2">{errorMsg}</p>
          )}
        </div>

        <div className="w-full md:w-[70%] space-y-6">
          <h2 className="text-2xl font-semibold">Practice Questions</h2>
          {mcqQuestionSets.length === 0 &&
          essayQuestionSets.length === 0 &&
          flashcardSets.length === 0 ? (
            <Card>
              <CardDescription className="flex flex-col justify-center items-center p-6">
                <p className="text-center text-muted-foreground">
                  No practice materials have been generated for this session
                </p>
                <p className="text-destructive text-center mt-2">
                  Reminder: All Sessions are temporary and will not persist
                  after exiting
                </p>
              </CardDescription>
            </Card>
          ) : (
            <>
              {mcqQuestionSets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">
                    Multiple Choice Questions
                  </h3>
                  {mcqQuestionSets.map((questions, index) => (
                    <MCQEditableContainer
                      key={`mcq-${index}`}
                      initialQuestions={questions}
                      exportToH5P={handleExportToH5P}
                      onDelete={() => {
                        handleQuizDelete(index);
                      }}
                      textbookId={textbook?.id}
                    />
                  ))}
                </div>
              )}

              {essayQuestionSets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Essay Questions</h3>
                  {essayQuestionSets.map((questions, index) => (
                    <EssayEditableContainer
                      key={`essay-${index}`}
                      initialQuestions={questions}
                      exportToH5P={handleExportToH5P}
                      onDelete={() => {
                        handleEssayDelete(index);
                      }}
                      textbookId={textbook?.id}
                    />
                  ))}
                </div>
              )}

              {flashcardSets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Flashcards</h3>
                  {flashcardSets.map((flashcard, index) => (
                    <FlashcardEditableContainer
                      key={`flashcard-${index}`}
                      initialFlashcards={flashcard}
                      exportToH5P={handleExportToH5P}
                      onDelete={() => {
                        handleFlashcardDelete(index);
                      }}
                      textbookId={textbook?.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
