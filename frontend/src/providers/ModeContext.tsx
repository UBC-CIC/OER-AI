import React, { useState, useCallback, useEffect } from "react";
import ModeContext, { type Mode } from "./mode";
import { useUserSession } from "../providers/usersession";

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("student");
  const { sessionUuid } = useUserSession();

  // Fetch the current role from the backend on mount
  useEffect(() => {
    const fetchCurrentRole = async () => {
      if (!sessionUuid) return;

      try {
        const tokenResponse = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
        );
        if (!tokenResponse.ok) return;
        const { token } = await tokenResponse.json();

        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/user_sessions/${sessionUuid}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.role) {
            setModeState(data.role);
          }
        }
      } catch (error) {
        console.error("Error fetching current role:", error);
      }
    };

    fetchCurrentRole();
  }, [sessionUuid]);

  const setMode = useCallback(
    async (newMode: Mode) => {
      // Capture previous mode for rollback if backend update fails
      const previousMode = mode;

      // Optimistic update for responsive UI
      setModeState(newMode);

      // Update the user session role in the backend; rollback on failure
      if (sessionUuid) {
        try {
          const tokenResponse = await fetch(
            `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
          );
          if (!tokenResponse.ok) {
            console.error("Failed to get public token");
            // Rollback local state to keep UI consistent with backend
            setModeState(previousMode);
            // Optional: surface error to user
            // window.alert("Could not switch mode. Please try again.");
            return;
          }
          const { token } = await tokenResponse.json();

          const response = await fetch(
            `${import.meta.env.VITE_API_ENDPOINT}/user_sessions/${sessionUuid}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ role: newMode }),
            }
          );

          if (!response.ok) {
            console.error("Failed to update user session role");
            setModeState(previousMode);
            // Optional: surface error to user
            // window.alert("Could not switch mode. Please try again.");
          }
        } catch (error) {
          console.error("Error updating user session role:", error);
          setModeState(previousMode);
          // Optional: surface error to user
          // window.alert("Could not switch mode. Please try again.");
        }
      }
    },
    [sessionUuid, mode]
  );

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export default ModeProvider;
