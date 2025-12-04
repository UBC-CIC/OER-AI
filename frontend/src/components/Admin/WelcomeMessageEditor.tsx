import { useState, useEffect } from "react";
import { Save, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AuthService } from "@/functions/authService";
import { getWelcomeMessage } from "@/lib/welcomeMessage";

export default function WelcomeMessageEditor() {
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current welcome message on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const msg = await getWelcomeMessage();
        setWelcomeMessage(msg);
      } catch (err) {
        console.error("Failed to load welcome message:", err);
        setError("Failed to load welcome message");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    if (welcomeMessage.length > 5000) {
      setError("Message is too long. Maximum length is 5000 characters.");
      setIsSaving(false);
      return;
    }

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const resp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/config/welcomeMessage`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ welcomeMessage }),
        }
      );

      if (!resp.ok) {
        throw new Error("Failed to save welcome message");
      }

      // Optionally you could show a toast / message; for now just console
      console.log("Welcome message saved");
    } catch (err) {
      console.error("Error saving welcome message:", err);
      setError("Failed to save welcome message");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-gray-200 shadow-sm max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#2c5f7c]" />
          Welcome Message
        </CardTitle>
        <CardDescription>
          Configure the message shown to first-time visitors on the homepage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2c5f7c]"></div>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Message</Label>
              <Textarea
                id="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Enter the welcome message shown to first-time visitors"
                rows={6}
              />
              <p className="text-xs text-gray-500">
                Plain text only. Maximum of 5000 characters.
              </p>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#2c5f7c] hover:bg-[#234d63]"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Welcome Message"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
