import { useState } from "react";
import { GenerateForm } from "@/components/PracticeMaterialPage/GenerateForm";
import { MCQQuiz } from "@/components/PracticeMaterialPage/MCQQuiz";
import { FlashcardSet } from "@/components/PracticeMaterialPage/FlashcardSet";
import type { PracticeMaterial } from "@/types/PracticeMaterial";
import { isMCQQuiz, isFlashcardSet } from "@/types/PracticeMaterial";
import { Card, CardDescription } from "@/components/ui/card";
import { useTextbookView } from "@/providers/textbookView";

// Mock flashcard data - kept for reference
// const mockFlashcardSet: FlashcardSetData = {
//   title: "Calculus Fundamentals Practice",
//   cards: [
//     {
//       id: "1",
//       front: "What is the derivative of x²?",
//       back: "2x (using the power rule: d/dx(xⁿ) = n·xⁿ⁻¹)",
//       hint: "Remember the power rule"
//     },
//     {
//       id: "2",
//       front: "What does ∫ represent?",
//       back: "The integral symbol, representing the area under a curve or antiderivative",
//     },
//     {
//       id: "3",
//       front: "Define 'limit' in calculus",
//       back: "The value that a function approaches as the input approaches a specific point",
//       hint: "Think about approaching a value, not reaching it"
//     },
//     {
//       id: "4",
//       front: "What is the derivative of sin(x)?",
//       back: "cos(x)",
//     },
//     {
//       id: "5",
//       front: "What is the derivative of cos(x)?",
//       back: "-sin(x)",
//     },
//     {
//       id: "6",
//       front: "What is the chain rule?",
//       back: "d/dx[f(g(x))] = f'(g(x)) · g'(x)",
//       hint: "Derivative of outer function times derivative of inner function"
//     },
//     {
//       id: "7",
//       front: "What is the product rule?",
//       back: "d/dx[f(x)·g(x)] = f'(x)·g(x) + f(x)·g'(x)",
//     },
//     {
//       id: "8",
//       front: "What is the quotient rule?",
//       back: "d/dx[f(x)/g(x)] = [f'(x)·g(x) - f(x)·g'(x)] / [g(x)]²",
//       hint: "Low d-high minus high d-low, all over low squared"
//     },
//     {
//       id: "9",
//       front: "What is ∫ 1/x dx?",
//       back: "ln|x| + C",
//     },
//     {
//       id: "10",
//       front: "What is the fundamental theorem of calculus?",
//       back: "Integration and differentiation are inverse operations",
//       hint: "They undo each other"
//     }
//   ],
//   metadata: {
//     difficulty: "intermediate",
//     cardType: "question-answer",
//     topic: "calculus"
//   }
// };

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
              }
              return null;
            })
          )}
        </div>
      </div>
    </div>
  );
}
