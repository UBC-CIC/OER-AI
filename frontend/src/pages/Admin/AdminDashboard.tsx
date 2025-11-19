import { useState } from "react";
import { BookOpen } from "lucide-react";
import AdminSidebar from "@/components/Admin/AdminSidebar";
import TextbookManagement from "@/components/Admin/TextbookManagement";
import Analytics from "@/components/Admin/Analytics";

// --- Components ---

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<"dashboard" | "analytics">(
    "dashboard"
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#2c5f7c] to-[#3d7a9a] text-white h-[70px] flex items-center px-6 shadow-md z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <h1 className="text-xl font-semibold">OpenED AI</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar activeView={activeView} onViewChange={setActiveView} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeView === "dashboard" ? <TextbookManagement /> : <Analytics />}
        </main>
      </div>
    </div>
  );
}
