export interface MCQOption {
  id: string;
  text: string;
  explanation: string; 
}

export interface MCQQuestion {
  id: string;
  questionText: string;
  options: MCQOption[];
  correctAnswer: string;
}

export interface MCQQuizData {
  title: string;
  questions: MCQQuestion[];
}

export interface QuestionAnswer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  hasSubmitted: boolean;
}

// Flashcard types
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string;
}

export interface FlashcardSetData {
  title: string;
  cards: Flashcard[];
  metadata?: {
    difficulty: string;
    cardType: string;
    topic: string;
  };
}

// Union type for practice materials
export type PracticeMaterial = MCQQuizData | FlashcardSetData;

// Type guard helpers
export function isMCQQuiz(material: PracticeMaterial): material is MCQQuizData {
  return 'questions' in material;
}

export function isFlashcardSet(material: PracticeMaterial): material is FlashcardSetData {
  return 'cards' in material;
}