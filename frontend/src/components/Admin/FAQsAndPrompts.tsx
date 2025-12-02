import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AuthService } from "@/functions/authService";

type PromptTemplate = {
  id: string;
  name: string;
  description: string;
  type: "RAG" | "quiz_generation" | "mcq_generation" | "audio_generation";
  visibility: "private" | "org" | "public";
  metadata: any;
  created_at: string;
  updated_at: string;
};

type ReportedFAQ = {
  id: string;
  textbook_id: string;
  question_text: string;
  answer_text: string;
  usage_count: number;
  last_used_at: string;
  cached_at: string;
  textbook_title: string;
};

type ReportedPrompt = {
  id: string;
  textbook_id: string;
  title: string;
  prompt_text: string;
  visibility: string;
  tags: string[];
  created_at: string;
  textbook_title: string;
};

export default function FAQsAndPrompts() {
  // Prompt templates state
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(
    null
  );

  // Reported items state
  const [reportedFAQs, setReportedFAQs] = useState<ReportedFAQ[]>([]);
  const [reportedPrompts, setReportedPrompts] = useState<ReportedPrompt[]>([]);
  const [loadingReported, setLoadingReported] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "RAG" as PromptTemplate["type"],
    visibility: "private" as PromptTemplate["visibility"],
  });

  // Fetch templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Fetch reported items
  useEffect(() => {
    fetchReportedItems();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt_templates`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const fetchReportedItems = async () => {
    try {
      setLoadingReported(true);
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/reported-items`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch reported items");
      }

      const data = await response.json();
      setReportedFAQs(data.reportedFAQs);
      setReportedPrompts(data.reportedPrompts);
    } catch (err) {
      console.error("Error fetching reported items:", err);
      // Don't set main error state to avoid blocking other functionality
    } finally {
      setLoadingReported(false);
    }
  };

  const handleDismissFAQ = async (id: string) => {
    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/admin/reported-items/faq/${id}/dismiss`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to dismiss FAQ");
      await fetchReportedItems();
    } catch (err) {
      console.error("Error dismissing FAQ:", err);
      setError("Failed to dismiss FAQ");
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/reported-items/faq/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to delete FAQ");
      await fetchReportedItems();
    } catch (err) {
      console.error("Error deleting FAQ:", err);
      setError("Failed to delete FAQ");
    }
  };

  const handleDismissPrompt = async (id: string) => {
    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/admin/reported-items/prompt/${id}/dismiss`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to dismiss prompt");
      await fetchReportedItems();
    } catch (err) {
      console.error("Error dismissing prompt:", err);
      setError("Failed to dismiss prompt");
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/admin/reported-items/prompt/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to delete prompt");
      await fetchReportedItems();
    } catch (err) {
      console.error("Error deleting prompt:", err);
      setError("Failed to delete prompt");
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt_templates`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create template");
      }

      await fetchTemplates();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error creating template:", err);
      setError("Failed to create template");
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt_templates/${
          editingTemplate.id
        }`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update template");
      }

      await fetchTemplates();
      setIsDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
    } catch (err) {
      console.error("Error updating template:", err);
      setError("Failed to update template");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt_templates/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      await fetchTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
      setError("Failed to delete template");
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: PromptTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      type: template.type,
      visibility: template.visibility,
    });
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "RAG",
      visibility: "private",
    });
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      RAG: "bg-blue-100 text-blue-700 border-blue-200",
      quiz_generation: "bg-purple-100 text-purple-700 border-purple-200",
      mcq_generation: "bg-green-100 text-green-700 border-green-200",
      audio_generation: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return colors[type] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getVisibilityColor = (visibility: string) => {
    const colors: Record<string, string> = {
      private: "bg-gray-100 text-gray-700 border-gray-200",
      org: "bg-yellow-100 text-yellow-700 border-yellow-200",
      public: "bg-green-100 text-green-700 border-green-200",
    };
    return colors[visibility] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">FAQs and Prompts</h2>
        <p className="text-gray-500 mt-1">
          Manage reported content and prompt templates.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Reported Items Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Reported Content
        </h3>

        {/* Reported FAQs */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Reported FAQs</CardTitle>
            <CardDescription>
              Review and manage reported frequently asked questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReported ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2c5f7c]"></div>
              </div>
            ) : reportedFAQs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reported FAQs found.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Textbook</TableHead>
                    <TableHead className="w-[40%]">Question & Answer</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Reported Date</TableHead>
                    <TableHead className="text-right">
                      Dismiss / Delete
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportedFAQs.map((faq) => (
                    <TableRow key={faq.id}>
                      <TableCell className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
                        {faq.textbook_title || "Unknown Textbook"}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px] sm:max-w-[300px]">
                        <div className="space-y-1">
                          <p
                            className="font-medium text-sm line-clamp-2"
                            title={faq.question_text}
                          >
                            Q: {faq.question_text}
                          </p>
                          <p
                            className="text-sm text-gray-500 line-clamp-2"
                            title={faq.answer_text}
                          >
                            A: {faq.answer_text}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{faq.usage_count}</TableCell>
                      <TableCell>
                        {new Date(faq.cached_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleDismissFAQ(faq.id)}
                            title="Dismiss Report"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteFAQ(faq.id)}
                            title="Delete FAQ"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Reported Prompts */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Reported User Prompts</CardTitle>
            <CardDescription>
              Review and manage reported shared user prompts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReported ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2c5f7c]"></div>
              </div>
            ) : reportedPrompts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reported prompts found.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Textbook</TableHead>
                    <TableHead className="w-[40%]">Prompt Details</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="text-right">
                      Dismiss / Delete
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportedPrompts.map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
                        {prompt.textbook_title || "Unknown Textbook"}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px] sm:max-w-[300px]">
                        <div className="space-y-1">
                          <p
                            className="font-medium text-sm line-clamp-1"
                            title={prompt.title || "Untitled Prompt"}
                          >
                            {prompt.title || "Untitled Prompt"}
                          </p>
                          <p
                            className="text-sm text-gray-500 line-clamp-2"
                            title={prompt.prompt_text}
                          >
                            {prompt.prompt_text}
                          </p>
                          {prompt.tags && prompt.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {prompt.tags.map((tag, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-[10px] px-1 py-0"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {prompt.visibility}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(prompt.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleDismissPrompt(prompt.id)}
                            title="Dismiss Report"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeletePrompt(prompt.id)}
                            title="Delete Prompt"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prompt Templates Card */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#2c5f7c]" />
                Prompt Templates
              </CardTitle>
              <CardDescription>
                Manage AI prompt templates for different use cases.
              </CardDescription>
            </div>
            <Button
              onClick={openCreateDialog}
              className="bg-[#2c5f7c] hover:bg-[#234d63]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2c5f7c]"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No templates found. Create your first template to get started.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[30%]">Name</TableHead>
                  <TableHead className="w-[35%]">Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Edit / Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 truncate max-w-[200px] sm:max-w-[300px]">
                      <span title={template.description || "No description"}>
                        {template.description || "No description"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getTypeColor(template.type)} shadow-none`}
                      >
                        {template.type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getVisibilityColor(
                          template.visibility
                        )} shadow-none capitalize`}
                      >
                        {template.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-[#2c5f7c]"
                          onClick={() => openEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create New Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the prompt template details below."
                : "Fill in the details to create a new prompt template."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Default RAG Template"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <div className="relative">
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the purpose of this template... Use [PLACEHOLDER] for dynamic values."
                  rows={5}
                  className="font-mono text-sm"
                />
                {formData.description && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2 font-semibold">
                      Preview:
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {formData.description
                        .split(/(\[.*?\])/)
                        .map((part, index) => {
                          // Check if this part is a bracket placeholder
                          if (part.match(/^\[.*?\]$/)) {
                            return (
                              <span
                                key={index}
                                className="bg-yellow-200 px-1 rounded font-semibold"
                              >
                                {part}
                              </span>
                            );
                          }
                          return <span key={index}>{part}</span>;
                        })}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Use square brackets like [TOPIC] or [QUESTION] to mark
                placeholders that will be filled in dynamically.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: PromptTemplate["type"]) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RAG">RAG</SelectItem>
                  <SelectItem value="quiz_generation">
                    Quiz Generation
                  </SelectItem>
                  <SelectItem value="mcq_generation">MCQ Generation</SelectItem>
                  <SelectItem value="audio_generation">
                    Audio Generation
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value: PromptTemplate["visibility"]) =>
                  setFormData({ ...formData, visibility: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setEditingTemplate(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={
                editingTemplate ? handleUpdateTemplate : handleCreateTemplate
              }
              className="bg-[#2c5f7c] hover:bg-[#234d63]"
              disabled={!formData.name || !formData.type}
            >
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
