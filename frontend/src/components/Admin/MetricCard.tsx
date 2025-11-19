import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
};

export default function MetricCard({
  title,
  value,
  icon,
  trend,
}: MetricCardProps) {
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
