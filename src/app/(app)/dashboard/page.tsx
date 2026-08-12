import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/features/dashboard/server";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <DashboardHeader title="Dashboard" breadcrumbLabel="Dashboard" />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600/15">
              <Clock className="size-4.5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">No content yet.</CardTitle>
              <CardDescription>No content yet.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">No content yet.</CardContent>
      </Card>
    </div>
  );
}
