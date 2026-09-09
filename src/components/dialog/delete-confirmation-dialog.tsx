"use client";

import type { ReactElement, ReactNode } from "react";

import { ConfirmationDialog } from "./confirmation-dialog";

interface Props {
  onDelete: () => void | Promise<void>;
  trigger?: ReactElement;
  title?: ReactNode;
  description?: ReactNode;
  deleteLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCancel?: () => void;
}

export function DeleteConfirmationDialog({
  onDelete,
  trigger,
  title = "Delete item",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  deleteLabel = "Delete",
  pendingLabel = "Deleting...",
  cancelLabel,
  open,
  defaultOpen,
  onOpenChange,
  onCancel,
}: Props) {
  return (
    <ConfirmationDialog
      onConfirm={onDelete}
      trigger={trigger}
      title={title}
      description={description}
      confirmLabel={deleteLabel}
      pendingLabel={pendingLabel}
      cancelLabel={cancelLabel}
      destructive
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      onCancel={onCancel}
    />
  );
}
