/**
 * Defines the options, points, and feedback for a single keyword.
 * This is nested inside IH5PEssayKeyword, matching the "options" group.
 */
export interface IH5PEssayKeywordOptions {
  points: number;
  occurrences: number;
  caseSensitive: boolean;
  forgiveMistakes: boolean;
  feedbackIncluded?: string;
  feedbackMissed?: string;
  feedbackIncludedWord: "keyword" | "alternative" | "answer" | "none";
  feedbackMissedWord: "keyword" | "none";
}

/**
 * Defines a single keyword object.
 * This corresponds to the "groupy" object in the semantics list.
 */
export interface IH5PEssayKeyword {
  keyword: string;
  alternatives?: string[]; // Optional list, min: 0
  options: IH5PEssayKeywordOptions;
}

/**
 * This is the core "params" object for an H5P.Essay question.
 * This is a MINIMAL version based on your request,
 * containing only the required fields.
 */
export interface IH5PEssayParams {
  taskDescription: string;
  keywords: IH5PEssayKeyword[]; // Required list, min: 1
  // All optional fields like media, solution, placeholder,
  // and behaviour have been removed as requested.
}



/**
 * Defines the optional feedback and tips for a single answer.
 * This is nested inside IH5PAnswerOption.
 */
export interface IH5PAnswerFeedback {
  tip?: string;
  chosenFeedback?: string;
  notChosenFeedback?: string;
}

/**
 * Defines a single answer option in a multiple-choice question.
 */
export interface IH5PAnswerOption {
  text: string;
  correct: boolean;
  tipsAndFeedback?: IH5PAnswerFeedback;
}

/**
 * This is the core "params" object for an H5P.MultiChoice question.
 * It contains only the required question text and answers array.
 */
export interface IH5PMultiChoiceParams {
  question: string;
  answers: IH5PAnswerOption[];
}

/**
 * This is the structure for one question *within* an H5P.QuestionSet (Quiz).
 * It requires the library name and the core parameters object.
 */
export interface I5HPMultiChoiceQuestion {
  /** * The H5P library type, e.g., "H5P.MultiChoice 1.17". */
  library: string;
  params: IH5PMultiChoiceParams;
}

export interface I5HPEssayQuestion {
  /** * The H5P library type, e.g., "H5P.Essay 1.3". */
  library: string;
  params: IH5PEssayParams;
}

/**
 * Union type for all H5P question types
 */
export type IH5PQuestion = I5HPMultiChoiceQuestion | I5HPEssayQuestion;

/**
 * Type guard to check if a question is a multiple choice question
 */
export function isMultiChoiceQuestion(question: IH5PQuestion): question is I5HPMultiChoiceQuestion {
  return question.library.startsWith("H5P.MultiChoice");
}

/**
 * Type guard to check if a question is an essay question
 */
export function isEssayQuestion(question: IH5PQuestion): question is I5HPEssayQuestion {
  return question.library.startsWith("H5P.Essay");
}

/**
 * This is the root-level object you should ask the LLM to generate.
 * It represents the minimal data payload for a list of questions.
 */
export interface IH5PMinimalQuestionSet {
  /** * The list of questions. */
  questions: I5HPMultiChoiceQuestion[] | I5HPEssayQuestion[];
}
