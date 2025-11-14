import { Card, CardContent } from "@/components/ui/card";
import { SaveIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useUserSession } from "@/providers/usersession";
import { useMode } from "@/providers/mode";

// Props for saving a user's message as a shared prompt
type UserChatMessageProps = {
  text: string;
  textbookId: string; // textbook to associate the prompt with
  onSaveSuccess?: (promptId: string) => void; // optional callback on success
  onSaveError?: (error: Error) => void; // optional callback on error
};

export default function UserChatMessage({ text, textbookId, onSaveSuccess, onSaveError }: UserChatMessageProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(text);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { sessionUuid } = useUserSession();
  const { mode } = useMode();

  function handleOpen() {
    setName("");
    setPrompt(text);
    setOpen(true);
  }

  async function handleSubmit() {
    setErrorMsg(null);
    if (!textbookId) {
      setErrorMsg("Missing textbookId");
      return;
    }

    try {
      setIsSaving(true);
      // Acquire public token
      const tokenResp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
      if (!tokenResp.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResp.json();

      // Create shared prompt
      const createResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbookId}/shared_prompts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: name || null,
            prompt_text: prompt,
            owner_session_id: sessionUuid || null,
            role: mode,
            visibility: "public",
            tags: [],
            metadata: {},
          }),
        }
      );

      if (!createResp.ok) {
        const errText = await createResp.text();
        throw new Error(errText || "Failed to save prompt");
      }

      const data = await createResp.json();
      // Close dialog and notify
      setOpen(false);
      onSaveSuccess?.(data.id);
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Unknown error");
      setErrorMsg(e.message);
      onSaveError?.(e);
    } finally {
      setIsSaving(false);
    }
  }
  return (
    // main msg container
    <div className="flex flex-col items-end gap-1 group">
      <div className="flex justify-end w-full">
        <Card className="py-[10px] max-w-[90%]">
          <CardContent className="px-[10px] text-sm lg:text-md break-words">
            <p className="whitespace-pre-wrap">{text}</p>
          </CardContent>
        </Card>
      </div>

      {/* hover save button */}
      <div className="flex justify-end">
        <button
          // visible by default on small (touch) screens, hidden on md+ until hover/focus
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus:opacity-100 p-0"
          onClick={handleOpen}
          aria-label="Save message"
        >
          <SaveIcon className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" />
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save prompt</DialogTitle>
              <DialogDescription>
                Give this prompt a name and edit the prompt text before saving.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <label className="text-sm">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="A short name for this prompt"
              />

              <label className="text-sm">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-500">{errorMsg}</p>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save prompt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
