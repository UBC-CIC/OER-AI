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
  created_at: string;
}
