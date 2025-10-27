import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface UserSessionContextType {
  userSessionId: string | null;
  sessionUuid?: string | null;
  isLoading: boolean;
  error: Error | null;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [userSessionId, setUserSessionId] = useState<string | null>(null);
  const [sessionUuid, setSessionUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const LOCAL_KEY = "oer_user_session";

  useEffect(() => {
    const validateSession = async (stored: { sessionUuid: string; userSessionId: string; createdAt?: string }) => {
      try {
        // get public token
        const tokenResp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
        if (!tokenResp.ok) return false;
        const { token } = await tokenResp.json();

        // Call a lightweight endpoint to validate session exists. Using interactions endpoint with limit=1.
        const validateResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user_sessions/${stored.sessionUuid}/interactions?limit=1`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        return validateResp.ok;
      } catch (e) {
        return false;
      }
    };

    const createUserSession = async () => {
      try {
        // First get a public token
        const tokenResponse = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
        if (!tokenResponse.ok) throw new Error('Failed to get public token');
        const { token } = await tokenResponse.json();

        // Create a user session
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user_sessions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create user session');
        }

        const data = await response.json();
        const payload = { sessionUuid: data.sessionId, userSessionId: data.userSessionId, createdAt: new Date().toISOString() };
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
        } catch {}

        setSessionUuid(payload.sessionUuid);
        setUserSessionId(payload.userSessionId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create user session'));
      } finally {
        setIsLoading(false);
      }
    };

    const bootstrap = async () => {
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { sessionUuid: string; userSessionId: string; createdAt?: string };
            // basic expiry: 30 days
            const createdAt = parsed.createdAt ? new Date(parsed.createdAt) : null;
            const expired = createdAt ? (Date.now() - createdAt.getTime()) > 1000 * 60 * 60 * 24 * 30 : false;

            if (!expired) {
              const ok = await validateSession(parsed);
              if (ok) {
                setSessionUuid(parsed.sessionUuid);
                setUserSessionId(parsed.userSessionId);
                setIsLoading(false);
                return;
              }
            }
          } catch (e) {
            // parsing error — treat as missing
          }
        }

        // create a new session if none valid
        await createUserSession();
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Failed to initialize session'));
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []); // Only run once when the app starts

  return (
    <UserSessionContext.Provider value={{ userSessionId, sessionUuid, isLoading, error }}>
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSession() {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    throw new Error('useUserSession must be used within a UserSessionProvider');
  }
  return context;
}