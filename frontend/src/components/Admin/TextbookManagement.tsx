import { useState, useEffect } from "react";
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

  const filteredTextbooks = textbooks.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStatus = (id: string | number) => {
    setTextbooks(
      textbooks.map((book) =>
        book.id === id
          ? {
              ...book,
              status: book.status === "Active" ? "Disabled" : "Active",
            }
          : book
      )
    );
  };

  const handleDelete = (id: string | number) => {
    setTextbooks(textbooks.filter((book) => book.id !== id));
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
          status: "Active",
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
        />
        <MetricCard
          title="Total Questions"
          value={loading ? "..." : totalQuestions.toLocaleString()}
          icon={<HelpCircle className="h-5 w-5 text-[#3d7a9a]" />}
          trend="Questions asked across all textbooks"
        />
        <MetricCard
          title="Total Textbooks"
          value={loading ? "..." : textbooks.length.toString()}
          icon={<FileText className="h-5 w-5 text-[#2c5f7c]" />}
          trend="Active textbooks in the system"
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
                  chapters, and content links.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">
                      Drag and drop your CSV here
                    </span>
                    <span className="text-xs text-gray-400">
                      or click to browse
                    </span>
                  </div>
                  <Input type="file" className="hidden" accept=".csv" />
                </div>
                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-1">Required CSV Columns:</p>
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    title, author, isbn, category, content_url
                  </code>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsUploadOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#2c5f7c] hover:bg-[#234d63]"
                  onClick={() => setIsUploadOpen(false)}
                >
                  Upload & Process
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
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableRow key={book.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {book.title}
                          </span>
                          <span className="text-xs text-gray-500">
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex items-center gap-2 mr-2">
                            <span className="text-xs text-gray-400 hidden sm:inline">
                              {book.status === "Active"
                                ? "Enabled"
                                : "Disabled"}
                            </span>
                            <Switch
                              checked={book.status === "Active"}
                              onCheckedChange={() => toggleStatus(book.id)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-[#2c5f7c]"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                            onClick={() => handleDelete(book.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
