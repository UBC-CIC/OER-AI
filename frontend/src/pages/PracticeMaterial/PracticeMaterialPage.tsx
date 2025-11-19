import { useState } from "react";
import { GenerateForm } from "@/components/PracticeMaterialPage/GenerateForm";
import { MCQQuiz } from "@/components/PracticeMaterialPage/MCQQuiz";
import { FlashcardSet } from "@/components/PracticeMaterialPage/FlashcardSet";
import { ShortAnswer } from "@/components/PracticeMaterialPage/ShortAnswer";
import type { PracticeMaterial, ShortAnswerData } from "@/types/PracticeMaterial";
import { isMCQQuiz, isFlashcardSet, isShortAnswer } from "@/types/PracticeMaterial";
import { Card, CardDescription } from "@/components/ui/card";
import { useTextbookView } from "@/providers/textbookView";

// Mock short answer data
const mockShortAnswer: ShortAnswerData = {
  title: "Critical Thinking: Biology Concepts",
  questions: [
    {
      id: "1",
      questionText: "Explain the process of photosynthesis and its importance to life on Earth.",
      context: "Consider both the chemical process and the broader ecological implications.",
      sampleAnswer: "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. During this process, plants take in carbon dioxide from the air and water from the soil, using sunlight to convert these into glucose and oxygen. The oxygen is released as a byproduct. This process is crucial because it provides the foundation for most food chains on Earth and produces the oxygen that most organisms need to survive.",
      keyPoints: [
        "Conversion of light energy to chemical energy",
        "Inputs: CO₂, water, sunlight",
        "Outputs: glucose, oxygen",
        "Foundation of food chains",
        "Oxygen production for atmosphere"
      ],
      rubric: "A complete answer should mention the inputs and outputs of photosynthesis, explain the energy conversion, and discuss its ecological significance.",
      expectedLength: 100
    },
    {
      id: "2",
      questionText: "Compare and contrast mitosis and meiosis.",
      sampleAnswer: "Both mitosis and meiosis are processes of cell division, but they serve different purposes. Mitosis produces two identical daughter cells with the same number of chromosomes as the parent cell, and is used for growth and repair. Meiosis, on the other hand, produces four non-identical daughter cells with half the number of chromosomes, and is used for sexual reproduction. Mitosis involves one division cycle, while meiosis involves two. The genetic variation in meiosis comes from crossing over and independent assortment.",
      keyPoints: [
        "Mitosis: 2 identical cells, same chromosome number",
        "Meiosis: 4 non-identical cells, half chromosome number",
        "Mitosis: growth and repair",
        "Meiosis: sexual reproduction",
        "Meiosis creates genetic variation"
      ],
      rubric: "Answer should identify key similarities and differences, including purpose, number of divisions, and resulting cells.",
      expectedLength: 120
    },
    {
      id: "3",
      questionText: "What is natural selection and how does it drive evolution?",
      sampleAnswer: "Natural selection is the process by which organisms with traits better suited to their environment are more likely to survive and reproduce. Over time, these advantageous traits become more common in the population. This occurs because individuals with beneficial traits have higher fitness, meaning they produce more offspring that inherit these traits. Through many generations, this process leads to evolutionary change as populations become better adapted to their environments. Natural selection operates on variation within populations and requires heritable traits that affect survival or reproduction.",
      keyPoints: [
        "Differential survival and reproduction",
        "Advantageous traits increase in frequency",
        "Requires heritable variation",
        "Leads to adaptation over time",
        "Mechanism of evolutionary change"
      ],
      expectedLength: 100
    }
  ]
};

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

  const handleLoadMockShortAnswer = () => {
    setMaterials((prev) => [...prev, mockShortAnswer]);
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
          <div className="mt-4">
            <button
              onClick={handleLoadMockShortAnswer}
              className="w-full px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
              Load Mock Short Answer (Demo)
            </button>
          </div>
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
