import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";

interface FaqCardProps {
  question: string;
  count: number;
  onClick?: () => void;
}

export function FaqCard({ question, count, onClick }: FaqCardProps) {
  return (
    <Card
      className="p-[10px] flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] bg-muted/30"
      onClick={onClick}
    >
      <CardContent
        className="p-0"
        style={{ minHeight: `calc(1em * 1.25 * 3)` }}
      >
        <h3 className="font-semibold text-base leading-tight mb-auto">
          {question}
        </h3>
      </CardContent>

      <CardFooter className="p-0">
        <div className="flex w-full items-center justify-between">
          <span className="px-4 border rounded-lg text-sm font-medium text-muted-foreground">
            {count}
          </span>
          {/* report button */}
          <Button
            variant={"ghost"}
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
