"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { signIn } from "../auth-client";
import { createLoginSchema, type LoginInput } from "../contracts";

export function SignInForm() {
  const router = useRouter();
  const t = useTranslations("auth.signIn");
  const common = useTranslations("common");
  const validation = useTranslations("auth.validation");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(createLoginSchema(validation)),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    const response = data.identifier.includes("@")
      ? await signIn.email({ email: data.identifier, password: data.password })
      : await signIn.username({ username: data.identifier, password: data.password });

    if (response.error) setError(t("unknownError"));
    else router.push("/dashboard");
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <FormField name="identifier" label={t("identifier")} required>
              <Input type="text" placeholder={t("identifierPlaceholder")} autoComplete="username" />
            </FormField>
            <FormField name="password" label={common("password")} required>
              <Input type="password" placeholder="••••••••" autoComplete="current-password" />
            </FormField>
            <div className="flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-muted-foreground hover:text-primary text-sm"
              >
                {t("forgotPassword")}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("pending") : t("submit")}
            </Button>
          </form>
        </Form>
        <span className="text-sm text-red-500">{form.formState.errors.root?.message}</span>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          {t("noAccount")}{" "}
          <Link href="/auth/sign-up" className="text-primary font-medium hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
