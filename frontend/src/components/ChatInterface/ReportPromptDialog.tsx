import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ReportPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptId: string;
  promptTitle: string;
  onReportSubmitted: () => void;
}

export function ReportPromptDialog({
  open,
  onOpenChange,
  promptId,
  promptTitle,
  onReportSubmitted,
}: ReportPromptDialogProps) {
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get auth token
      const tokenResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/user/publicToken`
      );
      if (!tokenResp.ok) throw new Error("Failed to get auth token");
      const { token } = await tokenResp.json();

      // Submit report using the dedicated report endpoint
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/shared_prompts/${promptId}/report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comment: comment.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit report");
      }

      // Success
      setSuccess(true);
      setTimeout(() => {
        onReportSubmitted();
        onOpenChange(false);
        setComment("");
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report Prompt</DialogTitle>
          <DialogDescription>
            Help us keep the community safe by reporting inappropriate content.
            <br />
            <span className="font-medium text-foreground mt-2 block">
              "{promptTitle}"
            </span>
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="comment">
                  Why are you reporting this prompt? (optional)
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Provide context about why you're reporting this prompt..."
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {comment.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-medium">Report submitted successfully</p>
            <p className="text-sm text-muted-foreground text-center">
              Thank you for helping keep our community safe.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
