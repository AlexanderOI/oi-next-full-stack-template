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
  createPasswordResetSchema,
  type PasswordResetInput,
} from "../schemas/password-reset-schema";

interface Props {
  token: string | null;
}

export function PasswordResetForm({ token }: Props) {
  const t = useTranslations("auth.resetPassword");
  const validation = useTranslations("auth.validation");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const form = useForm<PasswordResetInput>({
    resolver: zodResolver(createPasswordResetSchema(validation)),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function handleSubmit(data: PasswordResetInput) {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authClient.resetPassword({ newPassword: data.newPassword, token });

      if (response.error) {
        setError(t("failed"));
        return;
      }

      form.reset();
      setPasswordReset(true);
    } catch {
      setError(t("failed"));
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("invalidTitle")}</CardTitle>
          <CardDescription role="alert">{t("invalidDescription")}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link
            href="/auth/forgot-password"
            className="text-primary text-sm font-medium hover:underline"
          >
            {t("requestAnother")}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (passwordReset) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("successTitle")}</CardTitle>
          <CardDescription role="status" aria-live="polite">
            {t("successDescription")}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/auth/sign-in" className="text-primary text-sm font-medium hover:underline">
            {t("signIn")}
          </Link>
        </CardFooter>
      </Card>
    );
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
                <p>{error}</p>
                <Link href="/auth/forgot-password" className="font-medium underline">
                  {t("requestAnother")}
                </Link>
              </div>
            )}
            <FormField name="newPassword" label={t("newPassword")} required>
              <Input type="password" aria-label={t("newPassword")} autoComplete="new-password" />
            </FormField>
            <FormField name="confirmPassword" label={t("confirmPassword")} required>
              <Input
                type="password"
                aria-label={t("confirmPassword")}
                autoComplete="new-password"
              />
            </FormField>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !token}
              aria-live="polite"
            >
              {isLoading ? t("pending") : t("submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
