import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router";
import { User, ArrowRight, Library } from "lucide-react";

type Textbook = {
  id: string | number;
  title: string;
  author: string[];
  category: string;
  logo_url?: string;
};

// Proper formatting of authors tags
function formatAuthors(authors: string[]) {
  if (!authors || authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return authors.slice(0, -1).join(", ") + " & " + authors[authors.length - 1];
}

export default function TextbookCard({ textbook }: { textbook: Textbook }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/textbook/${textbook.id}/chat`);
  };

  return (
    <TooltipProvider>
      <Card
        onClick={handleCardClick}
        className="group flex flex-col h-full p-0 gap-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-muted hover:border-primary/50 overflow-hidden bg-card"
      >
        {/* Visual Header / Cover Placeholder */}
        <div className="relative h-32 w-full bg-gradient-to-br from-[#2c5f7c] to-[#3d7a9a] flex items-center justify-center overflow-hidden group-hover:from-[#234b62] group-hover:to-[#326580] transition-colors border-b">
          {textbook.logo_url ? (
            <img
              src={textbook.logo_url}
              alt={`${textbook.title} logo`}
              className="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                // Fallback to Library icon if image fails to load
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget
                  .nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "block";
              }}
            />
          ) : null}
          <Library
            className={`h-12 w-12 text-white/20 group-hover:scale-110 group-hover:text-white/30 transition-all duration-500 ${
              textbook.logo_url ? "hidden" : ""
            }`}
          />

          <div className="absolute top-3 right-3 max-w-[70%]">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="shadow-sm bg-background/90 backdrop-blur-sm hover:bg-background w-full justify-center border-none"
                >
                  <span className="truncate">{textbook.category}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{textbook.category}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <CardContent className="flex-1 p-5 flex flex-col gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="font-bold text-lg text-center line-clamp-2 group-hover:text-primary transition-colors min-h-[3.5rem]">
                {textbook.title}
              </h3>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[300px]">
              <p>{textbook.title}</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto">
            <User className="h-3.5 w-3.5 shrink-0" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate hover:text-foreground transition-colors">
                  {formatAuthors(textbook.author)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{formatAuthors(textbook.author)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>

        <CardFooter className="p-5 pt-0 mt-auto flex justify-end">
          <div className="flex items-center text-xs font-medium text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            Start Learning <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
