import { useState } from "react";
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
} from "recharts";

// Mock data for analytics
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

export default function Analytics() {
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
