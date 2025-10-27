import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { useUserSession } from "@/contexts/UserSessionContext";
import { useState } from "react";

type Textbook = {
  id: string | number;
  title: string;
  author: string[];
  category: string;
};

// Proper formatting of authors tags
function formatAuthors(authors: string[]) {
  if (!authors || authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return authors.slice(0, -1).join(", ") + " & " + authors[authors.length - 1];
}

export default function TextbookCard({ textbook }: { textbook: Textbook }) {
  const navigate = useNavigate();
  const { userSessionId } = useUserSession();
  const [isLoading, setIsLoading] = useState(false);

  const getOrCreateChatSession = async () => {
    if (!userSessionId || isLoading) return;
    
    setIsLoading(true);
    try {
      // Get public token
      const tokenResponse = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
      if (!tokenResponse.ok) throw new Error('Failed to get public token');
      const { token } = await tokenResponse.json();

      // First check for existing chat sessions for this textbook and user
      const existingResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbook.id}/chat_sessions/user/${userSessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!existingResponse.ok) {
        throw new Error('Failed to check existing chat sessions');
      }

      const existingSessions = await existingResponse.json();
      let chatSession;

      if (existingSessions && existingSessions.length > 0) {
        // Use the most recent chat session for this textbook
        chatSession = existingSessions[0]; // API returns them ordered by created_at DESC
        console.log('Reusing existing chat session:', chatSession.id);
      } else {
        // Create new chat session if none exists
        console.log('No existing chat session found, creating new one');
        const createResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/textbooks/${textbook.id}/chat_sessions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_sessions_session_id: userSessionId
            })
          }
        );

        if (!createResponse.ok) {
          throw new Error('Failed to create chat session');
        }

        chatSession = await createResponse.json();
        console.log('Created new chat session:', chatSession.id);
      }

      // Navigate to chat interface with the chat session
      navigate(`/textbook/${textbook.id}/chat`, { 
        state: { 
          textbook,
          chatSessionId: chatSession.id 
        } 
      });
    } catch (error) {
      console.error('Failed to get/create chat session:', error);
      // TODO: Show error toast/message to user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      key={textbook.id}
      onClick={() => {
        console.log("Textbook clicked", { id: textbook.id, title: textbook.title });
        if (!isLoading) {
          getOrCreateChatSession();
        }
      }}
      className={`flex flex-col items-start p-[10px] gap-4 not-odd:transition-shadow hover:shadow-lg cursor-pointer ${
        isLoading ? 'opacity-50' : ''
      }`}
    >
      <CardHeader className="flex-1 p-0 w-full">
        <CardTitle
          className="line-clamp-3 text-lg leading-[1.25] text-left overflow-hidden"
          style={{ minHeight: `calc(1em * 1.25 * 3)` }}
        >
          {textbook.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 w-full">
        <p className="truncate text-sm text-primary text-left">
          By {formatAuthors(textbook.author)}
        </p>
      </CardContent>
      <CardContent className="p-0 w-full">
        <p className="px-[10px] py-[5px] bg-primary text-primary-foreground border rounded-xl w-fit text-left">
          {textbook.category}
        </p>
      </CardContent>
    </Card>
  );
}
