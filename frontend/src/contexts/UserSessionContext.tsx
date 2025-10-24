import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface UserSessionContextType {
  userSessionId: string | null;
  sessionUuid?: string | null;
  isLoading: boolean;
  error: Error | null;
  getPublicToken: () => Promise<string>;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [userSessionId, setUserSessionId] = useState<string | null>(null);
  const [sessionUuid, setSessionUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const LOCAL_KEY = "oer_user_session";
  const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 min buffer before expiry

  type Stored = {
    sessionUuid: string;
    userSessionId: string;
    createdAt?: string;
    token?: string;
    tokenExpiresAt?: number;
  };

  const readStored = (): Stored | null => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      return null;
    }
  };

  const writeStored = (obj: Stored) => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(obj));
    } catch {}
  };

  const [memToken, setMemToken] = useState<string | null>(null);
  const [memExp, setMemExp] = useState<number | null>(null);

  const getPublicToken = useCallback(async (): Promise<string> => {
    // prefer memory
    if (memToken && memExp && Date.now() < memExp - TOKEN_BUFFER_MS) return memToken;

    // check localStorage
    const stored = readStored();
    if (stored?.token && stored.tokenExpiresAt && Date.now() < stored.tokenExpiresAt - TOKEN_BUFFER_MS) {
      setMemToken(stored.token);
      setMemExp(stored.tokenExpiresAt);
      return stored.token;
    }

    // fetch new
    const resp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
    if (!resp.ok) throw new Error('Failed to get public token');
    const { token } = await resp.json();

    // Try to decode exp if present, else assume 2h
    let expMs: number | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || '')) as { exp?: number };
      if (payload?.exp) expMs = payload.exp * 1000;
    } catch {}
    const expiresAt = expMs ?? (Date.now() + 2 * 60 * 60 * 1000);

    setMemToken(token);
    setMemExp(expiresAt);
    const merged: Stored = {
      sessionUuid: stored?.sessionUuid ?? '',
      userSessionId: stored?.userSessionId ?? '',
      createdAt: stored?.createdAt ?? new Date().toISOString(),
      token,
      tokenExpiresAt: expiresAt,
    };
    writeStored(merged);
    return token;
  }, [memToken, memExp]);

  useEffect(() => {
    const validateSession = async (stored: { sessionUuid: string; userSessionId: string; createdAt?: string }) => {
      try {
        // get public token (cached)
        const token = await getPublicToken();

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
        // First get a public token (cached)
        const token = await getPublicToken();

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
        const current = readStored();
        const updated: Stored = {
          sessionUuid: data.sessionId,
          userSessionId: data.userSessionId,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          token: memToken ?? current?.token,
          tokenExpiresAt: memExp ?? current?.tokenExpiresAt,
        };
        writeStored(updated);

        setSessionUuid(updated.sessionUuid);
        setUserSessionId(updated.userSessionId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create user session'));
      } finally {
        setIsLoading(false);
      }
    };

    const bootstrap = async () => {
      try {
        const parsed = readStored();
        if (parsed) {
          try {
            // basic expiry: 30 days
            const createdAt = parsed.createdAt ? new Date(parsed.createdAt) : null;
            const expired = createdAt ? (Date.now() - createdAt.getTime()) > 1000 * 60 * 60 * 24 * 30 : false;

            if (!expired) {
              const ok = await validateSession(parsed);
              if (ok) {
                setSessionUuid(parsed.sessionUuid);
                setUserSessionId(parsed.userSessionId);
                if (parsed.token && parsed.tokenExpiresAt) {
                  setMemToken(parsed.token);
                  setMemExp(parsed.tokenExpiresAt);
                }
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
    <UserSessionContext.Provider value={{ userSessionId, sessionUuid, isLoading, error, getPublicToken }}>
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