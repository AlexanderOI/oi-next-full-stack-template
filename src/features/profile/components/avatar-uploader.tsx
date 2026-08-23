"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateAvatar } from "../actions/update-avatar";
import type { ProfileUser } from "../contracts";

interface Props {
  user: ProfileUser;
}

export function AvatarUploader({ user }: Props) {
  const t = useTranslations("profile");

  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.error(t("validation.imageType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("validation.imageSize"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    startTransition(async () => {
      try {
        const result = await updateAvatar(file);

        if (!result.success) {
          toast.error(
            t(
              result.code === "AVATAR_TOO_LARGE"
                ? "validation.imageSize"
                : result.code === "AVATAR_INVALID_TYPE"
                  ? "validation.imageType"
                  : "errors.avatarFailed"
            )
          );
          setPreview(null);
          return;
        }

        toast.success(t("avatarUpdated"));
      } catch {
        setPreview(null);
        toast.error(t("errors.avatarFailed"));
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
        aria-label={t("uploadAvatarLabel")}
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
      <p className="text-muted-foreground text-xs">{t("uploadAvatar")}</p>
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
