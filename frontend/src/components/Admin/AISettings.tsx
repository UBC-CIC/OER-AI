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
  const [isSaving, setIsSaving] = useState(false);
  const [loadingTokenLimit, setLoadingTokenLimit] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

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
      setError("Failed to save token limit");
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch token limit on mount
  useEffect(() => {
    fetchTokenLimit();
  }, []);

  const fetchTokenLimit = async () => {
    try {
      setLoadingTokenLimit(true);
      setError(null);

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
      setError("Failed to load token limit");
    } finally {
      setLoadingTokenLimit(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">AI Settings</h2>
        <p className="text-gray-500 mt-1">
          Configure global AI settings for token usage.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Token Limits Card */}
      <Card className="border-gray-200 shadow-sm max-w-2xl">
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
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#2c5f7c] hover:bg-[#234d63]"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
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
