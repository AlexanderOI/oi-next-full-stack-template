"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { AuthUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadAvatar } from "@/features/files/upload-image";
import { updateAvatar } from "@/features/profile/actions/update-avatar";

interface Props {
  user: AuthUser;
}

export function AvatarForm({ user }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayImage = preview ?? user.image;

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    startTransition(async () => {
      try {
        const { secureUrl } = await uploadAvatar(file);
        const result = await updateAvatar(secureUrl);

        if (!result.success) {
          throw new Error(result.error);
        }

        toast.success("Avatar updated");
      } catch (error) {
        setPreview(null);
        toast.error(error instanceof Error ? error.message : "Failed to upload image");
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        e.target.value = "";
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="group relative cursor-pointer"
      >
        <Avatar className="size-36">
          {displayImage && <AvatarImage src={displayImage} alt={user.name} />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {isPending ? (
            <Loader2 className="size-5 animate-spin text-white" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </div>
      </button>
      <p className="text-muted-foreground text-xs">Click to upload avatar</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
