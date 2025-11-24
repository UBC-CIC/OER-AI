import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, BookOpen, Check, X, Loader2, ExternalLink } from "lucide-react";
import type { ShortAnswerQuestion } from "@/types/PracticeMaterial";
import { useTextbookView } from "@/providers/textbookView";

interface ShortAnswerProps {
  title: string;
  questions: ShortAnswerQuestion[];
  sources_used?: string[];
  onDelete: () => void;
}

interface GradingFeedback {
  feedback: string;
  strengths: string[];
  improvements: string[];
  keyPointsCovered: string[];
  keyPointsMissed: string[];
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

export function ShortAnswer({ title, questions, sources_used, onDelete }: ShortAnswerProps) {
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
          variant="link"
          size="icon"
          onClick={onDelete}
          className="cursor-pointer h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
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

              {/* Show sources for learning */}
              {sources_used && sources_used.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">Learn more from these sources:</p>
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
