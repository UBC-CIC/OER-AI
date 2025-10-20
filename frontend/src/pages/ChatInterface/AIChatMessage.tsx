import { Card, CardContent } from "@/components/ui/card";

// temporary props for future api calla

type AIChatMessageProps = {
  text: string;
};

export default function AIChatMessage({ text }: AIChatMessageProps) {
  return (
    <div className="flex justify-start">
      <Card className="py-[10px] w-full bg-transparent border-none shadow-none">
        <CardContent className="px-[10px] text-sm break-words">
          <p>{text}</p>
        </CardContent>
      </Card>
    </div>
  );
}
