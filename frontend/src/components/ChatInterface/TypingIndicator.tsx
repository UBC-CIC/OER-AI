import { useEffect, useState } from "react";

interface TypingIndicatorProps {
  className?: string;
}

export default function TypingIndicator({
  className = "",
}: TypingIndicatorProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex items-center gap-3 text-muted-foreground/80 ${className}`}
    >
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s] [animation-duration:1.4s]"></div>
        <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s] [animation-duration:1.4s]"></div>
        <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-duration:1.4s]"></div>
      </div>
      <span className="text-sm font-medium">AI is thinking{dots}</span>
    </div>
  );
}
