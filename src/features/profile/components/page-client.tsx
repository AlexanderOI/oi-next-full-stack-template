"use client";

import type { AuthUser } from "@/lib/auth";
import { AvatarForm } from "./forms/avatar-form";
import { ProfileForm } from "./forms/profile-form";

interface PageClientProps {
  user: AuthUser;
}

export function ProfilePageClient({ user }: PageClientProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3/4">
        <ProfileForm user={user} />
      </div>
      <div className="w-1/4">
        <AvatarForm user={user} />
      </div>
    </div>
  );
}
