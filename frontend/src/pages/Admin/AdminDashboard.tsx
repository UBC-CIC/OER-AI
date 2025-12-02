import { useState } from "react";
import AdminSidebar from "@/components/Admin/AdminSidebar";
import TextbookManagement from "@/components/Admin/TextbookManagement";
import Analytics from "@/components/Admin/Analytics";
import AISettings from "@/components/Admin/AISettings";
import FAQsAndPrompts from "@/components/Admin/FAQsAndPrompts";
import Footer from "@/components/Footer";
import logoImage from "@/assets/OER_logo_black.png";

// --- Components ---

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<
    "dashboard" | "analytics" | "ai-settings" | "faqs-prompts"
  >("dashboard");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#2c5f7c] to-[#3d7a9a] text-white h-[70px] flex items-center px-6 shadow-md z-10">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="OpenED AI Logo" className="h-6 w-auto" />
          <h1 className="text-xl font-semibold">OpenED AI Admin</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeView === "dashboard" && <TextbookManagement />}
          {activeView === "analytics" && <Analytics />}
          {activeView === "ai-settings" && <AISettings />}
          {activeView === "faqs-prompts" && <FAQsAndPrompts />}
        </main>
      </div>
      <Footer />
    </div>
  );
}
