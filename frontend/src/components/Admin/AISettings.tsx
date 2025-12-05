import { useState, useEffect } from "react";
import { Save, Bot } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AuthService } from "@/functions/authService";
import WelcomeMessageEditor from "@/components/Admin/WelcomeMessageEditor";

export default function AISettings() {
  const [tokenLimit, setTokenLimit] = useState(1000);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [loadingTokenLimit, setLoadingTokenLimit] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);

  const handleSaveTokenLimit = async () => {
    setIsSavingToken(true);
    setTokenError(null);

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const tokenLimitValue = isUnlimited ? "NONE" : String(tokenLimit);

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/settings/token-limit`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tokenLimit: tokenLimitValue }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save token limit");
      }

      console.log("Token limit saved:", tokenLimitValue);
    } catch (err) {
      console.error("Error saving token limit:", err);
      setTokenError("Failed to save token limit");
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleSaveSystemPrompt = async () => {
    setIsSavingPrompt(true);
    setPromptError(null);

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/settings/system-prompt`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ systemPrompt }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save system prompt");
      }

      console.log("System prompt saved");
    } catch (err) {
      console.error("Error saving system prompt:", err);
      setPromptError("Failed to save system prompt");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  // Fetch settings on mount
  useEffect(() => {
    fetchTokenLimit();
    fetchSystemPrompt();
  }, []);

  const fetchTokenLimit = async () => {
    try {
      setLoadingTokenLimit(true);
      setTokenError(null);

      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/settings/token-limit`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch token limit");
      }

      const data = await response.json();
      const limitValue = data.tokenLimit;

      if (limitValue === "NONE") {
        setIsUnlimited(true);
        setTokenLimit(1000); // Default display value
      } else {
        setIsUnlimited(false);
        setTokenLimit(parseInt(limitValue));
      }
    } catch (err) {
      console.error("Error fetching token limit:", err);
      setTokenError("Failed to load token limit");
    } finally {
      setLoadingTokenLimit(false);
    }
  };

  const fetchSystemPrompt = async () => {
    try {
      setLoadingPrompt(true);
      setPromptError(null);

      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/settings/system-prompt`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch system prompt");
      }

      const data = await response.json();
      setSystemPrompt(data.systemPrompt || "");
    } catch (err) {
      console.error("Error fetching system prompt:", err);
      setPromptError("Failed to load system prompt");
    } finally {
      setLoadingPrompt(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">AI Settings</h2>
        <p className="text-gray-500 mt-1">
          Configure global AI settings for token usage and system prompts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Token Limits Card */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#2c5f7c]" />
              Token Limits
            </CardTitle>
            <CardDescription>
              Set the daily token usage limit for standard users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tokenError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {tokenError}
              </div>
            )}
            {loadingTokenLimit ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2c5f7c]"></div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="token-limit">Daily Token Limit</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="unlimited-mode"
                        checked={isUnlimited}
                        onCheckedChange={setIsUnlimited}
                      />
                      <Label
                        htmlFor="unlimited-mode"
                        className="font-normal cursor-pointer"
                      >
                        No Limit
                      </Label>
                    </div>
                  </div>
                  <Input
                    id="token-limit"
                    type="number"
                    value={tokenLimit}
                    onChange={(e) => setTokenLimit(Number(e.target.value))}
                    placeholder="Enter token limit (e.g. 1000)"
                    disabled={isUnlimited}
                  />
                  <p className="text-xs text-gray-500">
                    This limit applies to all non-admin users. Resets daily at
                    midnight UTC.
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSaveTokenLimit}
                    disabled={isSavingToken}
                    className="bg-[#2c5f7c] hover:bg-[#234d63]"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingToken ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Prompt Card */}
      <Card className="border-gray-200 shadow-sm w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#2c5f7c]" />
            System Prompt
          </CardTitle>
          <CardDescription>
            Define the core behavior and persona of the AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {promptError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {promptError}
            </div>
          )}
          {loadingPrompt ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2c5f7c]"></div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="flex min-h-[400px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  placeholder="You are a helpful AI assistant..."
                />
                <p className="text-xs text-gray-500">
                  This prompt is prepended to all chat sessions.
                </p>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleSaveSystemPrompt}
                  disabled={isSavingPrompt}
                  className="bg-[#2c5f7c] hover:bg-[#234d63]"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingPrompt ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Welcome Message Editor */}
      <WelcomeMessageEditor />
    </div>
  );
}
