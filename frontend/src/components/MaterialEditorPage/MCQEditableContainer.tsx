import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MCQEditable } from "./MCQEditable";
import { ExportDialog } from "./ExportDialog";
import type { IH5PMinimalQuestionSet, IH5PQuestion } from "@/types/MaterialEditor";
import { ChevronDown, ChevronUp, Download, Plus, Trash2 } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface MCQEditableContainerProps {
  initialQuestionSet: IH5PMinimalQuestionSet;
  exportToH5P: (questionSet: IH5PMinimalQuestionSet) => void;
  onDelete: () => void;
}

export function MCQEditableContainer({
  initialQuestionSet,
  exportToH5P: onExport,
  onDelete,
}: MCQEditableContainerProps) {
  const [questionSet, setQuestionSet] = useState<IH5PMinimalQuestionSet>(initialQuestionSet);
  const [isExpanded, setIsExpanded] = useState(true);
  const [title, setTitle] = useState("Untitled Quiz");
  const [exportFormat, setExportFormat] = useState<string>("json");
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleQuestionUpdate = (index: number, updatedQuestion: IH5PQuestion) => {
    const newQuestions = [...questionSet.questions];
    newQuestions[index] = updatedQuestion;
    setQuestionSet({ questions: newQuestions });
  };

  const handleAddQuestion = () => {
    const newQuestion: IH5PQuestion = {
      library: "H5P.MultiChoice 1.17",
      params: {
        question: "New question?",
        answers: [
          {
            text: "",
            correct: true,
            tipsAndFeedback: {
              tip: "",
              chosenFeedback: "",
              notChosenFeedback: "",
            },
          },
          {
            text: "",
            correct: false,
            tipsAndFeedback: {
              tip: "",
              chosenFeedback: "",
              notChosenFeedback: "",
            },
          },
        ],
      },
    };
    setQuestionSet({ questions: [...questionSet.questions, newQuestion] });
  };

  const handleDeleteQuestion = (index: number) => {
    if (questionSet.questions.length <= 1) return; // enforce at least 1
    const newQuestions = questionSet.questions.filter((_, i) => i !== index);
    setQuestionSet({ questions: newQuestions });
  };

  const downloadFile = (contents: string, filename: string, mime = "application/json") => {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = (qs = questionSet) => {
    const contents = JSON.stringify(qs, null, 2);
    downloadFile(contents, `${title || "quiz"}.json`, "application/json");
  };
  

  const handleExport = () => {
    if (exportFormat === "json") {
      exportAsJSON();
      return;
    }

    if (exportFormat === "h5p") {
      // use parents h5p api exporter
      onExport(questionSet);
      return;
    }

    if (exportFormat === "pdf") {
      // Open dialog to choose PDF style
      setShowExportDialog(true);
      return;
    }
  };


  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 pr-2">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1">
              <Input
                value={title}
                onChange={(e) => {
                  e.stopPropagation();
                  setTitle(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-lg font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {questionSet.questions.length} {questionSet.questions.length === 1 ? 'question' : 'questions'}
              </p>
            </div>
          </div>

            <Button
              variant="link"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="cursor-pointer h-fit text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <>
          <CardContent className="space-y-4">
            {questionSet.questions.map((question, index) => (
              <MCQEditable
                key={index}
                question={question}
                questionNumber={index + 1}
                onUpdate={(updatedQuestion) => handleQuestionUpdate(index, updatedQuestion)}
                onDelete={() => handleDeleteQuestion(index)}
              />
            ))}
          </CardContent>

          <CardFooter className="flex flex-col md:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={handleAddQuestion} className="cursor-pointer w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>

            <div className="flex w-full md:w-fit gap-2">

              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v)}> 
                <SelectTrigger className="bg-background border border-text-muted-foreground cursor-pointer w-[50%] md:w-fit sm:w-auto">
                  Export as: <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="cursor-pointer" value="json">JSON</SelectItem>
                  <SelectItem className="cursor-pointer" value="h5p">H5P</SelectItem>
                  <SelectItem className="cursor-pointer" value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleExport}
                className="cursor-pointer w-[50%] md:w-fit sm:w-auto"
              >
                Export
                <Download className="h-4 w-4 mr-2" />
              </Button>
            </div>
          </CardFooter>
        </>
      )} 
      
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        questionSet={questionSet}
        title={title}
      />
    </Card>
  );
}
