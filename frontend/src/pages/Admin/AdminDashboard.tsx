import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("admin_session");
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage admin users</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Users</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Textbooks</CardTitle>
              <CardDescription>Manage textbook content</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Textbooks</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chat Sessions</CardTitle>
              <CardDescription>Monitor user interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Sessions</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
