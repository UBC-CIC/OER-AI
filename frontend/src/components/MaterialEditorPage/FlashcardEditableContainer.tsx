import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FlashcardEditable } from "./FlashcardEditable";
import { ExportDialog } from "./ExportDialog";
import type { IH5PFlashcard, IH5PFlashcardCard } from "@/types/MaterialEditor";
import { ChevronDown, ChevronUp, Download, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface FlashcardEditableContainerProps {
  initialFlashcards: IH5PFlashcard;
  onDelete: () => void;
  textbookId?: string;
}

export function FlashcardEditableContainer({
  initialFlashcards,
  onDelete,
  textbookId,
}: FlashcardEditableContainerProps) {
  const [flashcards, setFlashcards] = useState<IH5PFlashcardCard[]>(
    initialFlashcards.params.cards
  );
  const [isExpanded, setIsExpanded] = useState(true);
  const [title, setTitle] = useState("Untitled Flashcard Set");
  const [exportFormat, setExportFormat] = useState<string>("json");
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleFlashcardUpdate = (
    index: number,
    updatedFlashcard: IH5PFlashcardCard
  ) => {
    const newFlashcards = [...flashcards];
    newFlashcards[index] = updatedFlashcard;
    setFlashcards(newFlashcards);
  };

  const handleAddFlashcard = () => {
    const newFlashcard: IH5PFlashcardCard = {
      text: "",
      answer: "",
      tip: "",
    };
    // Add new flashcard at the beginning instead of the end
    setFlashcards([newFlashcard, ...flashcards]);
  };

  const handleDeleteFlashcard = (index: number) => {
    if (flashcards.length <= 1) return; // enforce at least 1
    const newFlashcards = flashcards.filter((_, i) => i !== index);
    setFlashcards(newFlashcards);
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

  const exportAsJSON = () => {
    const flashcardSet: IH5PFlashcard = {
      library: "H5P.Flashcards 1.5",
      params: {
        cards: flashcards,
        description: title,
      },
    };
    const contents = JSON.stringify(
      { title, flashcards: flashcardSet },
      null,
      2
    );
    downloadFile(
      contents,
      `${title || "flashcard-set"}.json`,
      "application/json"
    );
  };

  const handleExport = () => {
    if (exportFormat === "json") {
      exportAsJSON();
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
                {flashcards.length}{" "}
                {flashcards.length === 1 ? "flashcard" : "flashcards"}
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
            {flashcards.map((flashcard, index) => (
              <FlashcardEditable
                key={index}
                flashcard={flashcard}
                cardNumber={index + 1}
                onUpdate={(updatedFlashcard) =>
                  handleFlashcardUpdate(index, updatedFlashcard)
                }
                onDelete={() => handleDeleteFlashcard(index)}
              />
            ))}
          </CardContent>

          <CardFooter className="flex flex-col md:flex-row gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleAddFlashcard}
              className="cursor-pointer w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Flashcard
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
                  <SelectItem className="cursor-pointer" value="pdf">
                    PDF
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

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        questionSet={{
          questions: [
            {
              library: "H5P.Flashcards 1.5",
              params: {
                cards: flashcards,
              },
            },
          ],
        }}
        title={title}
      />
    </Card>
  );
}
