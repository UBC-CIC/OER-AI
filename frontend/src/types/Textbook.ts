export interface Textbook {
  id: string;
  title: string;
  authors: string[];
  publisher?: string;
  year?: number;
  summary?: string;
  language?: string;
  level?: string;
  created_at: string;
};