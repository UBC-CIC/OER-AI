import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MCQQuestionComponent } from "./MCQComponent";
import type { MCQQuestion, QuestionAnswer } from "@/types/PracticeMaterial";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

interface MCQQuizProps {
  title: string;
  questions: MCQQuestion[];
  sources_used?: string[];
  onDelete?: () => void;
}

export function MCQQuiz({ title, questions, sources_used, onDelete }: MCQQuizProps) {
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
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
            <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          </div>
          {onDelete && (
            <Button
              variant="link"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="cursor-pointer h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
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
                className="w-fit cursor-pointer disabled:cursor-not-allowed"
              >
                Submit All Answers
              </Button>
            ) : (
              <Button
                onClick={handleResetAll}
                className="w-fit cursor-pointer"
                variant="outline"
              >
                Reset All & Retry
              </Button>
            )}
          </div>

          {/* Sources Section */}
          {sources_used && sources_used.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-2">Content Sources</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                {sources_used.map((source, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
