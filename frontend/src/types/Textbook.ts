export interface Textbook {
  id: string;
  title: string;
  authors: string[];
  publisher?: string;
  year?: number;
  summary?: string;
  language?: string;
  level?: string;
  source_url?: string;
  textbook_logo_url?: string;
  created_at: string;
}
