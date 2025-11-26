import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EssayEditable } from "./EssayEditable";
import type { I5HPEssayQuestion } from "@/types/MaterialEditor";
import { ChevronDown, ChevronUp, Download, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface EssayEditableContainerProps {
  initialQuestions: I5HPEssayQuestion[];
  exportToH5P: (questions: I5HPEssayQuestion[]) => void;
  onDelete: () => void;
  textbookId?: string;
}

export function EssayEditableContainer({
  initialQuestions,
  // exportToH5P: onExport,
  onDelete,
  textbookId,
}: EssayEditableContainerProps) {
  const [questions, setQuestions] =
    useState<I5HPEssayQuestion[]>(initialQuestions);
  const [isExpanded, setIsExpanded] = useState(true);
  const [title, setTitle] = useState("Untitled Essay Set");
  const [exportFormat, setExportFormat] = useState<string>("json");

  const handleQuestionUpdate = (
    index: number,
    updatedQuestion: I5HPEssayQuestion
  ) => {
    const newQuestions = [...questions];
    newQuestions[index] = updatedQuestion;
    setQuestions(newQuestions);
  };

  const handleAddQuestion = () => {
    const newQuestion: I5HPEssayQuestion = {
      library: "H5P.Essay 1.5",
      params: {
        taskDescription: "New essay question?",
        keywords: [
          {
            keyword: "example",
            alternatives: [],
            options: {
              points: 1,
              occurrences: 1,
              caseSensitive: false,
              forgiveMistakes: true,
              feedbackIncluded: "",
              feedbackMissed: "",
              feedbackIncludedWord: "keyword",
              feedbackMissedWord: "keyword",
            },
          },
        ],
      },
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) return; // enforce at least 1
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const downloadFile = (
    contents: string,
    filename: string,
    mime = "application/json"
  ) => {
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

  const exportAsJSON = (qs = questions) => {
    const contents = JSON.stringify({ questions: qs }, null, 2);
    downloadFile(contents, `${title || "essay-set"}.json`, "application/json");
  };

  const exportAsH5P = async () => {
    try {
      // Validate textbook ID
      if (!textbookId) {
        alert("Please select a textbook before exporting H5P");
        return;
      }

      // Get auth token
      const tokenResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (!tokenResp.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResp.json();

      // Send questions in H5P format (Lambda expects this structure)
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/textbooks/${textbookId}/practice_materials/export-h5p`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title || "Essay Set",
            questions: questions, // Send in original H5P format
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to export H5P package");
      }

      const data = await response.json();

      // Decode base64 and download
      const binaryString = atob(data.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting H5P:", error);
      alert(
        `Failed to export H5P: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleExport = () => {
    if (exportFormat === "json") {
      exportAsJSON();
      return;
    }

    if (exportFormat === "h5p") {
      exportAsH5P();
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
                {questions.length}{" "}
                {questions.length === 1 ? "essay question" : "essay questions"}
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
            {questions.map((question, index) => (
              <EssayEditable
                key={index}
                question={question}
                questionNumber={index + 1}
                onUpdate={(updatedQuestion) =>
                  handleQuestionUpdate(index, updatedQuestion)
                }
                onDelete={() => handleDeleteQuestion(index)}
              />
            ))}
          </CardContent>

          <CardFooter className="flex flex-col md:flex-row gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleAddQuestion}
              className="cursor-pointer w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>

            <div className="flex w-full md:w-fit gap-2">
              <Select
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v)}
              >
                <SelectTrigger className="bg-background border border-text-muted-foreground cursor-pointer w-[50%] md:w-fit sm:w-auto">
                  Export as: <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="cursor-pointer" value="json">
                    JSON
                  </SelectItem>
                  <SelectItem className="cursor-pointer" value="h5p">
                    H5P
                  </SelectItem>
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
    </Card>
  );
}
