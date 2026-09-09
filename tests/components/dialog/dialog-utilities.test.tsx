import { fireEvent, renderInEnglish as render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "@/components/dialog/confirmation-dialog";
import { ContentDialog } from "@/components/dialog/content-dialog";
import { DeleteConfirmationDialog } from "@/components/dialog/delete-confirmation-dialog";
import { DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function content() {
  return (
    <DialogContent>
      <DialogTitle>Account details</DialogTitle>
      <DialogDescription>General account information</DialogDescription>
    </DialogContent>
  );
}

describe("ContentDialog", () => {
  it("opens uncontrolled content through the composed trigger element", async () => {
    const user = userEvent.setup();
    const onTriggerClick = vi.fn();
    render(
      <ContentDialog trigger={<button onClick={onTriggerClick}>View account</button>}>
        {content()}
      </ContentDialog>
    );

    await user.click(screen.getByRole("button", { name: "View account" }));

    expect(onTriggerClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Account details" })).toBeInTheDocument();
  });

  it("renders from controlled state and reports close requests", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const view = render(
      <ContentDialog open={false} onOpenChange={onOpenChange}>
        {content()}
      </ContentDialog>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    view.rerender(
      <ContentDialog open onOpenChange={onOpenChange}>
        {content()}
      </ContentDialog>
    );
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ConfirmationDialog", () => {
  it("awaits one pending confirmation and closes after it succeeds", async () => {
    const deferred = createDeferred();
    const onConfirm = vi.fn(() => deferred.promise);
    render(<ConfirmationDialog defaultOpen onConfirm={onConfirm} />);

    const confirm = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Confirming..." })).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    deferred.resolve();

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("stays open and allows retry after confirmation rejects", async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce();
    render(<ConfirmationDialog defaultOpen onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("button", { name: "Confirm" })).toBeEnabled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("cancels without confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmationDialog
        trigger={<button>Open confirmation</button>}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: "Open confirmation" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("requests closure from its controlled owner after success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ConfirmationDialog open onOpenChange={onOpenChange} onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("DeleteConfirmationDialog", () => {
  it("delegates deletion to the caller through a destructive confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DeleteConfirmationDialog defaultOpen onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
