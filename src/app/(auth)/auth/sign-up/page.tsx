"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, signUp } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/schemas/auth.schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Form, FormField } from "@/components/form";
import { GoogleIcon } from "@/components/icons/Google";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: RegisterInput) {
    setIsLoading(true);
    setError(null);

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

    router.push("/dashboard");
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true);
    setError(null);

    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch {
      setError("Failed to sign up with Google. Please try again.");
      setIsGoogleLoading(false);
    }
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

            <FormField name="name" label="Name" required>
              <Input type="text" placeholder="John Doe" autoComplete="name" />
            </FormField>

            <FormField name="username" label="Username" required>
              <Input
                type="text"
                placeholder="john.doe"
                autoComplete="username"
              />
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

        {/* <div className="relative my-6">
          <Separator />
          <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
            or continue with
          </span>
        </div> */}

        {/* <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
        >
          <GoogleIcon />
          {isGoogleLoading ? "Connecting..." : "Sign up with Google"}
        </Button> */}
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
