import { useState } from "react";
import { MCQEditableContainer } from "@/components/MaterialEditorPage/MCQEditableContainer";
import { EssayEditableContainer } from "@/components/MaterialEditorPage/EssayEditableContainer";
import type { I5HPMultiChoiceQuestion, I5HPEssayQuestion, IH5PQuestion } from "@/types/MaterialEditor";
import { isMultiChoiceQuestion, isEssayQuestion } from "@/types/MaterialEditor";
import { Card, CardDescription } from "@/components/ui/card";
import { MaterialEditorForm } from "@/components/MaterialEditorPage/MaterialEditorForm";
import { useTextbookView } from "@/providers/textbookView";

// Dummy H5P MCQ question data
const dummyMCQQuestions: I5HPMultiChoiceQuestion[] = [
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
];

// Dummy H5P Essay question data
const dummyEssayQuestions: I5HPEssayQuestion[] = [
  {
    library: "H5P.Essay 1.5",
    params: {
      taskDescription: "Explain the concept of photosynthesis and describe the main stages involved in the process.",
      keywords: [
        {
          keyword: "photosynthesis",
          alternatives: ["photo synthesis", "photosynthetic process"],
          options: {
            points: 2,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Good! You mentioned photosynthesis.",
            feedbackMissed: "Don't forget to define what photosynthesis is.",
            feedbackIncludedWord: "keyword",
            feedbackMissedWord: "keyword",
          },
        },
        {
          keyword: "light-dependent",
          alternatives: ["light dependent", "light reaction", "light reactions"],
          options: {
            points: 3,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Excellent! You identified the light-dependent reactions.",
            feedbackMissed: "Remember to mention the light-dependent stage.",
            feedbackIncludedWord: "keyword",
            feedbackMissedWord: "keyword",
          },
        },
        {
          keyword: "Calvin cycle",
          alternatives: ["calvin-cycle", "light-independent", "light independent", "dark reaction"],
          options: {
            points: 3,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Great! You mentioned the Calvin cycle.",
            feedbackMissed: "Don't forget the Calvin cycle (light-independent reactions).",
            feedbackIncludedWord: "alternative",
            feedbackMissedWord: "keyword",
          },
        },
        {
          keyword: "chloroplast",
          alternatives: ["chloroplasts"],
          options: {
            points: 2,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Good! You identified where photosynthesis occurs.",
            feedbackMissed: "Remember to mention where photosynthesis takes place.",
            feedbackIncludedWord: "keyword",
            feedbackMissedWord: "none",
          },
        },
      ],
    },
  },
  {
    library: "H5P.Essay 1.5",
    params: {
      taskDescription: "Describe Newton's First Law of Motion and provide a real-world example.",
      keywords: [
        {
          keyword: "inertia",
          alternatives: ["inertial"],
          options: {
            points: 3,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Excellent! You mentioned inertia.",
            feedbackMissed: "The concept of inertia is key to Newton's First Law.",
            feedbackIncludedWord: "keyword",
            feedbackMissedWord: "keyword",
          },
        },
        {
          keyword: "rest",
          alternatives: ["at rest", "stationary"],
          options: {
            points: 2,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Good! You mentioned objects at rest.",
            feedbackMissed: "Remember to discuss what happens to objects at rest.",
            feedbackIncludedWord: "alternative",
            feedbackMissedWord: "keyword",
          },
        },
        {
          keyword: "motion",
          alternatives: ["moving", "movement"],
          options: {
            points: 2,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Good! You discussed motion.",
            feedbackMissed: "Don't forget to explain what happens to objects in motion.",
            feedbackIncludedWord: "keyword",
            feedbackMissedWord: "keyword",
          },
        },
        {
          keyword: "force",
          alternatives: ["forces", "external force"],
          options: {
            points: 3,
            occurrences: 1,
            caseSensitive: false,
            forgiveMistakes: true,
            feedbackIncluded: "Excellent! You mentioned the role of force.",
            feedbackMissed: "Remember to discuss what changes an object's state of motion.",
            feedbackIncludedWord: "answer",
            feedbackMissedWord: "none",
          },
        },
      ],
    },
  },
];

export default function MaterialEditorPage() {
  const [mcqQuestionSets, setMcqQuestionSets] = useState<I5HPMultiChoiceQuestion[][]>([dummyMCQQuestions]);
  const [essayQuestionSets, setEssayQuestionSets] = useState<I5HPEssayQuestion[][]>([dummyEssayQuestions]);
 const { textbook } = useTextbookView();

  const handleQuizDelete = (index: number) => {
    const newQuestionSets = mcqQuestionSets.filter((_, i) => i !== index);
    setMcqQuestionSets(newQuestionSets);
  }

  const handleEssayDelete = (index: number) => {
    const newQuestionSets = essayQuestionSets.filter((_, i) => i !== index);
    setEssayQuestionSets(newQuestionSets);
  }

  const handleGenerate = (formData: unknown) => {
    console.log("Generate form data:", formData);
    // TODO: Call API to generate new question set

    // For demo purposes, add both MCQ and Essay question sets
    setMcqQuestionSets((prev) => [...prev, dummyMCQQuestions]);
    setEssayQuestionSets((prev) => [...prev, dummyEssayQuestions]);
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
    } else {
      console.error("Unknown question type:", (firstQuestion as IH5PQuestion).library);
    }
  };

  return (
    <div className="w-full max-w-[1800px] px-4 py-4">
      <div className="min-h-screen flex flex-col md:flex-row md:items-start md:justify-center gap-6">
        <div className="w-full md:w-[30%]">
          <MaterialEditorForm onGenerate={handleGenerate} />
        </div>

        <div className="w-full md:w-[70%] space-y-6">
          <h2 className="text-2xl font-semibold">Practice Questions</h2>
          {mcqQuestionSets.length === 0 && essayQuestionSets.length === 0 ? (
            <Card>
              <CardDescription className="flex flex-col justify-center items-center p-6">
                <p className="text-center text-muted-foreground">No practice materials have been generated for this session</p>
                <p className="text-destructive text-center mt-2">Reminder: All Sessions are temporary and will not persist after exiting</p>
              </CardDescription>
            </Card>
          ) : (
            <>
              {mcqQuestionSets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Multiple Choice Questions</h3>
                  {mcqQuestionSets.map((questions, index) => (
                    <MCQEditableContainer
                      key={`mcq-${index}`}
                      initialQuestions={questions}
                      exportToH5P={handleExportToH5P}
                      onDelete={() => {handleQuizDelete(index)}}
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
                      onDelete={() => {handleEssayDelete(index)}}
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
