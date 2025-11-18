import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { I5HPMultiChoiceQuestion } from "@/types/MaterialEditor";
import { Separator } from "../ui/separator";
import { Label } from "../ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MCQEditableProps {
  question: I5HPMultiChoiceQuestion;
  questionNumber: number;
  onUpdate: (updatedQuestion: I5HPMultiChoiceQuestion) => void;
  onDelete?: () => void;
}

export function MCQEditable({
  question,
  questionNumber,
  onUpdate,
  onDelete,
}: MCQEditableProps) {
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    setCorrectAnswerIndex(
      question.params.answers.findIndex((answer) => answer.correct)
    );
  }, [question.params.answers]);

  const handleQuestionChange = (newText: string) => {
    onUpdate({
      ...question,
      params: {
        ...question.params,
        question: newText,
      },
    });
  };

  const handleAnswerTextChange = (index: number, newText: string) => {
    const newAnswers = [...question.params.answers];
    newAnswers[index] = {
      ...newAnswers[index],
      text: newText,
    };
    onUpdate({
      ...question,
      params: {
        ...question.params,
        answers: newAnswers,
      },
    });
  };

  const handleFeedbackChange = (
    index: number,
    field: "tip" | "chosenFeedback" | "notChosenFeedback",
    value: string
  ) => {
    const newAnswers = [...question.params.answers];
    newAnswers[index] = {
      ...newAnswers[index],
      tipsAndFeedback: {
        ...newAnswers[index].tipsAndFeedback,
        [field]: value,
      },
    };
    onUpdate({
      ...question,
      params: {
        ...question.params,
        answers: newAnswers,
      },
    });
  };

  const handleCorrectToggle = (index: number) => {
    const newAnswers = question.params.answers;
    // remove old correct answer
    if (correctAnswerIndex !== null && correctAnswerIndex !== index) {
      newAnswers[correctAnswerIndex] = {
        ...newAnswers[correctAnswerIndex],
        correct: false,
      };
    }

    // set new correct value
    newAnswers[index] = {
      ...newAnswers[index],
      correct: true,
    };

    setCorrectAnswerIndex(index);
    onUpdate({
      ...question,
      params: {
        ...question.params,
        answers: newAnswers,
      },
    });
  };

  const handleAddAnswer = () => {
    const newAnswers = [
      ...question.params.answers,
      {
        text: "New answer option",
        correct: false,
        tipsAndFeedback: {
          tip: "",
          chosenFeedback: "",
          notChosenFeedback: "",
        },
      },
    ];
    onUpdate({
      ...question,
      params: {
        ...question.params,
        answers: newAnswers,
      },
    });
  };

  const handleDeleteAnswer = (index: number) => {
    if (question.params.answers.length <= 1) {
      return; // Don't allow deleting the last option
    }

    const newAnswers = question.params.answers.filter((_, i) => i !== index);
    
    // If we deleted the correct answer, make the first answer correct
    if (index === correctAnswerIndex) {
      newAnswers[0] = {
        ...newAnswers[0],
        correct: true,
      };
      setCorrectAnswerIndex(0);
    } else if (correctAnswerIndex !== null && index < correctAnswerIndex) {
      // Adjust the correct answer index if we deleted an answer before it
      setCorrectAnswerIndex(correctAnswerIndex - 1);
    }

    onUpdate({
      ...question,
      params: {
        ...question.params,
        answers: newAnswers,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold mb-2">
            Question {questionNumber}
          </CardTitle>
          {onDelete && (
            <Button
              variant="link"
              size="icon"
              onClick={onDelete}
              aria-label="Delete question"
              className="w-fit h-fit cursor-pointer text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Textarea
          value={question.params.question}
          onChange={(e) => handleQuestionChange(e.target.value)}
          autoFocus
          className="text-sm py-1 border-text-muted-foreground min-h-fit"
        />
      </CardHeader>

      <CardContent>
        {/* Answer Options */}
        {question.params.answers.map((answer, index) => (
          <div key={index}>
            <div className="flex items-center justify-between w-full">
              <Label
                className={cn(
                  `${
                    index !== correctAnswerIndex && "cursor-pointer"
                  } text-sm font-normal text-muted-foreground`
                )}
                onClick={() => handleCorrectToggle(index)}
              >
                {answer.correct ? (
                  <CheckCircle className="h-4 w-4 text-green-600"></CheckCircle>
                ) : (
                  <XCircle className="h-4 w-4 text-red-600"></XCircle>
                )}
                {answer.correct ? " Correct Answer" : " Incorrect Answer"}
              </Label>
              
              <Button
                variant="link"
                size="icon"
                onClick={() => handleDeleteAnswer(index)}
                disabled={question.params.answers.length <= 1}
                className="cursor-pointer h-fit w-fit text-destructive hover:text-destructive disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-col items-start mt-1">
              <div className="flex-1 w-full">
                <Input
                placeholder="Answer option text"
                  value={answer.text}
                  onChange={(e) =>
                    handleAnswerTextChange(index, e.target.value)
                  }
                  className="text-sm"
                />

                {/* Feedback fields */}
                <div className="mt-2 space-y-4 pl-2 border-l-2 border-muted">
                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Tip (optional)
                    </Label>
                    <Input
                      value={answer.tipsAndFeedback?.tip || ""}
                      onChange={(e) =>
                        handleFeedbackChange(index, "tip", e.target.value)
                      }
                      placeholder="Hint for this answer"
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Chosen Feedback (optional)
                    </Label>
                    <Input
                      value={answer.tipsAndFeedback?.chosenFeedback || ""}
                      onChange={(e) =>
                        handleFeedbackChange(
                          index,
                          "chosenFeedback",
                          e.target.value
                        )
                      }
                      placeholder="Feedback when selected"
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Not Chosen Feedback (optional)
                    </Label>
                    <Input
                      value={answer.tipsAndFeedback?.notChosenFeedback || ""}
                      onChange={(e) =>
                        handleFeedbackChange(
                          index,
                          "notChosenFeedback",
                          e.target.value
                        )
                      }
                      placeholder="Feedback when not selected"
                      className="text-xs mt-1"
                    />
                  </div>
                </div>
                <Separator className="my-4" />
              </div>
            </div>
          </div>
        ))}
        
        {/* Add Answer Button */}
        <Button
          variant="outline"
          onClick={handleAddAnswer}
          className="cursor-pointer w-full mt-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Answer Option
        </Button>
      </CardContent>
    </Card>
  );
}
