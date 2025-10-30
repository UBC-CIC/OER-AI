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