import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfilePageClient } from "@/features/profile/components/page-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const { user } = session;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage your account</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfilePageClient user={user} />
        </CardContent>
      </Card>
    </div>
  );
}
