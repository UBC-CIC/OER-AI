import jsPDF from "jspdf";
import type { IH5PMinimalQuestionSet, IH5PAnswerOption } from "@/types/MaterialEditor";
import { isMultiChoiceQuestion, isEssayQuestion, isFlashcard } from "@/types/MaterialEditor";

/**
 * Export options for PDF generation
 */
export interface PDFExportOptions {
  style: "worksheet" | "answer-key";
  title?: string;
  includeExplanations?: boolean;
}

/**
 * Generates a PDF from a question set
 * @param questionSet - The H5P question set to export
 * @param options - Export options (worksheet or answer key style)
 */
export function exportQuestionSetAsPDF(
  questionSet: IH5PMinimalQuestionSet,
  options: PDFExportOptions
): void {
  const { style, title = "Practice Quiz", includeExplanations = true } = options;

  // Initialize jsPDF (Letter size, portrait orientation)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter", // 8.5" x 11"
  });

  // Page setup constants
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20; // 20mm margins
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (currentY + requiredSpace > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // Helper function to wrap text
  const addWrappedText = (
    text: string,
    x: number,
    fontSize: number = 11,
    maxWidth: number = contentWidth,
    bold: boolean = false
  ): number => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 0.5; // Convert font size to mm (approximate)
    
    checkPageBreak(lines.length * lineHeight + 5);
    
    lines.forEach((line: string, index: number) => {
      doc.text(line, x, currentY + index * lineHeight);
    });
    
    currentY += lines.length * lineHeight;
    return lines.length * lineHeight;
  };

  // Add title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, currentY, { align: "center" });
  currentY += 10;

  // Add subtitle based on style
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  if (style === "answer-key") {
    doc.text("Answer Key", pageWidth / 2, currentY, { align: "center" });
    currentY += 8;
  } else {
    doc.text("Instructions: Choose the best answer for each question.", margin, currentY);
    currentY += 8;
  }

  // Add separator line
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Process each question
  questionSet.questions.forEach((question, qIndex) => {
    const questionNumber = qIndex + 1;
    
    // Handle Multi-Choice Questions
    if (isMultiChoiceQuestion(question)) {
      const { question: questionText, answers } = question.params;

    // Check if we need a new page for this question
    checkPageBreak(30); // Minimum space needed for a question

    // Question number and text
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Question ${questionNumber}:`, margin, currentY);
    currentY += 6;

    addWrappedText(questionText, margin, 11, contentWidth, false);
    currentY += 4;

    // Answer options
    answers.forEach((answer, aIndex) => {
      const optionLetter = String.fromCharCode(65 + aIndex); // A, B, C, D...
      const isCorrect = answer.correct;

      // Detect if the answer text already includes the option letter at the start
      // Matches forms like "A. ", "A) ", "(A) ", "[A] ", "A: ", "A - ", etc.
      const leadingOptionRegex = new RegExp(`^\\s*(?:\\(|\\[)?${optionLetter}(?:\\)|\\]|\\.|:|\\-|\\–)?\\s+`, "i");
      const hasOptionPrefix = leadingOptionRegex.test(answer.text);

      checkPageBreak(15);

      // Option label
      doc.setFontSize(11);

      // Choose where to render the answer text. If the text already contains the option
      // letter, render the text closer to the left (where the letter would otherwise appear),
      // and don't print our own separate option text. Otherwise, print the letter and
      // indent the answer text.
      const labelX = margin + 5;
      const defaultTextX = margin + 12;
      const textX = hasOptionPrefix ? labelX : defaultTextX;
      const textMaxWidth = contentWidth - (textX - margin);

      if (style === "answer-key" && isCorrect) {
        // Highlight correct answer
        doc.setFont("helvetica", "bold");
        if (!hasOptionPrefix) {
          doc.text(`${optionLetter}.`, labelX, currentY);
        }
        doc.text("✓", margin, currentY); // Checkmark
        addWrappedText(answer.text, textX, 11, textMaxWidth, true);
      } else {
        doc.setFont("helvetica", "normal");
        if (!hasOptionPrefix) {
          doc.text(`${optionLetter}.`, labelX, currentY);
        }
        addWrappedText(answer.text, textX, 11, textMaxWidth, false);
      }

      currentY += 2;
    });

    // Add explanations for answer key style
    if (style === "answer-key" && includeExplanations) {
      currentY += 3;
      
      // Find correct answer for explanation
  const correctAnswer = answers.find((a: IH5PAnswerOption) => a.correct);
      if (correctAnswer?.tipsAndFeedback) {
        const feedback = correctAnswer.tipsAndFeedback;
        
        if (feedback.chosenFeedback) {
          checkPageBreak(15);
          doc.setFontSize(10);
          doc.setFont("helvetica", "italic");
          doc.text("Explanation:", margin + 5, currentY);
          currentY += 4;
          addWrappedText(
            feedback.chosenFeedback,
            margin + 5,
            10,
            contentWidth - 5,
            false
          );
          currentY += 2;
        }

        if (feedback.tip) {
          checkPageBreak(15);
          doc.setFontSize(10);
          doc.setFont("helvetica", "italic");
          doc.text("Tip:", margin + 5, currentY);
          currentY += 4;
          addWrappedText(feedback.tip, margin + 5, 10, contentWidth - 5, false);
          currentY += 2;
        }
      }
    }

      // Space between questions
      currentY += 8;
      return; // End MCQ processing
    }

    // Handle Essay Questions
    if (isEssayQuestion(question)) {
      const { taskDescription, keywords } = question.params;

      // Check if we need a new page for this question
      checkPageBreak(30);

      // Question number and text
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Question ${questionNumber}:`, margin, currentY);
      currentY += 6;

      addWrappedText(taskDescription, margin, 11, contentWidth, false);
      currentY += 6;

      // Add answer space for worksheet style
      if (style === "worksheet") {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Answer:", margin, currentY);
        currentY += 6;

        // Draw lines for writing
        const numLines = 8;
        const lineSpacing = 7;
        for (let i = 0; i < numLines; i++) {
          checkPageBreak(lineSpacing + 2);
          doc.setLineWidth(0.2);
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, currentY, pageWidth - margin, currentY);
          currentY += lineSpacing;
        }
        currentY += 4;
      }

      // Add keywords and rubric for answer key style
      if (style === "answer-key" && keywords && keywords.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Key Points to Include:", margin + 5, currentY);
        currentY += 5;

        doc.setFont("helvetica", "normal");
        keywords.forEach((kw) => {
          checkPageBreak(10);
          const keywordText = `• ${kw.keyword}${
            kw.alternatives && kw.alternatives.length > 0
              ? ` (or: ${kw.alternatives.join(", ")})`
              : ""
          }`;
          addWrappedText(keywordText, margin + 8, 10, contentWidth - 8, false);
          currentY += 2;

          if (kw.options?.feedbackIncluded) {
            doc.setFont("helvetica", "italic");
            addWrappedText(
              `  ${kw.options.feedbackIncluded}`,
              margin + 10,
              9,
              contentWidth - 10,
              false
            );
            doc.setFont("helvetica", "normal");
            currentY += 2;
          }
        });
        currentY += 4;
      }

      // Space between questions
      currentY += 8;
      return; // End Essay processing
    }

    // Handle Flashcards
    if (isFlashcard(question)) {
      const { cards } = question.params;

      // Process each flashcard
      cards.forEach((card, cardIndex) => {
        const cardNumber = cardIndex + 1;

        // Check if we need a new page for this card
        checkPageBreak(30);

        // Card number and header
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Card ${cardNumber}:`, margin, currentY);
        currentY += 6;

        // Worksheet style: Show only front side with answer lines
        if (style === "worksheet") {
          // Front side (question/term)
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text("Front:", margin + 5, currentY);
          currentY += 5;

          doc.setFont("helvetica", "normal");
          addWrappedText(card.text, margin + 5, 11, contentWidth - 5, false);
          currentY += 6;

          // Answer space
          doc.setFontSize(10);
          doc.setFont("helvetica", "italic");
          doc.text("Answer:", margin + 5, currentY);
          currentY += 6;

          // Draw lines for writing the answer
          const numLines = 4;
          const lineSpacing = 7;
          for (let i = 0; i < numLines; i++) {
            checkPageBreak(lineSpacing + 2);
            doc.setLineWidth(0.2);
            doc.setDrawColor(200, 200, 200);
            doc.line(margin + 5, currentY, pageWidth - margin, currentY);
            currentY += lineSpacing;
          }
          currentY += 6;
        }

        // Answer key style: Show front, back, and tip
        if (style === "answer-key") {
          // Front side
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text("Front:", margin + 5, currentY);
          currentY += 5;

          doc.setFont("helvetica", "normal");
          addWrappedText(card.text, margin + 5, 11, contentWidth - 5, false);
          currentY += 5;

          // Back side
          doc.setFont("helvetica", "bold");
          doc.text("Back:", margin + 5, currentY);
          currentY += 5;

          doc.setFont("helvetica", "normal");
          addWrappedText(card.answer, margin + 5, 11, contentWidth - 5, false);
          currentY += 5;

          // Tip (if available)
          if (card.tip) {
            checkPageBreak(15);
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            doc.text("Tip:", margin + 5, currentY);
            currentY += 4;
            addWrappedText(card.tip, margin + 5, 10, contentWidth - 5, false);
            currentY += 3;
          }
        }

        // Space between cards
        currentY += 6;
      });

      // Extra space after all cards in the set
      currentY += 2;
      return; // End Flashcard processing
    }
  });

  // Add footer with page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Generate filename
  const timestamp = new Date().toISOString().split("T")[0];
  const styleLabel = style === "answer-key" ? "AnswerKey" : "Worksheet";
  const filename = `${title.replace(/[^a-z0-9]/gi, "_")}_${styleLabel}_${timestamp}.pdf`;

  // Save the PDF
  doc.save(filename);
}
