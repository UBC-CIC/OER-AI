import type { ReactNode } from "react";
import { TextbookViewContext, type TextbookViewContextType } from "./textbookView";

export function TextbookViewProvider({ 
  children, 
  value 
}: { 
  children: ReactNode; 
  value: TextbookViewContextType 
}) {
  return (
    <TextbookViewContext.Provider value={value}>
      {children}
    </TextbookViewContext.Provider>
  );
}
