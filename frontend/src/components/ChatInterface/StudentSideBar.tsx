import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./SidebarContext";
import { useNavigate } from "react-router";

type StudentSideBarProps = {
  textbookTitle: string;
  textbookAuthor: string;
};

export default function StudentSideBar({
  textbookTitle,
  textbookAuthor,
}: StudentSideBarProps) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const navigate = useNavigate();

  const SidebarContent = () => (
    <>
      <Card className="cursor-pointer py-[10px] hover:bg-gray-50 gap-2 mb-6" onClick={() => {navigate("/")}}>
        <CardContent
          className="line-clamp-2 leading-[1.25] overflow-hidden"
          style={{ minHeight: `calc(1em * 1.25 * 2)` }}
        >
          <h3 className="font-semibold text-sm">{textbookTitle}</h3>
        </CardContent>
        <CardContent className="line-clamp-1 leading-[1.25] overflow-hidden">
          <p className="text-xs text-gray-600">By {textbookAuthor}</p>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <nav className="space-y-2 mb-6">
        <Button
          variant={"link"}
          className="cursor-pointer w-full justify-start px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md transition-colors"
        >
          FAQ Cache
        </Button>
        <Button
          variant={"link"}
          className="cursor-pointer w-full justify-start px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md transition-colors"
        >
          Practice Material
        </Button>
      </nav>

      <div className="border-t border-gray-200 pt-4">
        <h4 className="font-semibold text-sm px-3">Tutor</h4>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed left-0 p-[10px] h-screen w-64 flex-shrink-0 border bg-muted overflow-auto px-4">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <div
        className={`md:hidden pt-[10px] fixed inset-0 z-40 transition-opacity ${
          mobileOpen ? "visible" : "pointer-events-none invisible"
        }`}
        aria-hidden={!mobileOpen}
      >
        {/*mobile backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />

        {/* mobile view Panel */}
        <div
          className={`pt-[70px] absolute left-0  h-full w-64 bg-muted border-r p-4 transform transition-transform ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent />
        </div>
      </div>
    </>
  );
}
