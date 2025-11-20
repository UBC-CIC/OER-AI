import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flashcard } from "./Flashcard";
import type { FlashcardSetData } from "@/types/PracticeMaterial";
import { ChevronLeft, ChevronRight, Download, Shuffle, Trash2, RotateCcw } from "lucide-react";

interface FlashcardSetProps {
  title: string;
  cards: FlashcardSetData["cards"];
  sources_used?: string[];
  onDelete: () => void;
}

export function FlashcardSet({ title, cards, sources_used, onDelete }: FlashcardSetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledCards, setShuffledCards] = useState(cards);
  const [exportFormat, setExportFormat] = useState<string>("json");

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : shuffledCards.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < shuffledCards.length - 1 ? prev + 1 : 0));
  };

  const handleShuffle = () => {
    const shuffled = [...shuffledCards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
    setCurrentIndex(0);
  };

  const handleReset = () => {
    setShuffledCards(cards);
    setCurrentIndex(0);
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

  const handleExport = () => {
    if (exportFormat === "json") {
      const data = { title, cards: shuffledCards };
      const contents = JSON.stringify(data, null, 2);
      downloadFile(contents, `${title.replace(/\s+/g, "_")}.json`, "application/json");
    }
    // PDF export can be added later
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {shuffledCards.length} {shuffledCards.length === 1 ? "card" : "cards"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Flashcard Display */}
        <Flashcard
          card={shuffledCards[currentIndex]}
          currentIndex={currentIndex}
          totalCards={shuffledCards.length}
        />

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={shuffledCards.length <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium min-w-[80px] text-center">
            {currentIndex + 1} / {shuffledCards.length}
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={shuffledCards.length <= 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <Shuffle className="h-4 w-4 mr-2" />
            Shuffle
          </Button>

          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>

          <div className="flex gap-2">
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>

            <Button size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Sources Section */}
        {sources_used && sources_used.length > 0 && (
          <div className="pt-4 border-t">
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
    </Card>
  );
}
