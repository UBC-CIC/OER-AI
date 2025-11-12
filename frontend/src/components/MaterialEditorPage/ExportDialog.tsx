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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IH5PMinimalQuestionSet } from "@/types/MaterialEditor";
import { exportQuestionSetAsPDF } from "@/utils/pdfExport";
import { Download } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionSet: IH5PMinimalQuestionSet;
  title: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  questionSet,
  title,
}: ExportDialogProps) {
  const [exportStyle, setExportStyle] = useState<"worksheet" | "answer-key">("worksheet");

  const handleExport = () => {
    exportQuestionSetAsPDF(questionSet, {
      style: exportStyle,
      title: title,
      includeExplanations: true,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>
            Choose the PDF style you want to export. The worksheet is blank for
            students to fill in, while the answer key includes correct answers
            and explanations.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="export-style">Export Style</Label>
            <Select 
              value={exportStyle} 
              onValueChange={(v: string) => setExportStyle(v as "worksheet" | "answer-key")}
            >
              <SelectTrigger id="export-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worksheet">
                  Student Worksheet
                </SelectItem>
                <SelectItem value="answer-key">
                  Answer Key
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {exportStyle === "worksheet" 
                ? "Questions and answer choices only. Perfect for giving to students to complete."
                : "Includes correct answers marked with checkmarks, plus explanations and tips. Perfect for instructors."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
