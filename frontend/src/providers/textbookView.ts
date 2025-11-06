import { createContext, useContext } from "react";
import type { Textbook } from "@/types/Textbook";

export type ChatSession = {
  id: string;
  name: string;
  user_session_id: string;
  textbook_id: string;
  context?: unknown;
  created_at: string;
  metadata?: unknown;
};

export type TextbookViewContextType = {
  textbook: Textbook | null;
  loading: boolean;
  error: Error | null;

  // Chat session management
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  setActiveChatSessionId: (id: string) => void;
  isLoadingChatSessions: boolean;
  createNewChatSession: () => Promise<ChatSession | null>;
  refreshChatSessions: () => Promise<void>;
  updateChatSessionName: (sessionId: string, name: string) => void;
};

export const TextbookViewContext = createContext<
  TextbookViewContextType | undefined
>(undefined);

export function useTextbookView() {
  const context = useContext(TextbookViewContext);
  if (!context) {
    throw new Error("useTextbookView must be used within TextbookViewProvider");
  }
  return context;
}
