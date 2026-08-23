"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locales, type Locale } from "@/i18n/config";
import { updateLocale } from "../actions/update-locale";

interface Props {
  locale: Locale;
}

export function LanguageSelector({ locale }: Props) {
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
    <Field>
      <FieldLabel htmlFor="application-language">{t("language.label")}</FieldLabel>
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
      <FieldDescription aria-live="polite">
        {isPending ? t("language.saving") : t("language.description")}
      </FieldDescription>
    </Field>
  );
}
