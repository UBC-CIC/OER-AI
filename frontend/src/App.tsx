import { BrowserRouter, Routes, Route } from "react-router";
import AIChatPage from "./pages/ChatInterface/ChatInterface";
import HomePage from "./pages/HomePage";
import { UserSessionProvider } from "./providers/UserSessionContext";
import { ModeProvider } from "@/providers/ModeContext";
import TextbookLayout from "./layouts/TextbookLayout";
import PracticeMaterialPage from "./pages/PracticeMaterial/PracticeMaterialPage";

function App() {
  return (
    <ModeProvider>
      <BrowserRouter>
        <UserSessionProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/textbook/:id" element={<TextbookLayout />}>
              <Route path="chat" element={<AIChatPage />} />
              <Route path="practice" element={<PracticeMaterialPage />} />
            </Route>
          </Routes>
        </UserSessionProvider>
      </BrowserRouter>
    </ModeProvider>
  );
}

export default App;
