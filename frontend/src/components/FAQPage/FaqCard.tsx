import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MoreHorizontal, Flag, CornerUpRight } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FaqCardProps {
  question: string;
  count: number;
  onClick?: () => void;
}

export function FaqCard({ question, count, onClick }: FaqCardProps) {
  return (
    <Card
      className="gap-1 sm:gap-6 p-[10px] flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] bg-muted/30"
      onClick={onClick}
    >
      <CardContent
        className="p-0 max-h-2.5 sm:max-h-none"
        style={{ minHeight: `calc(1em * 1.25 * ${window.innerWidth < 768 ? 2 : 3})` }}      >
        <h3 className="font-semibold text-base leading-tight mb-auto">
          {question}
        </h3>
      </CardContent>

      <CardFooter className="p-0">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="px-4 border rounded-lg text-sm font-medium">
              {count}
            </p>
            <CornerUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          {/* report button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="link"
                className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-fit min-w-0 p-1" 
              side="top" 
              align="end" 
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                className="p-1 focus:bg-background focus:text-black hover:text-black text-muted-foreground cursor-pointer flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Report clicked");
                }}
              >
                <span >Report</span>
                <Flag className="hover:text-black h-4 w-4 flex-shrink-0" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}
