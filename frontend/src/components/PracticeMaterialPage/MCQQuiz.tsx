import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MCQQuestionComponent } from "./MCQComponent";
import type { MCQQuestion, QuestionAnswer } from "@/types/PracticeMaterial";
import { ChevronDown, ChevronUp } from "lucide-react";

interface MCQQuizProps {
  title: string;
  questions: MCQQuestion[];
}

export function MCQQuiz({ title, questions }: MCQQuizProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [answers, setAnswers] = useState<QuestionAnswer[]>(
    questions.map((q) => ({
      questionId: q.id,
      selectedOption: null,
      isCorrect: null,
      hasSubmitted: false,
    }))
  );

  const handleAnswerChange = (questionId: string, optionId: string) => {
    setAnswers((prev) =>
      prev.map((answer) =>
        answer.questionId === questionId
          ? { ...answer, selectedOption: optionId }
          : answer
      )
    );
  };

  const handleSubmit = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    setAnswers((prev) =>
      prev.map((answer) =>
        answer.questionId === questionId
          ? {
              ...answer,
              hasSubmitted: true,
              isCorrect: answer.selectedOption === question.correctAnswer,
            }
          : answer
      )
    );
  };

  const handleReset = (questionId: string) => {
    setAnswers((prev) =>
      prev.map((answer) =>
        answer.questionId === questionId
          ? {
              ...answer,
              selectedOption: null,
              isCorrect: null,
              hasSubmitted: false,
            }
          : answer
      )
    );
  };

  const handleSubmitAll = () => {
    setAnswers((prev) =>
      prev.map((answer) => {
        const question = questions.find((q) => q.id === answer.questionId);
        if (!question || answer.hasSubmitted) return answer;

        return {
          ...answer,
          hasSubmitted: true,
          isCorrect: answer.selectedOption === question.correctAnswer,
        };
      })
    );
  };

  const handleResetAll = () => {
    setAnswers((prev) =>
      prev.map((answer) => ({
        ...answer,
        selectedOption: null,
        isCorrect: null,
        hasSubmitted: false,
      }))
    );
  };

  const allSubmitted = answers.every((a) => a.hasSubmitted);
  const hasAnsweredAll = answers.every((a) => a.selectedOption !== null);

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {/* Questions */}
      {isExpanded && (
        <CardContent className="space-y-6">
          {questions.map((question, index) => {
            const answer = answers.find((a) => a.questionId === question.id)!;
            return (
              <MCQQuestionComponent
                key={question.id}
                question={question}
                questionNumber={index + 1}
                answer={answer}
                onAnswerChange={handleAnswerChange}
                onSubmit={handleSubmit}
                onReset={handleReset}
              />
            );
          })}

          {/* Submit All / Reset All Button */}
          <div className="flex justify-end">
            {!allSubmitted ? (
              <Button
                onClick={handleSubmitAll}
                disabled={!hasAnsweredAll}
                className="w-fit"
              >
                Submit All Answers
              </Button>
            ) : (
              <Button
                onClick={handleResetAll}
                className="w-fit"
                variant="outline"
              >
                Reset All & Retry
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
