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