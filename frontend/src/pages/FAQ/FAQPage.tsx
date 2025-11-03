import { FaqCard } from "@/components/FAQPage/FaqCard";
import { FaqListItem } from "@/components/FAQPage/FaqListItem";
import type { FAQ } from "@/types/FAQ";

const faqData: FAQ[] = [
  {
    id: "1",
    question_text: "Give 5 MCQ's on double integrations",
    answer_text: "Here are 5 multiple choice questions on double integrations covering key concepts like setting up bounds, changing order of integration, and applications to area and volume calculations.",
    usage_count: 400,
    last_used_at: "2025-10-29T14:30:00Z",
    cached_at: "2025-10-15T10:00:00Z",
  },
  {
    id: "2",
    question_text: "Flashcards on calculating volume of a sphere",
    answer_text: "Flashcards covering sphere volume calculations using triple integrals in spherical coordinates, including step-by-step derivations and practice problems.",
    usage_count: 350,
    last_used_at: "2025-10-29T12:15:00Z",
    cached_at: "2025-10-14T09:30:00Z",
  },
  {
    id: "3",
    question_text: "Real world applications of Calculus 3",
    answer_text: "Calculus 3 is used in physics for electromagnetic fields, in engineering for stress analysis, in computer graphics for 3D rendering, and in economics for optimization problems with multiple variables.",
    usage_count: 334,
    last_used_at: "2025-10-29T11:45:00Z",
    cached_at: "2025-10-13T16:20:00Z",
  },
  {
    id: "4",
    question_text: "What are partial derivatives and why are they important",
    answer_text: "Partial derivatives measure how a multivariable function changes with respect to one variable while holding others constant. They're essential for optimization, gradient calculations, and understanding rates of change in multidimensional systems.",
    usage_count: 320,
    last_used_at: "2025-10-28T18:20:00Z",
    cached_at: "2025-10-12T14:10:00Z",
  },
  {
    id: "5",
    question_text: "How do double and triple integrals work?",
    answer_text: "Double integrals compute area or volume over 2D regions by integrating twice. Triple integrals extend this to 3D regions. The order of integration can often be changed to simplify calculations.",
    usage_count: 289,
    last_used_at: "2025-10-28T15:30:00Z",
    cached_at: "2025-10-11T11:00:00Z",
  },
  {
    id: "6",
    question_text: "When to use Lagrange multipliers?",
    answer_text: "Use Lagrange multipliers to find extrema of a function subject to equality constraints. It's particularly useful when constraints make direct optimization difficult or impossible.",
    usage_count: 271,
    last_used_at: "2025-10-27T09:45:00Z",
    cached_at: "2025-10-10T13:30:00Z",
  },
  {
    id: "7",
    question_text: "How to visualise 3d surfaces and curves?",
    answer_text: "Use level curves, cross-sections, parametric plots, and 3D graphing tools. Understanding contour maps and gradient fields helps visualize multivariable functions and their behavior.",
    usage_count: 174,
    last_used_at: "2025-10-26T14:20:00Z",
    cached_at: "2025-10-09T10:15:00Z",
  },
  {
    id: "8",
    question_text: "Why use different coordinate systems?",
    answer_text: "Different coordinate systems (Cartesian, cylindrical, spherical) simplify calculations based on problem symmetry. Cylindrical coordinates work well for cylinders, while spherical coordinates are ideal for spheres.",
    usage_count: 83,
    last_used_at: "2025-10-25T16:00:00Z",
    cached_at: "2025-10-08T08:45:00Z",
  },
];

// at most only have 20?

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            Frequently Asked Questions
          </h1>
        </div>

        {/* Mobile: List View */}
        <div className="sm:hidden bg-card rounded-lg border border-border overflow-hidden">
          {faqData.map((faq) => (
            <FaqListItem
              key={faq.id}
              question={faq.question_text}
              count={faq.usage_count}
              onClick={() => {
                console.log(`Clicked: ${faq.question_text}`);
              }}
            />
          ))}
        </div>

        {/* Desktop/Tablet: Card Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {faqData.map((faq) => (
            <FaqCard
              key={faq.id}
              question={faq.question_text}
              count={faq.usage_count}
              onClick={() => {
                console.log(`Clicked: ${faq.question_text}`);
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
