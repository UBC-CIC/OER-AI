import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Cell,
} from "recharts";
import { AuthService } from "@/functions/authService";

type TimeSeriesData = {
  date: string;
  users: number;
  questions: number;
};

type ChatSessionData = {
  name: string;
  sessions: number;
};

type PracticeAnalyticsData = {
  total_generated: number;
  by_type: { material_type: string; count: number }[];
};

type AnalyticsData = {
  timeSeries: TimeSeriesData[];
  chatSessionsByTextbook: ChatSessionData[];
  practiceAnalytics: PracticeAnalyticsData | null;
};

type ChartCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

function ChartCard({ title, subtitle, children }: ChartCardProps) {
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
              style={{ backgroundColor: entry.color || entry.fill }}
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

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("3m");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    timeSeries: [],
    chatSessionsByTextbook: [],
    practiceAnalytics: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await AuthService.getAuthSession(true);
      const token = session.tokens.idToken;

      const [generalResponse, practiceResponse] = await Promise.all([
        fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/admin/analytics?timeRange=${timeRange}`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        ),
        fetch(`${import.meta.env.VITE_API_ENDPOINT}/admin/analytics/practice`, {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!generalResponse.ok || !practiceResponse.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const generalData = await generalResponse.json();
      const practiceData = await practiceResponse.json();

      setAnalyticsData({
        ...generalData,
        practiceAnalytics: practiceData,
      });
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  const formatMaterialType = (type: string) => {
    const map: Record<string, string> = {
      short_answer: "Short Answer",
      flashcard: "Flashcards",
      mcq: "Multiple Choice",
    };
    return (
      map[type] ||
      type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2c5f7c]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Users Chart */}
          <ChartCard
            title="Total Users"
            subtitle="Total active students over time"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={analyticsData.timeSeries}
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
                data={analyticsData.timeSeries}
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

          {/* Aggregated Practice Materials Chart */}
          <ChartCard
            title="Practice Materials Generated"
            subtitle="Distribution by type across all textbooks"
          >
            {analyticsData.practiceAnalytics ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.practiceAnalytics.by_type}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="material_type"
                    tickFormatter={formatMaterialType}
                  />
                  <YAxis />
                  <Tooltip
                    content={<CustomTooltip />}
                    labelFormatter={formatMaterialType}
                  />
                  <Bar dataKey="count" fill="#2c5f7c">
                    {analyticsData.practiceAnalytics.by_type.map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      )
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-sm">No data available</p>
              </div>
            )}
          </ChartCard>

          {/* Chat Sessions per Textbook Bar Chart */}
          <ChartCard
            title="Chat Sessions by Textbook"
            subtitle="Distribution of chat sessions across textbooks"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analyticsData.chatSessionsByTextbook}
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
                  angle={-45}
                  textAnchor="end"
                  height={80}
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
                            Sessions:{" "}
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
                <Bar
                  dataKey="sessions"
                  fill="#2c5f7c"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
