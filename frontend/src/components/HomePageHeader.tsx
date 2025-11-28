import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useMode, type Mode } from "@/providers/mode";
import logoImage from "@/assets/OER_logo_black.png";

export default function HomePageHeader() {
  const { mode, setMode } = useMode();
  return (
    <header className="z-50 h-[70px] fixed top-0 w-screen border-b border-white/10 bg-gradient-to-r from-[#2c5f7c] to-[#3d7a9a]">
      <div className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-white">
          <img src={logoImage} alt="OpenED AI Logo" className="h-6 w-auto" />
          <h1 className="text-xl font-semibold">OpenED AI</h1>
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
