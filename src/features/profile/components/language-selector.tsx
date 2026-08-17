"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locales, type Locale } from "@/i18n/config";
import { updateLocale } from "../actions/update-locale";

export function LanguageSelector({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = useTranslations("profile");
  const [isPending, startTransition] = useTransition();

  function handleChange(value: Locale | null) {
    if (!value || value === locale) return;
    startTransition(async () => {
      const result = await updateLocale(value);
      if (!result.success) {
        const key =
          result.code === "INVALID_LOCALE"
            ? "errors.invalidLocale"
            : result.code === "UNAUTHORIZED"
              ? "errors.unauthorized"
              : "errors.updateFailed";
        toast.error(t(key));
        return;
      }
      toast.success(t("language.saved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="application-language">{t("language.label")}</Label>
      <Select value={locale} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger id="application-language" className="w-full" aria-busy={isPending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`language.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {isPending ? t("language.saving") : t("language.description")}
      </p>
    </div>
  );
}
