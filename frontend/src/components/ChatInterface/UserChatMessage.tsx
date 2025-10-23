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

// temporary props for future api calla
type UserChatMessageProps = {
  text: string;
  onSave?: () => void;
};

export default function UserChatMessage({ text, onSave }: UserChatMessageProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(text);

  function handleOpen() {
    setName("");
    setPrompt(text);
    setOpen(true);
  }

  function handleSubmit() {
    // mock api request here

    // for now close the dialog.
    setOpen(false);
    if (onSave) onSave();
  }
  return (
    // main msg container
    <div className="flex flex-col items-end gap-1 group">
      <div className="flex justify-end w-full">
        <Card className="py-[10px] max-w-[90%]">
          <CardContent className="px-[10px] text-sm lg:text-md break-words">
            <p>{text}</p>
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

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Save prompt</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
