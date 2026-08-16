import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/ui/page-header";

describe("PageHeader", () => {
  it("renders title, description, and actions as one page header", () => {
    render(
      <PageHeader title="Roles" description="Manage access">
        <button type="button">Create role</button>
      </PageHeader>
    );

    const header = screen.getByRole("banner");
    expect(header).toContainElement(screen.getByRole("heading", { name: "Roles", level: 1 }));
    expect(header).toContainElement(screen.getByText("Manage access"));
    expect(header).toContainElement(screen.getByRole("button", { name: "Create role" }));
  });
});
