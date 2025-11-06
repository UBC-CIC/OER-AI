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
export interface IH5PQuestion {
  /** * The H5P library type, e.g., "H5P.MultiChoice 1.17". */
  library: string;
  params: IH5PMultiChoiceParams;
}

/**
 * This is the root-level object you should ask the LLM to generate.
 * It represents the minimal data payload for a list of questions.
 */
export interface IH5PMinimalQuestionSet {
  /** * The list of questions. */
  questions: IH5PQuestion[];
}
