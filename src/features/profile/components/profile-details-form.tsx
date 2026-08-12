"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FieldGroup } from "@/components/ui/field";

import { updateProfile } from "../actions/update-profile";
import { type ProfileInput, type ProfileUser, profileSchema } from "../contracts";

interface ProfileDetailsFormProps {
  user: ProfileUser;
}

export function ProfileDetailsForm({ user }: ProfileDetailsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      username: user.username || "",
      email: user.email || "",
    },
  });

  function onSubmit(data: ProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(data);

      if (!result.success) {
        if (result.details) {
          for (const [field, messages] of Object.entries(result.details)) {
            const message = messages?.[0];
            if (message) {
              form.setError(field as keyof ProfileInput, { message });
            }
          }
        }

        toast.error(result.error);
        if (result.profileUpdated) router.refresh();
        return;
      }

      toast.success(
        result.emailVerificationSent
          ? "Profile updated. Check your new email to confirm the address change."
          : "Profile updated"
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <FormField name="name" label="Name" required>
              <Input autoComplete="name" />
            </FormField>

            <FormField name="username" label="Username" required>
              <Input autoComplete="username" />
            </FormField>

            <FormField
              name="email"
              label="Email"
              description="Changing your email requires verification at the new address."
              required
            >
              <Input type="email" autoComplete="email" />
            </FormField>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Form>
    </div>
  );
}
