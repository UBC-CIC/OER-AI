import { BrowserRouter, Routes, Route } from "react-router";
import AIChatPage from "./pages/ChatInterface/ChatInterface";
import HomePage from "./pages/HomePage";
import { UserSessionProvider } from "./providers/UserSessionContext";
import { ModeProvider } from "@/providers/ModeContext";
import TextbookLayout from "./layouts/TextbookLayout";
import PracticeMaterialPage from "./pages/PracticeMaterial/PracticeMaterialPage";
import FAQPage from "./pages/FAQ/FAQPage";
import MaterialEditorPage from "./pages/MaterialEditor/MaterialEditorPage";

function App() {
  return (
    <BrowserRouter>
      <UserSessionProvider>
        <ModeProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/textbook/:id" element={<TextbookLayout />}>
              <Route path="chat" element={<AIChatPage />} />
              <Route path="practice" element={<PracticeMaterialPage />} />
              <Route path="faq" element={<FAQPage />} />
              <Route path="material-editor" element={<MaterialEditorPage />} />
            </Route>
          </Routes>
        </ModeProvider>
      </UserSessionProvider>
      </BrowserRouter>
  );
}

export default App;
