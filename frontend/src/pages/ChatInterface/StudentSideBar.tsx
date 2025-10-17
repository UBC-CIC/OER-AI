import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useState } from "react";
import { Menu } from "lucide-react";

type StudentSideBarProps = {
  textbookTitle: string;
  textbookAuthor: string;
};

export default function StudentSideBar({
  textbookTitle,
  textbookAuthor,
}: StudentSideBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <Card className="py-[10px] gap-2 mb-6">
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
      {/* mobile men toggle button  */}
      {!mobileOpen && (
        <div className="md:hidden fixed left-1 z-50">
          <button
            className="p-2 rounded-md bg-white/10"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5 text-black" />
          </button>
        </div>
      )}

      {/* Desktop sidebar (reuses SidebarContent) */}
      <aside className="hidden md:block fixed left-0 p-[10px] h-screen w-64 flex-shrink-0 border bg-muted overflow-auto px-4">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity ${
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
