import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Menu, X } from "lucide-react";
import { useSidebar } from "@/providers/sidebar";
import { useMode, type Mode } from "@/providers/mode";
import { Link } from "react-router";
import logoImage from "@/assets/OER_logo_black.png";

export default function Header() {
  const { mobileOpen, toggleMobile } = useSidebar();
  const { mode, setMode } = useMode();

  return (
    <header className="z-50 h-[70px] fixed top-0 w-screen border-b border-white/10 bg-gradient-to-r from-[#2c5f7c] to-[#3d7a9a]">
      <div className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {/* mobile menu button */}
          <button
            onClick={toggleMobile}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="md:hidden p-2 rounded-md hover:bg-white/10"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Menu className="h-5 w-5 text-white" />
            )}
          </button>
          <Link 
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label="Navigate to home"
          >
            <img src={logoImage} alt="OpenED AI Logo" className="h-6 w-auto" />
            <h1 className="text-xl font-semibold text-white">
              OpenED AI
            </h1>
          </Link>
        </div>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="w-fit border-primary-foreground bg-transparent text-white  [&_svg:not([class*='text-'])]:text-primary-foreground hover:bg-white/10">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Mode: Student</SelectItem>
            <SelectItem value="instructor">Mode: Instructor</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
