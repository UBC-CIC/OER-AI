import { Card } from "@/components/ui/card";
import { CornerUpRight } from "lucide-react";

type PromptCardProps = {
  text: string;
  onClick?: () => void;
  className?: string;
};

export default function PromptCard({ text, onClick, className }: PromptCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`flex-1 p-[10px] cursor-pointer hover:bg-gray-50 transition-colors ${className ?? ""}`}
    >
      <div className="relative h-full flex flex-col items-start">
        <p className="text-md text-muted-foreground mb-auto">{text}</p>
        <CornerUpRight className="absolute bottom-0 right-0 h-4 w-4 text-muted-foreground" />
      </div>
    </Card>
  );
}
