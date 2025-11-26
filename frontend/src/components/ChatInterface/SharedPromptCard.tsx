import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flag } from "lucide-react";
import { ReportPromptDialog } from "./ReportPromptDialog";
import type { SharedUserPrompt } from "@/types/Chat";

type SharedPromptCardProps = {
  prompt: SharedUserPrompt;
  onClick?: () => void;
  onReported?: () => void;
  className?: string;
};

export default function SharedPromptCard({
  prompt,
  onClick,
  onReported,
  className,
}: SharedPromptCardProps) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  return (
    <>
      <Card
        className={`flex-1 p-[10px] cursor-pointer hover:bg-gray-50 transition-colors ${
          className ?? ""
        }`}
      >
        <div className="h-full flex items-start justify-between gap-2">
          <div onClick={onClick} className="flex-1 min-w-0 cursor-pointer">
            <p className="text-md text-muted-foreground break-words">
              {prompt.title}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setReportDialogOpen(true);
            }}
            className="cursor-pointer h-8 w-8 flex-shrink-0 hover:bg-gray-200"
            title="Report this prompt"
            disabled={prompt.reported}
          >
            <Flag className={`h-4 w-4 ${prompt.reported ? 'text-red-500' : 'text-muted-foreground'}`} />
          </Button>
        </div>
      </Card>

      <ReportPromptDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        promptId={prompt.id}
        promptTitle={prompt.title}
        onReportSubmitted={() => {
          onReported?.();
        }}
      />
    </>
  );
}
