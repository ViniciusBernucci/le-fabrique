import type { AccountSession } from "@le-fabrique/contracts";
import { afterEach, expect, it, vi } from "vitest";
import { captureAccountInvite } from "./AccountPanel";
import { AccountApiError, accountRequest } from "./account-api";

afterEach(() => vi.unstubAllGlobals());
it("uses cookies and anti-CSRF/account context without storing or forwarding an administrative token", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
  vi.stubGlobal("fetch", fetch);
  const session = {
    csrfToken: "fixture-csrf",
    organization: { id: "fixture-organization" },
  } as AccountSession;
  await accountRequest("/organization", session, "PUT", { name: "Team" });
  expect(fetch).toHaveBeenCalledWith(
    "/api/account/organization",
    expect.objectContaining({
      credentials: "include",
      headers: expect.objectContaining({
        "X-Account-CSRF": "fixture-csrf",
        "X-Account-Organization": "fixture-organization",
      }),
    }),
  );
  expect(fetch.mock.calls[0]?.[1].headers).not.toHaveProperty("Authorization");
});
it("keeps server conflict details usable for stale-state recovery", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "A conta ativa mudou." }),
    }),
  );
  await expect(accountRequest("/organization")).rejects.toMatchObject({
    status: 409,
    message: "A conta ativa mudou.",
  });
  await expect(accountRequest("/organization")).rejects.toBeInstanceOf(AccountApiError);
});
it("reads invitation fragments without consuming them during StrictMode state initialization", () => {
  const hash = `#account-invite=${"a".repeat(64)}`;
  vi.stubGlobal("window", { location: { hash } });
  expect(captureAccountInvite()).toBe("a".repeat(64));
  expect(captureAccountInvite()).toBe("a".repeat(64));
  expect(window.location.hash).toBe(hash);
});
