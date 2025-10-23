import React, { createContext, useContext, useState } from "react";

export type Mode = "student" | "instructor";

type ModeContextValue = {
  mode: Mode;
  setMode: (m: Mode) => void;
};

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("student");

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return ctx;
}

export default ModeContext;
