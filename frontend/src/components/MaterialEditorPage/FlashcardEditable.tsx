import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { IH5PFlashcardCard } from "@/types/MaterialEditor";
import { Input } from "@/components/ui/input";

interface FlashcardEditableProps {
  flashcard: IH5PFlashcardCard;
  cardNumber: number;
  onUpdate: (updatedFlashcard: IH5PFlashcardCard) => void;
  onDelete?: () => void;
}

export function FlashcardEditable({
  flashcard,
  cardNumber,
  onUpdate,
  onDelete,
}: FlashcardEditableProps) {
  const handleFrontChange = (newText: string) => {
    onUpdate({
      ...flashcard,
      text: newText,
    });
  };

  const handleBackChange = (newAnswer: string) => {
    onUpdate({
      ...flashcard,
      answer: newAnswer,
    });
  };

  const handleTipChange = (newTip: string) => {
    onUpdate({
      ...flashcard,
      tip: newTip,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold mb-2">
            Card {cardNumber}
          </CardTitle>
          {onDelete && (
            <Button
              variant="link"
              size="icon"
              onClick={onDelete}
              aria-label="Delete flashcard"
              className="w-fit h-fit cursor-pointer text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Front Side */}
        <div>
          <Label className="text-sm font-normal text-muted-foreground">
            Front (Question/Term)
          </Label>
          <Textarea
            value={flashcard.text}
            onChange={(e) => handleFrontChange(e.target.value)}
            className="text-sm py-1 border-text-muted-foreground min-h-[80px] mt-1"
            placeholder="Enter the question or term..."
          />
        </div>

        {/* Back Side */}
        <div>
          <Label className="text-sm font-normal text-muted-foreground">
            Back (Answer/Definition)
          </Label>
          <Textarea
            value={flashcard.answer}
            onChange={(e) => handleBackChange(e.target.value)}
            className="text-sm py-1 border-text-muted-foreground min-h-[80px] mt-1"
            placeholder="Enter the answer or definition..."
          />
        </div>

        {/* Optional Tip */}
        <div>
          <Label className="text-xs font-normal text-muted-foreground">
            Tip (optional)
          </Label>
          <Input
            value={flashcard.tip || ""}
            onChange={(e) => handleTipChange(e.target.value)}
            placeholder="Add a helpful hint..."
            className="text-xs mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}
