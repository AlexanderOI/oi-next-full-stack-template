import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AuthorizationProvider,
  Permission,
} from "@/features/authorization/components/authorization-provider";
import { PERMISSIONS } from "@/features/authorization/contracts";

describe("Permission", () => {
  it("fails closed without a provider", () => {
    render(<Permission permissions={PERMISSIONS.ROLES_READ}>secret</Permission>);
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders allowed content and fallback for denied content", () => {
    render(
      <AuthorizationProvider
        snapshot={{ userId: "u1", roles: ["member"], permissions: [PERMISSIONS.PROFILE_READ_OWN] }}
      >
        <Permission permissions={PERMISSIONS.PROFILE_READ_OWN}>
          <span>profile</span>
        </Permission>
        <Permission permissions={PERMISSIONS.ROLES_READ} fallback={<span>denied</span>}>
          <span>roles</span>
        </Permission>
      </AuthorizationProvider>
    );
    expect(screen.getByText("profile")).toBeInTheDocument();
    expect(screen.getByText("denied")).toBeInTheDocument();
    expect(screen.queryByText("roles")).not.toBeInTheDocument();
  });
});
