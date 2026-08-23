"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FieldGroup } from "@/components/ui/field";

import { updateProfile } from "../actions/update-profile";
import { createProfileSchema, type ProfileInput, type ProfileUser } from "../contracts";

interface Props {
  user: ProfileUser;
}

export function ProfileDetailsForm({ user }: Props) {
  const router = useRouter();

  const t = useTranslations("profile");
  const common = useTranslations("common");
  const validation = useTranslations("profile.validation");

  const [isPending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(createProfileSchema(validation)),
    defaultValues: {
      name: user.name,
      username: user.username || "",
      email: user.email || "",
    },
  });

  function handleSubmit(data: ProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(data);

      if (!result.success) {
        if (result.details) {
          for (const [field, messages] of Object.entries(result.details)) {
            const message = messages?.[0];
            if (message) {
              form.setError(field as keyof ProfileInput, {
                message:
                  message === "usernameTaken"
                    ? t("errors.usernameTaken")
                    : validation(message as never),
              });
            }
          }
        }

        const errorKey =
          result.code === "USERNAME_TAKEN"
            ? "errors.usernameTaken"
            : result.code === "EMAIL_VERIFICATION_FAILED"
              ? "errors.partialEmailFailure"
              : result.code === "VALIDATION_ERROR"
                ? "errors.validation"
                : "errors.updateFailed";
        toast.error(t(errorKey));
        if (result.profileUpdated) router.refresh();
        return;
      }

      toast.success(result.emailVerificationSent ? t("updatedEmailPending") : t("updated"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <FieldGroup>
            <FormField name="name" label={common("name")} required>
              <Input autoComplete="name" />
            </FormField>

            <FormField name="username" label={common("username")} required>
              <Input autoComplete="username" />
            </FormField>

            <FormField
              name="email"
              label={common("email")}
              description={t("emailChangeHint")}
              required
            >
              <Input type="email" autoComplete="email" />
            </FormField>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? common("saving") : t("saveChanges")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Form>
    </div>
  );
}
