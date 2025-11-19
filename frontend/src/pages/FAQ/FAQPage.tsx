import { FaqCard } from "@/components/FAQPage/FaqCard";
import { FaqListItem } from "@/components/FAQPage/FaqListItem";
import type { FAQ } from "@/types/FAQ";
import { useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";

export default function FAQPage() {
  const { id: textbookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFAQs = async () => {
      if (!textbookId) {
        setError("No textbook ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get public token
        const tokenResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResp.ok) {
          throw new Error("Failed to get authentication token");
        }
        const { token } = await tokenResp.json();

        // Fetch FAQs for this textbook
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbookId}/faq`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // No FAQs for this textbook yet
            setFaqs([]);
            return;
          }
          throw new Error(`Failed to fetch FAQs: ${response.statusText}`);
        }

        const data = await response.json();
        // Sort by usage count (descending)
        const sortedFaqs = (data || []).sort(
          (a: FAQ, b: FAQ) => b.usage_count - a.usage_count
        );
        setFaqs(sortedFaqs);
      } catch (err) {
        console.error("Error fetching FAQs:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load FAQs"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchFAQs();
  }, [textbookId]);

  const handleFaqClick = async (faq: FAQ) => {
    // Navigate to chat with pre-filled question
    navigate(`/textbook/${textbookId}/chat?question=${encodeURIComponent(faq.question_text)}`);

    // Increment usage count in background (fire and forget)
    try {
      const tokenResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (tokenResp.ok) {
        const { token } = await tokenResp.json();
        
        // Update usage count
        await fetch(`${import.meta.env.VITE_API_ENDPOINT}/faq/${faq.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            usage_count: faq.usage_count + 1,
            last_used_at: new Date().toISOString(),
          }),
        });
      }
    } catch (err) {
      console.error("Failed to update FAQ usage count:", err);
      // Don't block navigation on failure
    }
  };

  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
            Frequently Asked Questions
          </h1>
          {loading && (
            <p className="text-muted-foreground">Loading FAQs...</p>
          )}
          {error && (
            <p className="text-destructive">Error: {error}</p>
          )}
        </div>

        {!loading && !error && faqs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">
              No frequently asked questions yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Start asking questions in the chat to build up an FAQ library!
            </p>
          </div>
        )}

        {!loading && !error && faqs.length > 0 && (
          <>
            {/* Mobile: List View */}
            <div className="sm:hidden bg-card rounded-lg border border-border overflow-hidden">
              {faqs.map((faq) => (
                <FaqListItem
                  key={faq.id}
                  faqId={faq.id}
                  question={faq.question_text}
                  count={faq.usage_count}
                  onClick={() => handleFaqClick(faq)}
                />
              ))}
            </div>

            {/* Desktop/Tablet: Card Grid */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {faqs.map((faq) => (
                <FaqCard
                  key={faq.id}
                  faqId={faq.id}
                  question={faq.question_text}
                  count={faq.usage_count}
                  onClick={() => handleFaqClick(faq)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
