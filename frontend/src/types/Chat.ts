export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  visibility: string;
  created_at: string;
};

export interface SharedUserPrompt {
  id: string;
  title: string;
  prompt_text: string;
  owner_session_id: string;
  owner_user_id: string;
  textbook_id: string;
  visibility: string;
  role: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  metadata: any;
}

export interface GuidedPromptQuestion {
  id: string;
  question_text: string;
  order_index: number;
}

export interface GuidedPromptTemplate extends PromptTemplate {
  type: 'guided';
  questions: GuidedPromptQuestion[];
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  sources_used?: string[];
  time: number;
  isTyping?: boolean;
  isGuidedQuestion?: boolean;
  guidedData?: {
    templateId: string;
    questionIndex: number;
    totalQuestions: number;
  };
}