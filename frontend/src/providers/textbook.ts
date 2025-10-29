import { createContext, useContext } from 'react';
import type { Textbook } from '@/types/Textbook';

export type ChatSession = {
  id: string;
  textbook_id: string;
  user_sessions_session_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
};

export type TextbookContextType = {
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
};

export const TextbookContext = createContext<TextbookContextType | undefined>(undefined);

export function useTextbook() {
  const context = useContext(TextbookContext);
  if (!context) {
    throw new Error('useTextbook must be used within TextbookProvider');
  }
  return context;
}