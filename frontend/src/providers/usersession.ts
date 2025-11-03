import { createContext, useContext } from "react";

interface UserSessionContextType {
  userSessionId: string | null;
  sessionUuid?: string | null;
  isLoading: boolean;
  error: Error | null;
}

export const UserSessionContext = createContext<UserSessionContextType | undefined>(
  undefined
);




export function useUserSession() {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    throw new Error("useUserSession must be used within a UserSessionProvider");
  }
  return context;
}