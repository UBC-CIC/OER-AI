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
import { CheckCircle2, XCircle, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface MCQQuestionComponentProps {
  question: MCQQuestion;
  questionNumber: number;
  answer: QuestionAnswer;
  sources_used?: string[];
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmit: (questionId: string) => void;
  onReset: (questionId: string) => void;
}

// Format source to show clickable links for URLs
const formatSource = (source: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const pageRegex = /\(p\.\s*(\d+)\)/i;

  // Check if source contains a URL
  const urlMatch = source.match(urlRegex);

  if (urlMatch && urlMatch.length > 0) {
    // Extract URL
    const url = urlMatch[0];
    // Extract the remaining text (title, page info)
    const textParts = source.split(urlRegex);
    const beforeUrl = textParts[0]?.trim() || "";
    const afterUrl = textParts[2]?.trim() || "";

    // Check for page number
    const pageMatch = afterUrl.match(pageRegex);
    const pageNumber = pageMatch ? pageMatch[1] : null;

    return (
      <span className="flex items-center gap-1.5 flex-wrap text-foreground/80">
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {beforeUrl || url}
        </a>
        {pageNumber && <span className="text-muted-foreground">(p. {pageNumber})</span>}
      </span>
    );
  } else {
    // Not a URL, treat as textbook reference
    const pageMatch = source.match(pageRegex);
    const pageNumber = pageMatch ? pageMatch[1] : null;

    return (
      <span className="flex items-center gap-1.5 flex-wrap text-foreground/80">
        <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
        <span className="break-words">
          {source.replace(pageRegex, "").trim()}
          {pageNumber && <span className="ml-1 text-muted-foreground">(p. {pageNumber})</span>}
        </span>
      </span>
    );
  }
};

export function MCQQuestionComponent({
  question,
  questionNumber,
  answer,
  sources_used,
  onAnswerChange,
  onSubmit,
  onReset,
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

  const handleReset = () => {
    onReset(question.id);
  };

  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          Question {questionNumber}
        </CardTitle>
        <CardDescription className="text-black text-md">
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

              <div className="flex-1">
                <p className="font-semibold mb-1">
                  {answer.isCorrect ? "Great job!" : "Not quite right"}
                </p>
                <p className="text-sm text-gray-700">
                  {
                    question.options.find(
                      (opt) => opt.id === answer.selectedOption
                    )?.explanation
                  }
                </p>
                
                {/* Show sources for incorrect answers */}
                {!answer.isCorrect && sources_used && sources_used.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-sm font-medium mb-2 text-foreground/80">
                      Learn more from these sources:
                    </p>
                    <ul className="space-y-2 list-none pl-0">
                      {sources_used.map((source, index) => (
                        <li
                          key={index}
                          className="text-xs"
                        >
                          {formatSource(source)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </CardFooter>
      )}

      {/* reset button */}
      {answer.hasSubmitted && (
        <CardFooter className="px-4 pt-0">
          <Button
            onClick={handleReset}
            className="w-full"
            variant="outline"
          >
            Reset & Try Again
          </Button>
        </CardFooter>
      )}

    </Card>
  );
}
