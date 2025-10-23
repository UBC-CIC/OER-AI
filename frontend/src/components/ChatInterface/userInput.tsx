import { useRef, useEffect, useMemo, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  highlightPattern?: RegExp;
  highlightClassName?: string;
  disabled?: boolean;
  className?: string;
  onSend?: () => void;
}

export function AiChatInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type your message...",
  highlightPattern = /\[([^\]]+)\]/g,
  highlightClassName = "text-blue-500 font-medium bg-blue-500/10 px-1 rounded",
  disabled = false,
  className,
  onSend,
}: AiChatInputProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const isUpdatingRef = useRef(false);

  // Memoize regex to avoid recreating on every render
  const regex = useMemo(
    () => new RegExp(highlightPattern.source, highlightPattern.flags),
    [highlightPattern.source, highlightPattern.flags]
  );

  // Get plain text content from the editable div
  const getTextContent = (): string => {
    return editableRef.current?.textContent || "";
  };

  // Parse and highlight text based on regex pattern
  const highlightText = (text: string): string => {
    if (!text) return "";

    let result = "";
    let lastIndex = 0;
    // Reset regex state
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        result += escapeHtml(text.slice(lastIndex, match.index));
      }

      // Add highlighted match
      result += `<span class="${highlightClassName}">${escapeHtml(
        match[0]
      )}</span>`;
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result += escapeHtml(text.slice(lastIndex));
    }

    return result;
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  // Save and restore cursor position
  const saveCursorPosition = (): number => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editableRef.current!);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    return preCaretRange.toString().length;
  };

  const restoreCursorPosition = (position: number) => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return;

    let charCount = 0;
    let foundPosition = false;

    // Use a tree walker for more efficient traversal
    const walker = document.createTreeWalker(
      editableRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
      const nextCharCount = charCount + textNode.length;

      if (
        !foundPosition &&
        position >= charCount &&
        position <= nextCharCount
      ) {
        const range = document.createRange();
        range.setStart(
          textNode,
          Math.min(position - charCount, textNode.length)
        );
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        foundPosition = true;
        break;
      }

      charCount = nextCharCount;
    }
  };

  const handleInput = () => {
    if (isComposingRef.current || !editableRef.current || isUpdatingRef.current)
      return;

    const cursorPosition = saveCursorPosition();
    const text = getTextContent();

    // Call parent's onChange with plain text
    onChange(text);

    // Update highlighting immediately to prevent stale blue backgrounds
    const highlighted = highlightText(text);
    if (editableRef.current.innerHTML !== highlighted) {
      isUpdatingRef.current = true;
      editableRef.current.innerHTML = highlighted || "";
      restoreCursorPosition(cursorPosition);
      isUpdatingRef.current = false;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);

    // If parent didn't prevent default and it's Enter without Shift, trigger send
    if (!e.defaultPrevented && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
  };

  // Handle composition events for IME input
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  useEffect(() => {
    if (!editableRef.current || isUpdatingRef.current) return;

    const currentText = getTextContent();
    if (currentText !== value) {
      const cursorPosition = saveCursorPosition();
      isUpdatingRef.current = true;

      if (value === "") {
        editableRef.current.innerHTML = "";
      } else {
        editableRef.current.innerHTML = highlightText(value);
      }

      // Only restore cursor if we had focus
      if (document.activeElement === editableRef.current) {
        restoreCursorPosition(cursorPosition);
      }

      isUpdatingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full", className)}>
      {/* ContentEditable div with direct text highlighting */}
      <div
        ref={editableRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        spellCheck={false}
        className={cn(
          "bg-input border border-[var(--border)] rounded-md h-[120px] pr-12 resize-none text-sm overflow-auto",
          "px-3 py-2 whitespace-pre-wrap break-words outline-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
        data-placeholder={placeholder}
        style={{
          // Show placeholder when empty
          ...(value === "" && {
            position: "relative",
          }),
        }}
        role="textbox"
        aria-multiline="true"
        aria-label="Chat message input"
        aria-placeholder={placeholder}
      />

      {value === "" && (
        <div className="absolute top-0 left-0 px-3 py-2 text-sm text-muted-foreground pointer-events-none">
          {placeholder}
        </div>
      )}

      <Button
        onClick={onSend}
        size="icon"
        variant="link"
        className="cursor-pointer absolute bottom-3 right-3 h-8 w-8 text-muted-foreground hover:text-gray-900 transition-colors"
        disabled={disabled}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
