import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MCQQuestion, QuestionAnswer } from "@/types/PracticeMaterial";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MCQQuestionComponentProps {
  question: MCQQuestion;
  questionNumber: number;
  answer: QuestionAnswer;
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmit: (questionId: string) => void;
}

export function MCQQuestionComponent({
  question,
  questionNumber,
  answer,
  onAnswerChange,
  onSubmit,
}: MCQQuestionComponentProps) {
  const handleOptionClick = (optionId: string) => {
    if (!answer.hasSubmitted) {
      onAnswerChange(question.id, optionId);
    }
  };

  const handleSubmit = () => {
    if (answer.selectedOption && !answer.hasSubmitted) {
      onSubmit(question.id);
    }
  };

  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle className="text-lg font-semibold">
          Question {questionNumber}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {question.questionText}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4">
        {/* options */}
        <div className="space-y-2">
          {question.options.map((option) => {
            const isSelected = answer.selectedOption === option.id;
            const isCorrect = option.id === question.correctAnswer;
            const showCorrect = answer.hasSubmitted && isCorrect;
            const showIncorrect =
              answer.hasSubmitted && isSelected && !isCorrect;

            return (
              <Button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                disabled={answer.hasSubmitted}
                variant="outline"
                className={cn(
                  "w-full justify-start text-left p-4 h-auto min-h-[3rem] border bg-card hover:bg-gray-50 hover:text-muted-foreground transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-100",
                  isSelected &&
                    !answer.hasSubmitted &&
                    "border-blue-500 bg-blue-50",
                  showCorrect && "border-green-500 bg-green-50",
                  showIncorrect && "border-red-500 bg-red-50",
                  !isSelected && answer.hasSubmitted && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div>
                    <span className="font-medium">
                      {option.id.toUpperCase()}.
                    </span>{" "}
                    {option.text}
                  </div>
                  {answer.hasSubmitted && showCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                  {answer.hasSubmitted && showIncorrect && (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>

      {/* submit button */}
      {!answer.hasSubmitted && (
        <CardContent className="px-4">
          <Button
            onClick={handleSubmit}
            disabled={!answer.selectedOption}
            className="w-full"
          >
            Submit Answer
          </Button>
        </CardContent>
      )}

      {/* explanation */}
      {answer.hasSubmitted && answer.isCorrect !== null && (
        <CardFooter className="px-4">
          <Card
            className={cn(
              "p-4 w-full",
              answer.isCorrect
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            )}
          >
            <div className="flex items-start gap-2">
              {answer.isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}

              <div>
                <p className="font-semibold mb-1">
                  {answer.isCorrect ? "Correct!" : "Incorrect"}
                </p>
                <p className="text-sm text-gray-700">
                  {
                    question.options.find(
                      (opt) => opt.id === answer.selectedOption
                    )?.explanation
                  }
                </p>
              </div>
            </div>
          </Card>``
        </CardFooter>
      )}

    </Card>
  );
}
