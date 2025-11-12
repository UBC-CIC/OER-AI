import { useState } from "react";
import { GenerateForm } from "@/components/PracticeMaterialPage/GenerateForm";
import { MCQQuiz } from "@/components/PracticeMaterialPage/MCQQuiz";
import type { MCQQuizData } from "@/types/PracticeMaterial";
import { Card, CardDescription } from "@/components/ui/card";
import { useTextbookView } from "@/providers/textbookView";

export default function PracticeMaterialPage() {
  const [quizzes, setQuizzes] = useState<MCQQuizData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { textbook } = useTextbookView();

  const handleGenerate = async (formData: any) => {
    setErrorMsg(null);
    if (!textbook?.id) {
      setErrorMsg("Please select a textbook before generating practice materials.");
      return;
    }
    try {
      setIsGenerating(true);
      // Acquire public token
      const tokenResp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
      if (!tokenResp.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResp.json();

      const resp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbook.id}/practice_materials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            topic: formData.topic,
            material_type: formData.materialType ?? "mcq",
            num_questions: formData.numQuestions,
            num_options: formData.numOptions,
            difficulty: formData.difficulty,
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Failed to generate practice materials");
      }

      const data: MCQQuizData = await resp.json();
      setQuizzes((prev) => [...prev, data]);
    } catch (e) {
      const err = e as Error;
      console.error("Error generating practice material:", err);
      setErrorMsg(err.message || "Unknown error generating practice materials");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteQuiz = (index: number) => {
    setQuizzes((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-[1800px] px-4 py-4">
      <div className="min-h-screen flex flex-col md:flex-row md:items-start md:justify-center gap-6">
        <div className="w-full md:w-[30%]">
          <GenerateForm onGenerate={handleGenerate} />
          {isGenerating && (
            <p className="text-sm text-muted-foreground mt-2">Generating practice materials...</p>
          )}
          {errorMsg && (
            <p className="text-sm text-destructive mt-2">{errorMsg}</p>
          )}
        </div>

        <div className="w-full md:w-[70%] space-y-6">
          <h2 className="text-2xl font-semibold">Practice Questions</h2>
          {quizzes.length === 0 ? (
            <Card>
              <CardDescription className="flex flex-col justify-center items-center">
                <p className="text-center text-muted-foreground">No practice materials have been generated for this session</p>
                <p className="text-destructive text-center">Reminder: All Sessions are temporary and will not persist after exiting</p>
              </CardDescription>
            </Card>
          ) : (
            quizzes.map((quiz, index) => (
              <MCQQuiz
                key={index}
                title={quiz.title}
                questions={quiz.questions}
                onDelete={() => handleDeleteQuiz(index)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
