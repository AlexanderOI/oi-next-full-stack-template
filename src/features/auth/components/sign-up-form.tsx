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
import { signUp } from "../auth-client";
import { createRegisterSchema, type RegisterInput } from "../contracts";

export function SignUpForm() {
  const t = useTranslations("auth.signUp");
  const common = useTranslations("common");
  const validation = useTranslations("auth.validation");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(createRegisterSchema(validation)),
    defaultValues: { name: "", email: "", username: "", password: "", confirmPassword: "" },
  });

  async function handleSubmit(data: RegisterInput) {
    setIsLoading(true);
    setError(null);
    setVerificationSent(false);
    const response = await signUp.email({
      name: data.name,
      email: data.email,
      username: data.username,
      password: data.password,
    });
    if (response.error) {
      setError(t("failed"));
      setIsLoading(false);
      return;
    }
    form.reset();
    setVerificationSent(true);
    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            {verificationSent && (
              <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                {t("verificationSent")}
              </div>
            )}
            <FormField name="name" label={common("name")} required>
              <Input type="text" placeholder={t("namePlaceholder")} autoComplete="name" />
            </FormField>
            <FormField name="username" label={common("username")} required>
              <Input type="text" placeholder={t("usernamePlaceholder")} autoComplete="username" />
            </FormField>
            <FormField name="email" label={common("email")} required>
              <Input type="email" placeholder={t("emailPlaceholder")} autoComplete="email" />
            </FormField>
            <FormField
              name="password"
              label={common("password")}
              description={t("passwordHint")}
              required
            >
              <Input type="password" placeholder="••••••••" autoComplete="new-password" />
            </FormField>
            <FormField name="confirmPassword" label={t("confirmPassword")} required>
              <Input type="password" placeholder="••••••••" autoComplete="new-password" />
            </FormField>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("pending") : t("submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          {t("hasAccount")}{" "}
          <Link href="/auth/sign-in" className="text-primary font-medium hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
