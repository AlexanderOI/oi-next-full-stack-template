import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
      <p className="text-muted-foreground text-sm font-medium">403</p>
      <h1 className="text-3xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">You do not have permission to view this resource.</p>
      <Button render={<Link href="/dashboard" />}>Return to dashboard</Button>
    </div>
  );
}
