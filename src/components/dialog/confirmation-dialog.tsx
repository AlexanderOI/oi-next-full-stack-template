"use client";

import { type ReactElement, type ReactNode, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  onConfirm: () => void | Promise<void>;
  trigger?: ReactElement;
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCancel?: () => void;
}

export function ConfirmationDialog({
  onConfirm,
  trigger,
  title = "Confirm action",
  description = "Are you sure you want to continue?",
  confirmLabel = "Confirm",
  pendingLabel = "Confirming...",
  cancelLabel = "Cancel",
  destructive = false,
  open,
  defaultOpen = false,
  onOpenChange,
  onCancel,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [isPending, setIsPending] = useState(false);

  const pendingRef = useRef(false);

  const isOpen = open ?? internalOpen;

  function setOpen(nextOpen: boolean) {
    if (pendingRef.current && !nextOpen) {
      return;
    }

    if (open === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  function handleCancel() {
    onCancel?.();
  }

  async function handleConfirm() {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);

    try {
      await onConfirm();
      pendingRef.current = false;
      setOpen(false);
    } catch {
      // The caller owns error presentation; retaining the dialog allows a retry.
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger render={trigger} />}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={handleCancel}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            aria-busy={isPending}
            onClick={handleConfirm}
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
