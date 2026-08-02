"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, HelpCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DashboardHeader() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/sign-in");
  };
  return (
    <header className="bg-header border-header-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex items-center gap-2">
        <div className="bg-primary flex size-7 items-center justify-center rounded-lg">
          <Zap className="text-primary-foreground size-4" />
        </div>
        <div className="hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors">
          <span className="font-medium">oi-nextjs</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar size="sm" className="rounded-lg">
              <AvatarFallback className="bg-primary/20 text-primary text-xs">JD</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} variant="destructive">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
