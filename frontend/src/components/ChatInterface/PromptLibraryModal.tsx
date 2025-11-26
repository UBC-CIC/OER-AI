import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PromptCard from "./PromptCard";
import SharedPromptCard from "./SharedPromptCard";
import { Tabs, TabsContent, TabsTrigger, TabsList } from "../ui/tabs";
import type { PromptTemplate, SharedUserPrompt, GuidedPromptTemplate } from "@/types/Chat";

type PromptLibraryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts?: PromptTemplate[];
  sharedPrompts?: SharedUserPrompt[];
  guidedPrompts?: GuidedPromptTemplate[];
  onSelectPrompt?: (prompt: string) => void;
  onSelectGuidedPrompt?: (template: GuidedPromptTemplate) => void;
  onFetchSharedPrompts?: () => void; // Callback to trigger fetch
  title?: string;
  children?: React.ReactNode;
};

export default function PromptLibraryModal({
  open,
  onOpenChange,
  prompts = [],
  sharedPrompts = [],
  guidedPrompts = [],
  onSelectPrompt,
  onSelectGuidedPrompt,
  onFetchSharedPrompts,
}: PromptLibraryModalProps) {
  // Fetch shared prompts when modal opens
  useEffect(() => {
    if (open && onFetchSharedPrompts) {
      onFetchSharedPrompts();
    }
  }, [open, onFetchSharedPrompts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:w-fit max-w-3xl sm:max-w-5xl max-h-[80vh] overflow-y-auto">
        <Tabs className="flex flex-col gap-4">
          <div className="flex w-full justify-center">
            <TabsList>
              <TabsTrigger className="cursor-pointer" value="default">
                Default Prompts
              </TabsTrigger>
              <TabsTrigger className="cursor-pointer" value="guided">
                Guided Prompts
              </TabsTrigger>
              <TabsTrigger className="cursor-pointer" value="user">
                User Prompts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="default">
            <DialogHeader className="text-left">
              <DialogTitle>Prompt Templates</DialogTitle>
              <DialogDescription>
                Select a pre-determined prompt template to use in the chat.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-stretch">
              {prompts.map((prompt) => (
                // fall back to prompt name if description is missing
                <PromptCard
                  key={prompt.id}
                  name={prompt.name}
                  onClick={() => {
                    onSelectPrompt?.(prompt.description ?? prompt.name);
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="guided">
            <DialogHeader className="text-left">
              <DialogTitle>Guided Prompts</DialogTitle>
              <DialogDescription>
                Interactive prompts that guide you through a conversation to build the perfect request.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-stretch">
              {guidedPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  name={prompt.name}
                  onClick={() => {
                    onSelectGuidedPrompt?.(prompt);
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="user">
            <DialogHeader className="text-left">
              <DialogTitle>User Shared Prompts</DialogTitle>
              <DialogDescription>
                Select a community-made prompt template to use in the chat.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-stretch">
              {sharedPrompts.map((prompt) => (
                <SharedPromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onClick={() => {
                    onSelectPrompt?.(prompt.prompt_text);
                    onOpenChange(false);
                  }}
                  onReported={() => {
                    // Refresh the shared prompts list
                    onFetchSharedPrompts?.();
                  }}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
