import { useState, useEffect } from "react";
import { Outlet, useParams, useNavigate } from "react-router";
import { TextbookViewProvider } from "@/providers/TextbookViewContext";
import { SidebarProvider } from "@/providers/SidebarContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SideBar from "@/components/ChatInterface/SideBar";
import type { Textbook } from "@/types/Textbook";
import type { ChatSession } from "@/providers/textbookView";
import { useUserSession } from "@/providers/usersession";
import HomePageHeader from "@/components/HomePageHeader";

export default function TextbookLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userSessionId } = useUserSession();

  const [textbook, setTextbook] = useState<Textbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(
    null
  );
  const [isLoadingChatSessions, setIsLoadingChatSessions] = useState(true);

  // Fetch textbook data
  useEffect(() => {
    const fetchTextbook = async () => {
      try {
        // Get public token first
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResponse.ok) throw new Error("Failed to get public token");
        const { token } = await tokenResponse.json();

        // Make authenticated request
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Textbook not found");
        }
        const data = await response.json();
        setTextbook(data);
        console.log("Fetched textbook:", data);
      } catch (err) {
        setError(err as Error);
        console.error("Error fetching textbook:", err);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchTextbook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch chat sessions for this textbook
  const fetchChatSessions = async () => {
    if (!id || !userSessionId) {
      return;
    }

    setIsLoadingChatSessions(true);
    try {
      const tokenResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (!tokenResponse.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResponse.json();

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/textbooks/${id}/chat_sessions/user/${userSessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch chat sessions");
      }

      const sessions: ChatSession[] = await response.json();
      console.log("Fetched chat sessions:", sessions);
      setChatSessions(sessions || []);

      // If no active session is set and we have sessions, set the most recent one
      if (!activeChatSessionId && sessions.length > 0) {
        setActiveChatSessionId(sessions[0].id);
      }
    } catch (err) {
      console.error("Error fetching chat sessions:", err);
    } finally {
      setIsLoadingChatSessions(false);
    }
  };

  useEffect(() => {
    fetchChatSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userSessionId]);

  // Create a new chat session
  const createNewChatSession = async (): Promise<ChatSession | null> => {
    if (!id || !userSessionId) return null;

    try {
      const tokenResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (!tokenResponse.ok) throw new Error("Failed to get public token");
      const { token } = await tokenResponse.json();

      const createResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${id}/chat_sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_sessions_session_id: userSessionId,
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error("Failed to create chat session");
      }

      const newSession: ChatSession = await createResponse.json();

      // Add to the list and set as active
      setChatSessions((prev) => [newSession, ...prev]);
      setActiveChatSessionId(newSession.id);

      return newSession;
    } catch (err) {
      console.error("Error creating chat session:", err);
      return null;
    }
  };

  const refreshChatSessions = async () => {
    await fetchChatSessions();
  };

  // Update chat session name locally
  const updateChatSessionName = (sessionId: string, name: string) => {
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, name } : session
      )
    );
  };

  // Show loading screen while fetching initial data
  if (loading || isLoadingChatSessions) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <HomePageHeader />
        <div className="pt-[70px] flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TextbookViewProvider
      value={{
        textbook,
        loading,
        error,
        chatSessions,
        activeChatSessionId,
        setActiveChatSessionId,
        isLoadingChatSessions,
        createNewChatSession,
        refreshChatSessions,
        updateChatSessionName,
      }}
    >
      <SidebarProvider>
        <div className="flex flex-col min-h-screen bg-background">
          <Header />
          <div className="pt-[70px] flex flex-1">
            <SideBar
              textbookTitle={textbook?.title || ""}
              textbookAuthor={textbook?.authors?.join(", ") || ""}
              textbookId={id}
              textbookSourceUrl={textbook?.source_url}
            />
            <div className="md:ml-64 flex flex-col flex-1">
              <main className="flex-1 flex flex-col items-center justify-center max-w-screen">
                <Outlet />
              </main>
              <Footer />
            </div>
          </div>
        </div>
      </SidebarProvider>
    </TextbookViewProvider>
  );
}
