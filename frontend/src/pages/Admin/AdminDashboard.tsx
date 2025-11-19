import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  BarChart3,
  LogOut,
  Search,
  Upload,
  Trash2,
  RefreshCw,
  FileText,
  Users,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { AuthService } from "@/functions/authService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// --- Mock Data ---

const analyticsData = [
  { date: "Apr 2", users: 120, questions: 45, materials: 30 },
  { date: "Apr 10", users: 180, questions: 90, materials: 55 },
  { date: "Apr 18", users: 250, questions: 150, materials: 80 },
  { date: "May 6", users: 210, questions: 120, materials: 70 },
  { date: "May 15", users: 190, questions: 100, materials: 60 },
  { date: "May 24", users: 280, questions: 200, materials: 110 },
  { date: "Jun 1", users: 350, questions: 310, materials: 140 },
  { date: "Jun 9", users: 380, questions: 340, materials: 155 },
  { date: "Jun 18", users: 370, questions: 330, materials: 160 },
  { date: "Jun 29", users: 340, questions: 290, materials: 145 },
];

const materialTypeData = [
  { name: "MCQ", value: 650, fill: "#2c5f7c" },
  { name: "Short Answer", value: 850, fill: "#3d7a9a" },
  { name: "Flashcards", value: 550, fill: "#4a8fb0" },
];

type TextbookData = {
  id: string | number;
  title: string;
  author: string;
  status: string;
  users: number;
  questions: number;
};

const initialTextbooks: TextbookData[] = [];

// --- Components ---

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState<"dashboard" | "analytics">(
    "dashboard"
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#2c5f7c] to-[#3d7a9a] text-white h-16 flex items-center px-6 shadow-md z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <h1 className="text-xl font-semibold">OpenED AI</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex">
          <div className="p-4 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Menu
            </div>
            <Button
              variant={activeView === "dashboard" ? "secondary" : "ghost"}
              className={`w-full justify-start ${
                activeView === "dashboard"
                  ? "bg-[#2c5f7c]/10 text-[#2c5f7c] font-medium"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveView("dashboard")}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard & Management
            </Button>
            <Button
              variant={activeView === "analytics" ? "secondary" : "ghost"}
              className={`w-full justify-start ${
                activeView === "analytics"
                  ? "bg-[#2c5f7c]/10 text-[#2c5f7c] font-medium"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveView("analytics")}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </div>

          <div className="p-4 border-t border-gray-100">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeView === "dashboard" ? <DashboardView /> : <AnalyticsView />}
        </main>
      </div>
    </div>
  );
}

function DashboardView() {
  const [textbooks, setTextbooks] = useState(initialTextbooks);
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

        // Transform API data to match component format
        const transformedTextbooks = data.textbooks.map((book: any) => ({
          id: book.id,
          title: book.title,
          author: book.authors?.join(", ") || "Unknown Author",
          status: "Active", // Default to Active, you can add a status field to the DB if needed
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

function AnalyticsView() {
  const [timeRange, setTimeRange] = useState("3m");

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Analytics</h2>
          <p className="text-gray-500 mt-1">
            Deep dive into student engagement and content usage.
          </p>
        </div>
        <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
          <Button
            variant={timeRange === "3m" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTimeRange("3m")}
            className="text-xs h-8"
          >
            Last 3 months
          </Button>
          <Button
            variant={timeRange === "30d" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            className="text-xs h-8"
          >
            Last 30 Days
          </Button>
          <Button
            variant={timeRange === "7d" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            className="text-xs h-8"
          >
            Last 7 Days
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Users Chart */}
        <ChartCard
          title="Total Users"
          subtitle="Total active students over time"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analyticsData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#2c5f7c"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Total Questions Chart */}
        <ChartCard
          title="Total Questions"
          subtitle="Questions asked to chatbots"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analyticsData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="questions"
                stroke="#3d7a9a"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Total Practice Materials Chart */}
        <ChartCard
          title="Total Practice Materials"
          subtitle="Generated practice sets"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analyticsData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="materials"
                stroke="#2c5f7c"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Material Type Bar Chart */}
        <ChartCard
          title="Material Type"
          subtitle="Distribution of generated content"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={materialTypeData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white border border-gray-200 p-2 rounded-lg shadow-lg text-xs">
                        <p className="font-semibold mb-1">
                          {payload[0].payload.name}
                        </p>
                        <p className="text-gray-600">
                          Count:{" "}
                          <span className="font-bold text-gray-900">
                            {payload[0].value}
                          </span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// --- Helper Components ---

function MetricCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
}) {
  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-green-600 font-medium">{trend}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 border-b border-gray-50 bg-gray-50/50">
        <CardTitle className="text-base font-semibold text-gray-900">
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="p-6 h-[300px]">{children}</CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xl text-sm">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div
            key={index}
            className="flex items-center gap-2 text-xs text-gray-600 mb-1"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="capitalize">{entry.name}:</span>
            <span className="font-bold text-gray-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
