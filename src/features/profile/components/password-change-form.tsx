"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "../actions/change-password";
import { createPasswordChangeSchema, type PasswordChangeInput } from "../contracts";

export function PasswordChangeForm() {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("profile");
  const validation = useTranslations("profile.validation");

  const form = useForm<PasswordChangeInput>({
    resolver: zodResolver(createPasswordChangeSchema(validation)),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  function onSubmit(data: PasswordChangeInput) {
    startTransition(async () => {
      const result = await changePassword(data);

      if (!result.success) {
        toast.error(
          t(result.code === "VALIDATION_ERROR" ? "errors.validation" : "errors.passwordFailed")
        );
        return;
      }

      form.reset();
      toast.success(t("passwordChanged"));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("changePassword")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">{t("currentPassword")}</FieldLabel>
              <Input id="currentPassword" type="password" {...form.register("currentPassword")} />
              <FieldError
                errors={
                  form.formState.errors.currentPassword
                    ? [form.formState.errors.currentPassword]
                    : undefined
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="newPassword">{t("newPassword")}</FieldLabel>
              <Input id="newPassword" type="password" {...form.register("newPassword")} />
              <FieldError
                errors={
                  form.formState.errors.newPassword
                    ? [form.formState.errors.newPassword]
                    : undefined
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
              <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
              <FieldError
                errors={
                  form.formState.errors.confirmPassword
                    ? [form.formState.errors.confirmPassword]
                    : undefined
                }
              />
            </Field>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? t("changingPassword") : t("changePassword")}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
