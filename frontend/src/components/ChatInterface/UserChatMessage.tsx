import { Card, CardContent } from "@/components/ui/card";

// temporary props for future api calla
type UserChatMessageProps = {
  text: string;
};

export default function UserChatMessage({ text }: UserChatMessageProps) {
  return (
    <div className="flex justify-end">
      <Card className="py-[10px] max-w-[90%]">
        <CardContent className="px-[10px] text-sm lg:text-md break-words">
          <p>{text}</p>
        </CardContent>
      </Card>
    </div>
  );
}
