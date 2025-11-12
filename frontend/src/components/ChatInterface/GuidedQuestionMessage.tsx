import { Card, CardContent } from "@/components/ui/card";

type GuidedQuestionMessageProps = {
  text: string;
  questionIndex: number;
  totalQuestions: number;
};

export default function GuidedQuestionMessage({
  text,
  questionIndex,
  totalQuestions,
}: GuidedQuestionMessageProps) {
  return (
    <div className="flex justify-start">
      <Card className="py-[10px] w-full bg-transparent border-none shadow-none">
        <CardContent className="px-[10px] text-sm break-words">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Question {questionIndex + 1} of {totalQuestions}
            </span>
            <span className="text-xs text-muted-foreground">
              Guided Prompt
            </span>
          </div>
          <p className="mb-0">{text}</p>
        </CardContent>
      </Card>
    </div>
  );
}