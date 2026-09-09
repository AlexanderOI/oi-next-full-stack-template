"use client";

import type { ReactElement, ReactNode } from "react";

import { Dialog, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  children: ReactNode;
  trigger?: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ContentDialog({ children, trigger, open, defaultOpen, onOpenChange }: Props) {
  function handleOpenChange(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
  }

  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      {children}
    </Dialog>
  );
}
