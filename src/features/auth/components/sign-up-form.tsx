"use client";

import { useState } from "react";
import Link from "next/link";
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
import { signUp } from "../auth-client";
import { registerSchema, type RegisterInput } from "../contracts";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", username: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(data: RegisterInput) {
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
      setError(response.error.message ?? "Failed to create account. Please try again.");
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
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Get started with your free account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            {verificationSent && (
              <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                Account created. Check your email to verify your account before signing in.
              </div>
            )}
            <FormField name="name" label="Name" required>
              <Input type="text" placeholder="John Doe" autoComplete="name" />
            </FormField>
            <FormField name="username" label="Username" required>
              <Input type="text" placeholder="john.doe" autoComplete="username" />
            </FormField>
            <FormField name="email" label="Email" required>
              <Input type="email" placeholder="you@example.com" autoComplete="email" />
            </FormField>
            <FormField
              name="password"
              label="Password"
              description="Must be at least 8 characters"
              required
            >
              <Input type="password" placeholder="••••••••" autoComplete="new-password" />
            </FormField>
            <FormField name="confirmPassword" label="Confirm Password" required>
              <Input type="password" placeholder="••••••••" autoComplete="new-password" />
            </FormField>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
