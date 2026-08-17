import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderInEnglish as render, screen, waitFor } from "@/test/test-utils";
import { LanguageSelector } from "@/features/profile/components/language-selector";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), updateLocale: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/profile/actions/update-locale", () => ({ updateLocale: mocks.updateLocale }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("LanguageSelector", () => {
  it("persists a readable language choice and refreshes the current route", async () => {
    mocks.updateLocale.mockResolvedValue({ success: true, locale: "es" });
    const user = userEvent.setup();
    render(<LanguageSelector locale="en" />);

    await user.click(screen.getByRole("combobox", { name: "Application language" }));
    await user.click(screen.getByRole("option", { name: "Spanish" }));

    await waitFor(() => expect(mocks.updateLocale).toHaveBeenCalledWith("es"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
