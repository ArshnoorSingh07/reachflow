import { WorkspaceHeader } from "../../frontend/src/components/WorkspaceHeader";
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "../../frontend/src/components/AccountMenu";
import { api } from "../../frontend/src/services/api";
import { Login } from "../../frontend/src/pages/Login";
it("account menu offers session and all-device sign out", async () => {
  const user = userEvent.setup(),
    logout = vi.fn().mockResolvedValue(undefined);
  render(
    <AccountMenu
      user={{
        name: "Alex Morgan",
        email: "alex@example.com",
        avatar: "",
        isAdmin: false,
      }}
      onLogout={logout}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Account menu" }));
  expect(screen.getByRole("menu")).toHaveTextContent("Google account · Member");
  await user.click(
    screen.getByRole("menuitem", { name: "Sign out all devices" }),
  );
  expect(logout).toHaveBeenCalledWith(true);
});
it("HTTP client obtains a CSRF token from the authenticated session and attaches it to writes", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { name: "Alex" },
          csrfToken: "secure-session-token",
        }),
        { status: 200 },
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  await api("/api/me");
  await api("/api/logout", { method: "POST" });
  expect(
    (fetch.mock.calls[1][1]?.headers as Record<string, string>)["x-csrf-token"],
  ).toBe("secure-session-token");
});
it("sign-in page requires real Google sign-in", () => {
  render(<Login error="" googleConfigured={false} />);
  expect(
    screen.getByRole("link", { name: "Login with Google" }),
  ).toHaveAttribute("href", "/auth/google");
  expect(
    screen.queryByRole("button", { name: /demo/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/Google sign-in needs to be configured/),
  ).toBeInTheDocument();
});

it("top header displays name, email, avatar and a working logout action", async () => {
  const user = userEvent.setup(),
    logout = vi.fn().mockResolvedValue(undefined);
  render(
    <WorkspaceHeader
      user={{
        name: "Alex Morgan",
        email: "alex@example.com",
        avatar: "https://api.dicebear.com/10.x/initials/svg?seed=AM&chars=2",
      }}
      title="Scheduled emails"
      onLogout={logout}
    />,
  );
  expect(screen.getByRole("banner")).toHaveTextContent("Alex Morgan");
  expect(screen.getByRole("banner")).toHaveTextContent("alex@example.com");
  expect(
    screen.getByRole("img", { name: "Alex Morgan's profile" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Account menu" }));
  await user.click(screen.getByRole("menuitem", { name: "Logout" }));
  expect(logout).toHaveBeenCalledWith(false);
});

it("registers an email account through the real auth endpoint contract", async () => {
  const user = userEvent.setup(),
    done = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response('{"ok":true}', {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
  );
  render(<Login error="" onAuthenticated={done} />);
  await user.click(
    screen.getByRole("button", { name: "or sign up through email" }),
  );
  await user.type(screen.getByLabelText("First name"), "Alex");
  await user.type(screen.getByLabelText("Last name"), "Morgan");
  await user.type(screen.getByLabelText("Email ID"), "new@example.com");
  await user.type(screen.getByLabelText("Password"), "a-long-private-password");
  await user.click(screen.getByRole("button", { name: "Sign up" }));
  expect(fetch.mock.calls[0][0]).toBe("/auth/register");
  expect(done).toHaveBeenCalledOnce();
});
