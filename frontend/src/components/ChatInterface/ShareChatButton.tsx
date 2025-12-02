import { useState } from "react";
import { Share2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ShareChatButtonProps {
  chatSessionId: string;
  textbookId: string;
  disabled?: boolean;
}

const PRIVACY_NOTICE_KEY = "chat-share-privacy-notice-dismissed";

export default function ShareChatButton({
  chatSessionId,
  textbookId,
  disabled = false,
}: ShareChatButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleShare = async () => {
    // Generate share URL
    const shareUrl = `${window.location.origin}/textbook/${textbookId}/chat?share=${chatSessionId}`;

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);

      // Show success feedback
      setCopied(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);

      // Fallback: show alert with URL for manual copy
      alert(`Share URL: ${shareUrl}\n\nPlease copy this URL manually.`);
    }
  };

  const handleShareClick = () => {
    // Check if user has dismissed the privacy notice
    const hasSeenNotice = localStorage.getItem(PRIVACY_NOTICE_KEY) === "true";

    if (hasSeenNotice) {
      // Proceed directly to share
      handleShare();
    } else {
      // Show privacy notice first
      setShowPrivacyNotice(true);
    }
  };

  const handleConfirmShare = () => {
    // Save preference if user checked "Don't show again"
    if (dontShowAgain) {
      localStorage.setItem(PRIVACY_NOTICE_KEY, "true");
    }

    // Close modal
    setShowPrivacyNotice(false);

    // Proceed with share
    handleShare();

    // Reset the checkbox for next time
    setDontShowAgain(false);
  };

  const handleCancelShare = () => {
    setShowPrivacyNotice(false);
    setDontShowAgain(false);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleShareClick}
            disabled={disabled}
            className="cursor-pointer"
            aria-label="Share chat"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Link copied!" : "Share this conversation"}</p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={showPrivacyNotice} onOpenChange={setShowPrivacyNotice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Share Chat Conversation
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                Thank you for sharing your chat conversation. Doing this means
                that you can help someone else who might find your interaction
                with Opterna useful in their learning.
              </p>
              <p className="font-semibold">
                Before you share, please know the following:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Anyone with the link can view this conversation</li>
                <li>The shared chat is publicly accessible</li>
                <li>Shared conversations cannot be deleted or revoked</li>
                <li>Sensitive information should not be shared</li>
                <li>
                  Inappropriate content is flagged by fellow users and removed
                  by administrators
                </li>
                <li>Sensitive information should not be shared</li>
              </ul>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-2 py-2">
            <Switch
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
            />
            <Label
              htmlFor="dont-show-again"
              className="text-sm font-normal cursor-pointer"
            >
              Don't show this again
            </Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelShare}>
              Cancel
            </Button>
            <Button onClick={handleConfirmShare}>Share Conversation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
