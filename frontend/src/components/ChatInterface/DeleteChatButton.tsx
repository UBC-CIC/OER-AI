import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { AuthService } from "@/functions/authService";

type DeleteChatButtonProps = {
  chatSessionId: string;
  userSessionId?: string;
  onDeleted?: () => void;
};

export default function DeleteChatButton({ chatSessionId, userSessionId, onDeleted }: DeleteChatButtonProps) {
  const handleDelete = async (e?: React.MouseEvent) => {
    try { e?.stopPropagation(); } catch {};
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      // Try to get admin/user auth token first (Cognito) so admins can delete too.
      const tokenResult = await AuthService.getAuthToken(true).catch(() => ({ success: false }));
      let token: string | undefined = undefined;
      if (tokenResult && typeof tokenResult === "object" && (tokenResult as any).token) {
        token = (tokenResult as any).token;
      }
      if (!token) {
        const tokenResp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`);
        if (!tokenResp.ok) throw new Error("Failed to acquire public token");
        const tokenData = await tokenResp.json();
        token = tokenData.token;
      }

      const url = new URL(`${import.meta.env.VITE_API_ENDPOINT}/chat_sessions/${chatSessionId}`);
      if (userSessionId) url.searchParams.set("user_session_id", userSessionId);

      const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers,
      });

      if (!response.ok) throw new Error("Failed to delete chat session");
      if (onDeleted) onDeleted();
    } catch (err) {
      console.error("Error deleting chat session:", err);
      alert("Failed to delete chat session. Please try again.");
    }
  };

  return (
    <Button type="button" variant="ghost" size="icon" onClick={(e) => handleDelete(e)} title="Delete chat session">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
