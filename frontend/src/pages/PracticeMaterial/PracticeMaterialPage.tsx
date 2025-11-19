import { useState } from "react";
import { GenerateForm } from "@/components/PracticeMaterialPage/GenerateForm";
import { MCQQuiz } from "@/components/PracticeMaterialPage/MCQQuiz";
import { FlashcardSet } from "@/components/PracticeMaterialPage/FlashcardSet";
import { ShortAnswer } from "@/components/PracticeMaterialPage/ShortAnswer";
import type { PracticeMaterial } from "@/types/PracticeMaterial";
import { isMCQQuiz, isFlashcardSet, isShortAnswer } from "@/types/PracticeMaterial";
import { Card, CardDescription } from "@/components/ui/card";
import { useTextbookView } from "@/providers/textbookView";

export default function PracticeMaterialPage() {
  const [materials, setMaterials] = useState<PracticeMaterial[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { textbook } = useTextbookView();

  const handleGenerate = async (formData: any) => {
    console.log("handleGenerate called with:", formData);
    console.log("Material type being processed:", formData.materialType);
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

      // Build request body based on material type
      let requestBody: any = {
        topic: formData.topic,
        difficulty: formData.difficulty,
      };

      if (formData.materialType === "flashcards") {
        console.log("Building flashcard request body");
        requestBody.material_type = "flashcard";
        requestBody.num_cards = formData.numCards;
        requestBody.card_type = formData.cardType;
      } else if (formData.materialType === "shortAnswer") {
        console.log("Building short answer request body");
        requestBody.material_type = "short_answer";
        requestBody.num_questions = formData.numQuestions;
      } else {
        console.log("Building MCQ request body");
        requestBody.material_type = "mcq";
        requestBody.num_questions = formData.numQuestions;
        requestBody.num_options = formData.numOptions;
      }

      console.log("Final request body:", requestBody);

      const resp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbook.id}/practice_materials`,
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

      const data: PracticeMaterial = await resp.json();
      setMaterials((prev) => [...prev, data]);
    } catch (e) {
      const err = e as Error;
      console.error("Error generating practice material:", err);
      setErrorMsg(err.message || "Unknown error generating practice materials");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteMaterial = (index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
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
          <h2 className="text-2xl font-semibold">Practice Materials</h2>
          {materials.length === 0 ? (
            <Card>
              <CardDescription className="flex flex-col justify-center items-center p-6">
                <p className="text-center text-muted-foreground">No practice materials have been generated for this session</p>
                <p className="text-destructive text-center mt-2">Reminder: All Sessions are temporary and will not persist after exiting</p>
              </CardDescription>
            </Card>
          ) : (
            materials.map((material, index) => {
              if (isMCQQuiz(material)) {
                return (
                  <MCQQuiz
                    key={index}
                    title={material.title}
                    questions={material.questions}
                    onDelete={() => handleDeleteMaterial(index)}
                  />
                );
              } else if (isFlashcardSet(material)) {
                return (
                  <FlashcardSet
                    key={index}
                    title={material.title}
                    cards={material.cards}
                    onDelete={() => handleDeleteMaterial(index)}
                  />
                );
              } else if (isShortAnswer(material)) {
                return (
                  <ShortAnswer
                    key={index}
                    title={material.title}
                    questions={material.questions}
                    onDelete={() => handleDeleteMaterial(index)}
                  />
                );
              }
              return null;
            })
          )}
        </div>
      </div>
    </div>
  );
}
