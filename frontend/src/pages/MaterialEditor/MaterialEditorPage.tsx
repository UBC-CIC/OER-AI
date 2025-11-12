import { useState } from "react";
import { MCQEditableContainer } from "@/components/MaterialEditorPage/MCQEditableContainer";
import type { IH5PMinimalQuestionSet } from "@/types/MaterialEditor";
import { Card, CardDescription } from "@/components/ui/card";
import { MaterialEditorForm } from "@/components/MaterialEditorPage/MaterialEditorForm";

// Dummy H5P question set data
const dummyQuestionSet: IH5PMinimalQuestionSet = {
  questions: [
    {
      library: "H5P.MultiChoice 1.17",
      params: {
        question: "What is the derivative of x²?",
        answers: [
          {
            text: "A. x",
            correct: false,
            tipsAndFeedback: {
              tip: "Remember the power rule: bring down the exponent and subtract 1",
              chosenFeedback: "Not quite. The power rule states that d/dx(xⁿ) = n·x^(n-1)",
              notChosenFeedback: "",
            },
          },
          {
            text: "B. 2x",
            correct: true,
            tipsAndFeedback: {
              tip: "Use the power rule",
              chosenFeedback: "Correct! Using the power rule: d/dx(x²) = 2·x^(2-1) = 2x",
              notChosenFeedback: "This is the correct answer - review the power rule",
            },
          },
          {
            text: "C. x²",
            correct: false,
            tipsAndFeedback: {
              tip: "The derivative changes the function",
              chosenFeedback: "Incorrect. This is the original function, not its derivative",
              notChosenFeedback: "",
            },
          },
          {
            text: "D. 2",
            correct: false,
            tipsAndFeedback: {
              tip: "Don't forget the variable x",
              chosenFeedback: "Not correct. The derivative should still contain the variable x",
              notChosenFeedback: "",
            },
          },
        ],
      },
    },
    {
      library: "H5P.MultiChoice 1.17",
      params: {
        question: "What is the integral of 2x?",
        answers: [
          {
            text: "A. x² + C",
            correct: true,
            tipsAndFeedback: {
              tip: "Integration is the reverse of differentiation",
              chosenFeedback: "Correct! The integral of 2x is x² + C",
              notChosenFeedback: "This is the correct answer",
            },
          },
          {
            text: "B. 2x² + C",
            correct: false,
            tipsAndFeedback: {
              tip: "Check your calculation",
              chosenFeedback: "Incorrect. This would be the integral of 4x",
              notChosenFeedback: "",
            },
          },
          {
            text: "C. x + C",
            correct: false,
            tipsAndFeedback: {
              tip: "Remember to account for the coefficient",
              chosenFeedback: "Not quite. You need to consider the coefficient 2",
              notChosenFeedback: "",
            },
          },
        ],
      },
    },
  ],
};

export default function MaterialEditorPage() {
  const [questionSets, setQuestionSets] = useState<IH5PMinimalQuestionSet[]>([dummyQuestionSet]);


  const handleQuizDelete = (index: number) => {
    const newQuestionSets = questionSets.filter((_, i) => i !== index);
    setQuestionSets(newQuestionSets);
  }

  const handleGenerate = (formData: unknown) => {
    console.log("Generate form data:", formData);
    // TODO: Call API to generate new question set

    setQuestionSets((prev) => [...prev, dummyQuestionSet]);
  };

  const handleExportToH5P = (questionSet: IH5PMinimalQuestionSet) => {
    console.log("Exporting question set:", questionSet);
    // TODO: call api to export question as h5p
  };

  return (
    <div className="w-full max-w-[1800px] px-4 py-4">
      <div className="min-h-screen flex flex-col md:flex-row md:items-start md:justify-center gap-6">
        <div className="w-full md:w-[30%]">
          <MaterialEditorForm onGenerate={handleGenerate} />
        </div>

        <div className="w-full md:w-[70%] space-y-6">
          <h2 className="text-2xl font-semibold">Practice Questions</h2>
          {questionSets.length === 0 ? (
            <Card>
              <CardDescription className="flex flex-col justify-center items-center p-6">
                <p className="text-center text-muted-foreground">No practice materials have been generated for this session</p>
                <p className="text-destructive text-center mt-2">Reminder: All Sessions are temporary and will not persist after exiting</p>
              </CardDescription>
            </Card>
          ) : (
            questionSets.map((questionSet, index) => (
              <MCQEditableContainer
                key={index}
                initialQuestionSet={questionSet}
                exportToH5P={handleExportToH5P}
                onDelete={() => {handleQuizDelete(index)}}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
