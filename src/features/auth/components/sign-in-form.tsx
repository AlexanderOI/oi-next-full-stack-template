"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { loginSchema, type LoginInput } from "../contracts";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    const response = data.identifier.includes("@")
      ? await signIn.email({ email: data.identifier, password: data.password })
      : await signIn.username({ username: data.identifier, password: data.password });

    if (response.error) setError(response.error.message ?? "An unknown error occurred");
    else router.push("/dashboard");
    setIsLoading(false);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            <FormField name="identifier" label="Email or Username" required>
              <Input
                type="text"
                placeholder="you@example.com or username"
                autoComplete="username"
              />
            </FormField>
            <FormField name="password" label="Password" required>
              <Input type="password" placeholder="••••••••" autoComplete="current-password" />
            </FormField>
            <div className="flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-muted-foreground hover:text-primary text-sm"
              >
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Form>
        <span className="text-sm text-red-500">{form.formState.errors.root?.message}</span>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
