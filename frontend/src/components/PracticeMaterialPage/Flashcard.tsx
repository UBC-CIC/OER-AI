import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { Flashcard as FlashcardType } from "@/types/PracticeMaterial";

interface FlashcardProps {
  card: FlashcardType;
  currentIndex: number;
  totalCards: number;
}

export function Flashcard({ card, currentIndex, totalCards }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full max-w-2xl mx-auto perspective-1000">
      <div
        className={`relative transition-transform duration-500 preserve-3d cursor-pointer ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        onClick={handleFlip}
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front of card */}
        <Card
          className={`min-h-[300px] p-8 flex flex-col justify-between backface-hidden ${
            isFlipped ? "hidden" : ""
          }`}
        >
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xl text-center font-medium leading-relaxed">
              {card.front}
            </p>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground mt-4">
            <span>Click to flip</span>
            <span>
              Card {currentIndex + 1} of {totalCards}
            </span>
          </div>
        </Card>

        {/* Back of card */}
        <Card
          className={`min-h-[300px] p-8 flex flex-col justify-between backface-hidden ${
            isFlipped ? "" : "hidden"
          }`}
          style={{
            transform: "rotateY(180deg)",
          }}
        >
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl font-medium leading-relaxed mb-4">
                {card.back}
              </p>
              {card.hint && (
                <p className="text-sm text-muted-foreground italic mt-4">
                  Hint: {card.hint}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground mt-4">
            <span>Click to flip back</span>
            <span>
              Card {currentIndex + 1} of {totalCards}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
