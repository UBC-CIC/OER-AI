import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSidebar } from "@/providers/sidebar";
import { useNavigate, useLocation } from "react-router";
import { Separator } from "@/components/ui/separator";
import { useMode } from "@/providers/mode";
import { useTextbookView } from "@/providers/textbookView";
import { Plus, MessageSquare, ExternalLink, Volume2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useSpeech } from "@/contexts/SpeechContext";

type StudentSideBarProps = {
  textbookTitle: string;
  textbookAuthor: string;
  textbookId?: string;
  textbookSourceUrl?: string;
};

export default function SideBar({
  textbookTitle,
  textbookAuthor,
  textbookId,
  textbookSourceUrl,
}: StudentSideBarProps) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useMode();
  const {
    chatSessions,
    activeChatSessionId,
    setActiveChatSessionId,
    createNewChatSession,
  } = useTextbookView();
  const { settings, setSettings, voices, speak, cancel } = useSpeech();

  const handleNewChat = async () => {
    const newSession = await createNewChatSession();
    if (newSession && textbookId) {
      navigate(`/textbook/${textbookId}/chat`);
      setMobileOpen(false);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveChatSessionId(sessionId);
    if (textbookId) {
      navigate(`/textbook/${textbookId}/chat`);
      setMobileOpen(false);
    }
  };

  const SidebarContent = () => (
    <>
      <Card className="py-[10px] gap-2 mb-4">
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

      {/* Source URL Link */}
      {textbookSourceUrl && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="w-full mb-4 gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <a href={textbookSourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            View Original Textbook
          </a>
        </Button>
      )}

      {/* Menu Items */}

      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground tracking-wide">
            STUDY COMPANION
          </h3>
          <Button
            variant="link"
            size="icon"
            onClick={handleNewChat}
            className="text-muted-foreground hover:text-foreground cursor-pointer h-6 w-6"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat sessions list */}
        <div className="pl-2 border-l-2 border-muted space-y-1 max-h-[300px] overflow-y-auto">
          {chatSessions.map((session, index) => (
            <Button
              key={session.id}
              variant="link"
              onClick={() => handleSelectSession(session.id)}
              className={`cursor-pointer w-full justify-start px-3 py-2 text-sm rounded-md transition-colors ${
                activeChatSessionId === session.id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:underline"
              }`}
            >
              <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
              {/* temporary place holder for chat names */}
              <span className="truncate">
                {session.name || `Chat ${chatSessions.length - index}`}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {/* --- Speech Controls (Dropdown) --- */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide">AUDIO</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Audio settings">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="left">
              <DropdownMenuLabel className="text-xs">Audio settings</DropdownMenuLabel>
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Narration</Label>
                  <Switch
                    id="speech-enabled"
                    checked={settings.enabled}
                    onCheckedChange={(v) => setSettings({ enabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Autoplay</Label>
                  <Switch
                    id="speech-autoplay"
                    checked={settings.autoplay}
                    onCheckedChange={(v) => setSettings({ autoplay: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Mode</Label>
                  <Select
                    value={settings.mode}
                    onValueChange={(v) => setSettings({ mode: v as any })}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="ai">AI only</SelectItem>
                      <SelectItem value="user">User only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Voice</Label>
                  <Select
                    value={settings.voiceURI || "default"}
                    onValueChange={(v) => setSettings({ voiceURI: v === "default" ? null : v })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      {voices.map((v) => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI || v.name}>
                          {v.name} {v.lang ? `(${v.lang})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full text-xs">Rate</div>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.rate}
                    onChange={(e) => setSettings({ rate: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full text-xs">Pitch</div>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.pitch}
                    onChange={(e) => setSettings({ pitch: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full text-xs">Volume</div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.volume}
                    onChange={(e) => setSettings({ volume: Number(e.target.value) })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button onClick={() => speak("This is a sample of the selected voice.", { enabled: true })}>Play sample</Button>
                  <Button variant="ghost" onClick={() => cancel()}>
                    Stop
                  </Button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Separator className="mb-4" />
      {mode === "student" ? (
        // student view content
        <nav className="space-y-2 mb-4">
          <Button
            variant={"link"}
            className={`cursor-pointer w-full justify-start px-3 py-2 text-sm rounded-md transition-colors ${
              location.pathname === "/"
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              navigate(`/textbook/${textbookId}/faq`);
              setMobileOpen(false);
            }}
          >
            FAQ
          </Button>
          <Button
            variant={"link"}
            onClick={() => {
              navigate(`/textbook/${textbookId}/practice`);
              setMobileOpen(false);
            }}
            className={`cursor-pointer w-full justify-start px-3 py-2 text-sm rounded-md transition-colors ${
              location.pathname.includes("/practice")
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Practice Material
          </Button>
        </nav>
      ) : (
        // instructor view content
        <nav className="space-y-2 mb-4">
          <Button
            variant={"link"}
            onClick={() => {
              navigate(`/textbook/${textbookId}/material-editor`);
              setMobileOpen(false);
            }}
            className={`cursor-pointer w-full justify-start px-3 py-2 text-sm rounded-md transition-colors ${
              location.pathname.includes("/material-editor")
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Material Editor
          </Button>
        </nav>
      )}
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
        inert={!mobileOpen ? true : undefined}
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
