import HomePageHeader from "@/components/HomePageHeader";
import Footer from "@/components/Footer";
import TextbookCard from "@/components/HomePage/TextbookCard";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { Textbook } from "@/types/Textbook";

// Define a custom UUID type to avoid the crypto module import
type UUID = string;

type TextbookForCard = {
  id: UUID;
  title: string;
  author: string[];
  category: string;
  logo_url?: string;
};

export default function HomePage() {
  const [userSearch, setUserSearch] = useState<string>("");
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<TextbookForCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check if user has seen the welcome message
  useEffect(() => {
    try {
      const hasSeenWelcome = localStorage.getItem("hasSeenWelcome");
      if (!hasSeenWelcome) {
        setShowWelcome(true);
        localStorage.setItem("hasSeenWelcome", "true");
      }
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
  }, []);

  // Fetch textbooks from API
  useEffect(() => {
    const fetchTextbooks = async () => {
      try {
        // Get public token
        const tokenResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResp.ok) throw new Error("Failed to get public token");
        const { token } = await tokenResp.json();

        // Use the token to fetch textbooks
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/textbooks`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();
        setTextbooks(data.textbooks || []);
      } catch (error) {
        console.error("Error fetching textbooks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTextbooks();
  }, []);

  // Convert API textbooks to card format and apply search filtering
  useEffect(() => {
    const convertedBooks: TextbookForCard[] = textbooks.map((book) => ({
      id: book.id, // Use book's ID for card component
      title: book.title,
      author: book.authors || [],
      category: book.level || "General",
      logo_url: book.textbook_logo_url,
    }));

    const q = userSearch.trim().toLowerCase();
    if (!q) {
      setFilteredBooks(convertedBooks);
      return;
    }

    setFilteredBooks(
      convertedBooks.filter(
        (textbook) =>
          textbook.title.toLowerCase().includes(q) ||
          textbook.author.join(" ").toLowerCase().includes(q)
      )
    );
  }, [textbooks, userSearch]);

  return (
    <div className="pt-[70px] flex min-h-screen flex-col bg-background">
      <HomePageHeader />

      {/* Welcome Dialog */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Welcome to Opterna
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed pt-4 space-y-4">
              <p>
                Welcome to Opterna - the open AI study companion created by BCcampus, 
                UBC Cloud Innovation Centre, students, and faculty and generously funded 
                by the William and Flora Hewlett Foundation.
              </p>
              <p>
                Opterna is informed by Socratic questioning and dialogic approaches to 
                learning and a growth mindset. We encourage you to take your learning 
                beyond interacting with Opterna and out into your study groups, your 
                work with teaching assistants, faculty, and others.
              </p>
              <p>
                Opterna will prompt you to extend your thinking and offer support as you 
                develop new connections and explore different ways of thinking about topics.
              </p>
              <p className="font-semibold">
                Be curious and happy learning!
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <main className="container mx-auto flex-1 flex-col justify-center px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {/* Hero Section */}
          <div className="mb-12 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-5xl font-bold tracking-tight text-primary">
              BCcampus Textbook Catalogue
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Select a textbook to get started with your AI-powered learning
              journey
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative mx-auto mb-12 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by Title or Author"
              className="h-12 bg-input border pl-10 text-base shadow-sm"
              onChange={(e) => {
                setUserSearch(e.target.value);
              }}
            />
          </div>

          {/* Textbook Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              <div className="col-span-full text-center py-8">
                <p>Loading textbooks...</p>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p>No textbooks found.</p>
              </div>
            ) : (
              filteredBooks.map((textbook) => (
                <TextbookCard key={textbook.id} textbook={textbook} />
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
