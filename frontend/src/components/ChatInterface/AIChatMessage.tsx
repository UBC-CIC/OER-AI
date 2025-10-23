import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";

type AIChatMessageProps = {
  text: string;
  sources?: string[];
};

export default function AIChatMessage({
  text,
  sources = [],
}: AIChatMessageProps) {
  const [showSources, setShowSources] = useState(false);

  const formatSource = (source: string) => {
    // Check if source contains URL
    const urlMatch = source.match(/(https?:\/\/[^\s]+)/g);

    // Check if source contains page reference (p. X)
    const pageMatch = source.match(/\(p\.\s*(\d+)\)/i);

    if (urlMatch) {
      // Format URL sources
      return (
        <div className="flex flex-col w-full">
          <div className="flex items-center gap-1.5">
            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-xs">Source link:</span>
          </div>
          <a
            href={urlMatch[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline hover:text-primary/80 transition-colors break-words pl-4 text-xs"
            title={urlMatch[0]}
          >
            {urlMatch[0]}
          </a>
          {pageMatch && (
            <div className="pl-4 mt-1">
              <span className="text-muted-foreground text-xs font-medium">
                Page: {pageMatch[1]}
              </span>
            </div>
          )}
        </div>
      );
    } else {
      // Format textbook sources or other references
      return (
        <div className="flex flex-col w-full">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-xs">Source:</span>
          </div>
          <span className="text-muted-foreground break-words pl-4 text-xs">
            {source}
          </span>
        </div>
      );
    }
  };

  return (
    <div className="flex justify-start">
      <Card className="py-[10px] w-full bg-transparent border-none shadow-none">
        <CardContent className="px-[10px] text-sm break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
            components={{
              // Headers
              h1: ({ ...props }) => (
                <h1 className="text-xl font-bold mb-4 mt-6" {...props} />
              ),
              h2: ({ ...props }) => (
                <h2 className="text-lg font-bold mb-3 mt-5" {...props} />
              ),
              h3: ({ ...props }) => (
                <h3 className="text-base font-bold mb-2 mt-4" {...props} />
              ),
              h4: ({ ...props }) => (
                <h4 className="text-sm font-bold mb-2 mt-4" {...props} />
              ),

              // Basic text elements
              p: ({ ...props }) => <p className="mb-4 last:mb-0" {...props} />,

              // Lists
              ul: ({ ...props }) => (
                <ul className="list-disc pl-5 mb-4" {...props} />
              ),
              ol: ({ ...props }) => (
                <ol className="list-decimal pl-5 mb-4" {...props} />
              ),
              li: ({ ...props }) => <li className="mb-1" {...props} />,

              // Links
              a: ({ ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                />
              ),

              // Code
              code: ({ className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match && props.inline;
                return isInline ? (
                  <code
                    className="px-1 py-0.5 bg-muted rounded text-xs"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code
                    className="block p-2 bg-muted rounded-md text-xs overflow-auto"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              pre: ({ ...props }) => (
                <pre
                  className="bg-muted p-2 rounded-md overflow-auto text-xs my-2"
                  {...props}
                />
              ),

              // Quotes
              blockquote: ({ ...props }) => (
                <blockquote
                  className="pl-4 border-l-4 border-muted italic my-4"
                  {...props}
                />
              ),

              // Horizontal Rule
              hr: () => <hr className="my-6 border-t border-muted" />,

              // Tables
              table: ({ ...props }) => (
                <div className="overflow-x-auto">
                  <table
                    className="border-collapse border border-muted text-xs w-full my-4"
                    {...props}
                  />
                </div>
              ),
              th: ({ ...props }) => (
                <th
                  className="border border-muted px-2 py-1 bg-muted"
                  {...props}
                />
              ),
              td: ({ ...props }) => (
                <td className="border border-muted px-2 py-1" {...props} />
              ),

              // Images
              img: ({ ...props }) => (
                <img
                  className="max-w-full h-auto my-4"
                  {...props}
                  alt={props.alt || ""}
                />
              ),
            }}
          >
            {text}
          </ReactMarkdown>

          {sources && sources.length > 0 && (
            <div className="mt-4 border-t border-muted pt-2">
              <Button
                variant="link"
                size="sm"
                className="flex items-center gap-1 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setShowSources(!showSources)}
              >
                <BookOpen className="h-3 w-3" />
                {showSources ? "Hide sources" : "Show sources"} (
                {sources.length})
                {showSources ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>

              {showSources && (
                <div className="mt-3 w-full">
                  <p className="text-sm font-medium mb-2 text-foreground/80">
                    References:
                  </p>
                  <ul className="space-y-4 list-none pl-0 w-full">
                    {sources.map((source, index) => (
                      <li
                        key={index}
                        className="w-full bg-muted/30 p-2 rounded-md border border-muted"
                      >
                        {formatSource(source)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
