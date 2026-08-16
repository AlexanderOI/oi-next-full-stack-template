import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission, PERMISSIONS } from "@/features/authorization/client";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-muted-foreground">
          Manage access without granting permissions directly to users.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Permission permissions={PERMISSIONS.ROLES_READ}>
          <Link href="/admin/roles">
            <Card className="hover:bg-muted/40 h-full transition-colors">
              <CardHeader>
                <CardTitle>Roles</CardTitle>
              </CardHeader>
              <CardContent>Configure reusable permission sets.</CardContent>
            </Card>
          </Link>
        </Permission>
        <Permission permissions={PERMISSIONS.USERS_READ}>
          <Link href="/admin/users">
            <Card className="hover:bg-muted/40 h-full transition-colors">
              <CardHeader>
                <CardTitle>Users</CardTitle>
              </CardHeader>
              <CardContent>Assign one or more roles to each user.</CardContent>
            </Card>
          </Link>
        </Permission>
      </div>
    </div>
  );
}
