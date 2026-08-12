import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/server";
import { AvatarUploader, PasswordChangeForm, ProfileDetailsForm } from "@/features/profile/client";
import type { ProfileUser } from "@/features/profile/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const user: ProfileUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    username: session.user.username ?? null,
    image: session.user.image ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage your account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-3/4">
              <ProfileDetailsForm user={user} />
            </div>
            <div className="w-1/4">
              <AvatarUploader user={user} />
            </div>
          </div>
        </CardContent>
      </Card>
      <PasswordChangeForm />
    </div>
  );
}
