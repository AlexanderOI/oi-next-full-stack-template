"use client";

import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";

export default function BackupsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Dashboard" breadcrumbLabel="Dashboard" />

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
