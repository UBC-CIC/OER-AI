import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PromptCard from "./PromptCard";
import { Tabs, TabsContent, TabsTrigger, TabsList } from "../ui/tabs";
import type { PromptTemplate } from "@/types/Chat";

type PromptLibraryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts?: PromptTemplate[];
  onSelectPrompt?: (prompt: string) => void;
  title?: string;
  children?: React.ReactNode;
};

export default function PromptLibraryModal({
  open,
  onOpenChange,
  prompts = [],
  onSelectPrompt,
}: PromptLibraryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:w-fit max-w-3xl sm:max-w-5xl max-h-[80vh] overflow-y-auto">
        <Tabs className="flex flex-col gap-4">
          <div className="flex w-full justify-center">
            <TabsList>
              <TabsTrigger className="cursor-pointer" value="default">
                Default Prompts
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
          <TabsContent value="user">
            <DialogHeader className="text-left">
              <DialogTitle>User Shared Prompts</DialogTitle>
              <DialogDescription>
                Select a community-made prompt template to use in the chat.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 items-stretch">
              {prompts.map((prompt) => (
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
