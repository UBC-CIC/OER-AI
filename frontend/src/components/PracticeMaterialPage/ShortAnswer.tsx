import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, BookOpen, Check, X } from "lucide-react";
import type { ShortAnswerQuestion } from "@/types/PracticeMaterial";

interface ShortAnswerProps {
  title: string;
  questions: ShortAnswerQuestion[];
  onDelete: () => void;
}

export function ShortAnswer({ title, questions, onDelete }: ShortAnswerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitAnswer = (questionId: string) => {
    setSubmitted((prev) => ({
      ...prev,
      [questionId]: true,
    }));
    setShowFeedback((prev) => ({
      ...prev,
      [questionId]: true,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted({});
    setShowFeedback({});
    setCurrentQuestionIndex(0);
  };

  const isCurrentAnswerSubmitted = submitted[currentQuestion.id];
  const currentAnswer = answers[currentQuestion.id] || "";

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">{title}</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-lg font-medium">{currentQuestion.questionText}</p>
            {currentQuestion.context && (
              <p className="text-sm text-muted-foreground mt-2">
                Context: {currentQuestion.context}
              </p>
            )}
          </div>

          {/* Answer Input */}
          <div className="space-y-2">
            <Textarea
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              placeholder="Type your answer here..."
              className="min-h-[120px] resize-none"
              disabled={isCurrentAnswerSubmitted}
            />
            <p className="text-xs text-muted-foreground">
              {currentQuestion.expectedLength && `Expected length: ~${currentQuestion.expectedLength} words`}
            </p>
          </div>

          {/* Submit Button */}
          {!isCurrentAnswerSubmitted && (
            <Button
              onClick={() => handleSubmitAnswer(currentQuestion.id)}
              disabled={!currentAnswer.trim()}
              className="w-full"
            >
              Submit Answer
            </Button>
          )}

          {/* Feedback */}
          {isCurrentAnswerSubmitted && showFeedback[currentQuestion.id] && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">Sample Answer:</p>
                    <p className="text-sm">{currentQuestion.sampleAnswer}</p>
                  </div>
                </div>

                {currentQuestion.keyPoints && currentQuestion.keyPoints.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-primary/20">
                    <p className="font-medium text-sm">Key Points to Cover:</p>
                    <ul className="space-y-1 text-sm">
                      {currentQuestion.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentQuestion.rubric && (
                  <div className="space-y-2 pt-3 border-t border-primary/20">
                    <p className="font-medium text-sm">Grading Rubric:</p>
                    <p className="text-sm text-muted-foreground">{currentQuestion.rubric}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>
          
          <Button variant="outline" onClick={handleReset}>
            Reset All
          </Button>

          <Button
            onClick={handleNextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Next
          </Button>
        </div>

        {/* Summary at the end */}
        {currentQuestionIndex === questions.length - 1 && isCurrentAnswerSubmitted && (
          <div className="bg-secondary/50 p-4 rounded-lg text-center">
            <p className="font-medium">You've completed all questions!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Review your answers or reset to try again.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
