import { useState } from 'react';
import { GenerateForm } from '@/components/PracticeMaterialPage/GenerateForm';
import { MCQQuiz } from '@/components/PracticeMaterialPage/MCQQuiz';
import type { MCQQuizData } from '@/types/PracticeMaterial';

// Dummy MCQ data
const dummyQuiz: MCQQuizData = {
  title: 'Calculus Practice Quiz',
  questions: [
    {
      id: '1',
      questionText: 'What is the derivative of x²?',
      options: [
        { id: 'a', text: 'x', explanation: 'Incorrect. The derivative of x² is 2x, not x.' },
        { id: 'b', text: '2x', explanation: 'Correct! Using the power rule, d/dx(x²) = 2x.' },
        { id: 'c', text: 'x²', explanation: 'Incorrect. This is the original function, not its derivative.' },
        { id: 'd', text: '2', explanation: 'Incorrect. This would be the derivative of 2x, not x².' }
      ],
      correctAnswer: 'b'
    },
    {
      id: '2',
      questionText: 'What is the integral of 2x?',
      options: [
        { id: 'a', text: 'x² + C', explanation: 'Correct! The integral of 2x is x² + C.' },
        { id: 'b', text: '2x² + C', explanation: 'Incorrect. This would be the integral of 4x.' },
        { id: 'c', text: 'x + C', explanation: 'Incorrect. This would be the integral of 1.' },
        { id: 'd', text: '2 + C', explanation: 'Incorrect. This would be the integral of a constant.' }
      ],
      correctAnswer: 'a'
    }
  ]
};

export default function PracticeMaterialPage() {
  const [quizzes, setQuizzes] = useState<MCQQuizData[]>([dummyQuiz]);

  const handleGenerate = (formData: unknown) => {
    console.log('Generate form data:', formData);
  };

  const handleDeleteQuiz = (index: number) => {
    setQuizzes((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-center gap-6">

        <div className="w-full md:w-[30%]">
          <GenerateForm onGenerate={handleGenerate} />
        </div>

        <div className="w-full md:w-[70%] space-y-6">
          <h2 className="text-2xl font-semibold">Practice Questions</h2>
          {quizzes.map((quiz, index) => (
            <MCQQuiz
              key={index}
              title={quiz.title}
              questions={quiz.questions}
              onDelete={() => handleDeleteQuiz(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}