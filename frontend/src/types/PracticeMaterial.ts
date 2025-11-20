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
  sources_used?: string[];
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
  sources_used?: string[];
}

// Short answer types
export interface ShortAnswerQuestion {
  id: string;
  questionText: string;
  context?: string;
  sampleAnswer: string;
  keyPoints?: string[];
  rubric?: string;
  expectedLength?: number;
}

export interface ShortAnswerData {
  title: string;
  questions: ShortAnswerQuestion[];
  sources_used?: string[];
}

// Union type for practice materials
export type PracticeMaterial = MCQQuizData | FlashcardSetData | ShortAnswerData;

// Type guard helpers
export function isMCQQuiz(material: PracticeMaterial): material is MCQQuizData {
  return 'questions' in material && 'questions' in material && material.questions.length > 0 && 'options' in material.questions[0];
}

export function isFlashcardSet(material: PracticeMaterial): material is FlashcardSetData {
  return 'cards' in material;
}

export function isShortAnswer(material: PracticeMaterial): material is ShortAnswerData {
  return 'questions' in material && material.questions.length > 0 && 'sampleAnswer' in material.questions[0];
}