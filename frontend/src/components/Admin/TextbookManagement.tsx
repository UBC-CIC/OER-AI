import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Upload,
  Trash2,
  RefreshCw,
  FileText,
  Users,
  HelpCircle,
} from "lucide-react";
import { AuthService } from "@/functions/authService";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import MetricCard from "./MetricCard.tsx";

export type TextbookData = {
  id: string | number;
  title: string;
  author: string;
  status: string;
  users: number;
  questions: number;
};

export default function TextbookManagement() {
  const [textbooks, setTextbooks] = useState<TextbookData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleFileSelect = (selectedFile: File) => {
    setUploadStatus({ type: null, message: "" });

    // Validate file type
    if (
      !selectedFile.name.endsWith(".csv") &&
      selectedFile.type !== "text/csv"
    ) {
      setUploadStatus({
        type: "error",
        message: "Only CSV files are allowed.",
      });
      return;
    }

    // Validate file size (50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setUploadStatus({
        type: "error",
        message: "File size must be less than 50MB.",
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setUploadStatus({ type: null, message: "" });

      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      // 1. Get pre-signed URL
      const presignedResponse = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/generate-presigned-url?file_name=${encodeURIComponent(
          file.name
        )}&content_type=${encodeURIComponent(file.type || "text/csv")}`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      if (!presignedResponse.ok) {
        throw new Error("Failed to generate upload URL");
      }

      const { presignedurl } = await presignedResponse.json();

      // 2. Upload file to S3
      const uploadResponse = await fetch(presignedurl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "text/csv",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to S3");
      }

      setUploadStatus({
        type: "success",
        message: "File uploaded successfully. Processing started.",
      });

      // Close dialog after a short delay
      setTimeout(() => {
        setIsUploadOpen(false);
        setFile(null);
        setUploadStatus({ type: null, message: "" });
      }, 2000);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const filteredTextbooks = textbooks.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStatus = async (id: string | number) => {
    const book = textbooks.find((b) => b.id === id);
    if (!book) return;

    const newStatus = book.status === "Active" ? "Disabled" : "Active";

    // Optimistically update UI
    setTextbooks(
      textbooks.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/textbooks/${id}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update textbook status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      // Revert on error
      setTextbooks(
        textbooks.map((b) => (b.id === id ? { ...b, status: book.status } : b))
      );
      setError("Failed to update textbook status");
    }
  };

  const handleDelete = async (id: string | number) => {
    if (
      !confirm(
        "Are you sure you want to delete this textbook? This action cannot be undone."
      )
    ) {
      return;
    }

    // Optimistically remove from UI
    const originalTextbooks = [...textbooks];
    setTextbooks(textbooks.filter((book) => book.id !== id));

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/textbooks/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete textbook");
      }
    } catch (err) {
      console.error("Error deleting textbook:", err);
      // Revert on error
      setTextbooks(originalTextbooks);
      setError("Failed to delete textbook");
    }
  };

  const handleRefresh = async (id: string | number) => {
    if (!confirm("This will trigger re-ingestion of the textbook. Continue?")) {
      return;
    }

    try {
      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/textbooks/${id}/refresh`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to refresh textbook");
      }

      const data = await response.json();
      console.log("Refresh job created:", data);

      // Update the textbook status to "Ingesting"
      setTextbooks(
        textbooks.map((b) => (b.id === id ? { ...b, status: "Ingesting" } : b))
      );
    } catch (err) {
      console.error("Error refreshing textbook:", err);
      setError("Failed to refresh textbook");
    }
  };

  // Fetch textbooks from API
  useEffect(() => {
    const fetchTextbooks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get admin token from authService
        const session = await AuthService.getAuthSession(true);
        const token = session.tokens.idToken;

        if (!token) {
          throw new Error("No authentication token available");
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/admin/textbooks`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch textbooks: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(data);

        // Transform API data to match component format
        const transformedTextbooks = data.textbooks.map((book: any) => ({
          id: book.id,
          title: book.title,
          author: book.authors?.join(", ") || "Unknown Author",
          status: book.status || "Disabled",
          users: book.user_count,
          questions: book.question_count,
        }));

        setTextbooks(transformedTextbooks);
      } catch (err) {
        console.error("Error fetching textbooks:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load textbooks"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTextbooks();
  }, []);

  // Calculate total metrics from textbooks
  const totalUsers = textbooks.reduce(
    (sum, book) => sum + (book.users || 0),
    0
  );
  const totalQuestions = textbooks.reduce(
    (sum, book) => sum + (book.questions || 0),
    0
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="text-gray-500 mt-1">
          Manage your textbooks and view platform overview.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Users"
          value={loading ? "..." : totalUsers.toString()}
          icon={<Users className="h-5 w-5 text-[#2c5f7c]" />}
          trend="Unique users with chat sessions"
          tooltip="Calculated by summing the user count from each textbook."
        />
        <MetricCard
          title="Total Questions"
          value={loading ? "..." : totalQuestions.toLocaleString()}
          icon={<HelpCircle className="h-5 w-5 text-[#3d7a9a]" />}
          trend="Questions asked across all textbooks"
          tooltip="Calculated by summing the question count from each textbook."
        />
        <MetricCard
          title="Total Textbooks"
          value={loading ? "..." : textbooks.length.toString()}
          icon={<FileText className="h-5 w-5 text-[#2c5f7c]" />}
          trend="Active textbooks in the system"
          tooltip="Total count of textbooks currently registered in the system."
        />
      </div>

      {/* Textbook Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Textbook Management
          </h3>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2c5f7c] hover:bg-[#234d63]">
                <Upload className="mr-2 h-4 w-4" />
                Add Textbooks (CSV)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Textbook CSV</DialogTitle>
                <DialogDescription>
                  Upload a detailed CSV file containing textbook metadata,
                  chapters, and content links. Max size 50MB.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!file ? (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files[0];
                      if (droppedFile) handleFileSelect(droppedFile);
                    }}
                    onClick={() =>
                      document.getElementById("csv-upload")?.click()
                    }
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Drag and drop your CSV here
                      </span>
                      <span className="text-xs text-gray-400">
                        or click to browse
                      </span>
                    </div>
                    <Input
                      id="csv-upload"
                      type="file"
                      className="hidden"
                      accept=".csv"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFileSelect(selectedFile);
                      }}
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-5 w-5 text-[#2c5f7c] flex-shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {file.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                        onClick={() => {
                          setFile(null);
                          setUploadStatus({ type: null, message: "" });
                        }}
                        disabled={uploading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                    {uploadStatus.message && (
                      <div
                        className={`text-sm p-2 rounded ${
                          uploadStatus.type === "success"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {uploadStatus.message}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-1">Required CSV Columns:</p>
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    Title, Author, Source (url), Book ID, others will be added
                    to the metadata
                  </code>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUploadOpen(false);
                    setFile(null);
                    setUploadStatus({ type: null, message: "" });
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#2c5f7c] hover:bg-[#234d63]"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload & Process"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by Title or Author..."
                className="pl-9 max-w-md bg-gray-50 border-gray-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Re-ingest</TableHead>
                  <TableHead>Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#2c5f7c]"></div>
                        <span className="text-gray-500">
                          Loading textbooks...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTextbooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-gray-500">
                        {searchQuery
                          ? "No textbooks found matching your search."
                          : "No textbooks available."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTextbooks.map((book) => (
                    <TableRow
                      key={book.id}
                      className="hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => navigate(`/admin/textbook/${book.id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span
                            className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-[300px]"
                            title={book.title}
                          >
                            {book.title}
                          </span>
                          <span
                            className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-[300px]"
                            title={book.author}
                          >
                            {book.author}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            book.status === "Active" ? "default" : "secondary"
                          }
                          className={
                            book.status === "Active"
                              ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200 shadow-none"
                              : book.status === "Ingesting"
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-none"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200 shadow-none"
                          }
                        >
                          {book.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {book.users}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {book.questions}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 mr-2">
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            {book.status === "Active" ? "Enabled" : "Disabled"}
                          </span>
                          <Switch
                            checked={book.status === "Active"}
                            onCheckedChange={() => toggleStatus(book.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-[#2c5f7c]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRefresh(book.id);
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(book.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
