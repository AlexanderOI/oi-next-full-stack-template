"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <section className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-10">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-muted-foreground">{t("notFoundDescription")}</p>
      </div>
      <div className="flex gap-2">
        <Link href="/dashboard">
          <Button>{t("goBack")}</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">{t("goHome")}</Button>
        </Link>
      </div>
    </section>
  );
}
