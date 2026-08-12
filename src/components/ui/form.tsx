"use client";

import React from "react";
import {
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form";

import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";

/**
 * Form wrapper that provides FormProvider context
 */
export function Form<TFieldValues extends FieldValues>(
  props: React.ComponentProps<typeof FormProvider<TFieldValues>>
) {
  return <FormProvider {...props} />;
}

/**
 * FormField props type
 */
type FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  name: TName;
  label?: string;
  description?: string;
  required?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
};

/**
 * FormField component that connects react-hook-form with shadcn Field
 * Automatically handles validation, errors, and accessibility
 */
export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  name,
  label,
  description,
  required,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  const { control } = useFormContext<TFieldValues>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field>
          {label && (
            <FieldLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FieldLabel>
          )}

          {description && <FieldDescription>{description}</FieldDescription>}

          {React.cloneElement(children, {
            ...field,
            "aria-invalid": !!fieldState.error,
            "aria-required": required,
          })}

          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/**
 * FormField with render props pattern for more control
 * Use this when you need custom rendering or multiple elements
 */
type FormFieldRenderProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  name: TName;
  label?: string;
  description?: string;
  required?: boolean;
  render: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
    fieldState: ControllerFieldState;
  }) => React.ReactNode;
};

export function FormFieldRender<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ name, label, description, required, render }: FormFieldRenderProps<TFieldValues, TName>) {
  const { control } = useFormContext<TFieldValues>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field>
          {label && (
            <FieldLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FieldLabel>
          )}

          {description && <FieldDescription>{description}</FieldDescription>}

          {render({
            field,
            fieldState,
          })}

          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
