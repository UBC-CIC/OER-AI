import { Card, CardContent } from "@/components/ui/card";
import { SaveIcon } from "lucide-react";

// temporary props for future api calla
type UserChatMessageProps = {
  text: string;
};

export default function UserChatMessage({ text }: UserChatMessageProps) {
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
      <div className="pr-2">
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <SaveIcon className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  );
}
