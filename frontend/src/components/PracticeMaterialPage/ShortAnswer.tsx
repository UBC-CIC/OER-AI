import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, BookOpen, Check, X, Loader2 } from "lucide-react";
import type { ShortAnswerQuestion } from "@/types/PracticeMaterial";
import { useTextbookView } from "@/providers/textbookView";

interface ShortAnswerProps {
  title: string;
  questions: ShortAnswerQuestion[];
  onDelete: () => void;
}

interface GradingFeedback {
  feedback: string;
  strengths: string[];
  improvements: string[];
  keyPointsCovered: string[];
  keyPointsMissed: string[];
}

export function ShortAnswer({ title, questions, onDelete }: ShortAnswerProps) {
  const { textbook } = useTextbookView();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [grading, setGrading] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, GradingFeedback>>({});

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!textbook?.id) return;
    
    const question = questions.find(q => q.id === questionId);
    if (!question) return;
    
    setGrading((prev) => ({ ...prev, [questionId]: true }));
    
    try {
      // Get public token
      const tokenResp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
      if (!tokenResp.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResp.json();
      
      // Call grading endpoint
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbook.id}/practice_materials/grade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: question.questionText,
            student_answer: answers[questionId] || "",
            sample_answer: question.sampleAnswer,
            key_points: question.keyPoints || [],
            rubric: question.rubric,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to grade answer");
      }
      
      const gradingResult: GradingFeedback = await response.json();
      
      setFeedback((prev) => ({
        ...prev,
        [questionId]: gradingResult,
      }));
      
      setSubmitted((prev) => ({
        ...prev,
        [questionId]: true,
      }));
    } catch (error) {
      console.error("Error grading answer:", error);
      alert("Failed to grade answer. Please try again.");
    } finally {
      setGrading((prev) => ({ ...prev, [questionId]: false }));
    }
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
    setFeedback({});
    setGrading({});
    setCurrentQuestionIndex(0);
  };

  const isCurrentAnswerSubmitted = submitted[currentQuestion.id];
  const isCurrentAnswerGrading = grading[currentQuestion.id];
  const currentAnswer = answers[currentQuestion.id] || "";
  const currentFeedback = feedback[currentQuestion.id];

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
              disabled={!currentAnswer.trim() || isCurrentAnswerGrading}
              className="w-full"
            >
              {isCurrentAnswerGrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Grading...
                </>
              ) : (
                "Submit Answer"
              )}
            </Button>
          )}

          {/* Feedback */}
          {isCurrentAnswerSubmitted && currentFeedback && (
            <div className="space-y-4">
              {/* Overall Feedback */}
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                <p className="font-medium mb-2">Feedback:</p>
                <p className="text-sm">{currentFeedback.feedback}</p>
              </div>

              {/* Strengths */}
              {currentFeedback.strengths.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900 dark:text-green-100 mb-2">Strengths:</p>
                      <ul className="space-y-1 text-sm text-green-800 dark:text-green-200">
                        {currentFeedback.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Improvements */}
              {currentFeedback.improvements.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Suggestions for Improvement:</p>
                  <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    {currentFeedback.improvements.map((improvement, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Points Analysis */}
              <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                {currentFeedback.keyPointsCovered.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2">Key Points Covered:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {currentFeedback.keyPointsCovered.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {currentFeedback.keyPointsMissed.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="font-medium text-sm mb-2">Key Points to Consider:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {currentFeedback.keyPointsMissed.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <X className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Sample Answer & Rubric */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div>
                  <p className="font-medium text-sm mb-2">Sample Answer:</p>
                  <p className="text-sm text-muted-foreground">{currentQuestion.sampleAnswer}</p>
                </div>

                {currentQuestion.keyPoints && currentQuestion.keyPoints.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="font-medium text-sm mb-2">Key Points:</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
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
                  <div className="pt-3 border-t border-border">
                    <p className="font-medium text-sm mb-2">Grading Rubric:</p>
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
