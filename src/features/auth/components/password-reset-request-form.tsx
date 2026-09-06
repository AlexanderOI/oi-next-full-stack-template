"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "../lib/auth-client";
import {
  createPasswordResetRequestSchema,
  type PasswordResetRequestInput,
} from "../schemas/password-reset-request-schema";

export function PasswordResetRequestForm() {
  const t = useTranslations("auth.forgotPassword");
  const common = useTranslations("common");
  const validation = useTranslations("auth.validation");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const form = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(createPasswordResetRequestSchema(validation)),
    defaultValues: { email: "" },
  });

  async function handleSubmit(data: PasswordResetRequestInput) {
    setIsLoading(true);
    setError(null);
    setRequestSent(false);

    try {
      const response = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: "/auth/reset-password",
      });

      if (response.error) {
        setError(t("serviceError"));
        return;
      }

      form.reset();
      setRequestSent(true);
    } catch {
      setError(t("serviceError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
              >
                {error}
              </div>
            )}
            {requestSent && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
              >
                {t("success")}
              </div>
            )}
            <FormField name="email" label={common("email")} required>
              <Input
                type="email"
                aria-label={common("email")}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={isLoading} aria-live="polite">
              {isLoading ? t("pending") : t("submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/auth/sign-in" className="text-primary text-sm font-medium hover:underline">
          {t("backToSignIn")}
        </Link>
      </CardFooter>
    </Card>
  );
}
