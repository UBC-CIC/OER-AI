import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PromptCard from "./PromptCard";

type PromptLibraryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts?: string[];
  onSelectPrompt?: (prompt: string) => void;
  title?: string;
  children?: React.ReactNode;
};

export default function PromptLibraryModal({
  open,
  onOpenChange,
  prompts = [],
  onSelectPrompt,
  title = "Prompt Library",
  children,
}: PromptLibraryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {children ? (
          children
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-stretch">
            {prompts.map((prompt, index) => (
              <PromptCard
                key={index}
                text={prompt}
                onClick={() => {
                  onSelectPrompt?.(prompt);
                  onOpenChange(false);
                }}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
