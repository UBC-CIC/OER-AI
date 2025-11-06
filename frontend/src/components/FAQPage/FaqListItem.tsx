import { MoreHorizontal, Flag, CornerUpRight } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FaqListItemProps {
  question: string;
  count: number;
  onClick?: () => void;
}

export function FaqListItem({ question, count, onClick }: FaqListItemProps) {
  return (
    <div
      className="flex items-center justify-between py-4 px-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {question}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {count} uses
        </p>
      </div>
      <CornerUpRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mr-2" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-auto min-w-0 p-1" 
          side="top" 
          align="end" 
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            className="p-1 focus:bg-background cursor-pointer flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              console.log("Report clicked");
            }}
          >
            <span>Report</span>
            <Flag className="h-4 w-4 flex-shrink-0" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
