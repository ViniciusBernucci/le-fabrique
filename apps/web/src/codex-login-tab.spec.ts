import { describe, expect, it, vi } from "vitest";
import { CodexLoginTab } from "./codex-login-tab";

function fixture() {
  return {
    opener: {},
    document: { title: "", body: { textContent: "" } },
    closed: false,
    location: { href: "about:blank", replace: vi.fn() },
    close: vi.fn(),
  };
}
describe("Codex login tab", () => {
  it("reserves a waiting page without an opener and navigates once to the official challenge", () => {
    const tab = fixture();
    const login = new CodexLoginTab(tab as unknown as Window);
    expect(tab.opener).toBeNull();
    expect(tab.document.body.textContent).toContain("Aguardando");
    expect(login.authorize("https://auth.openai.com/codex/device")).toBe(true);
    expect(tab.location.replace).toHaveBeenCalledWith("https://auth.openai.com/codex/device");
    expect(login.authorize("https://auth.openai.com/codex/device")).toBe(false);
    login.closeWaiting();
    expect(tab.close).not.toHaveBeenCalled();
  });
  it("retains manual link fallback when a browser blocks or closes the popup", () => {
    expect(new CodexLoginTab(null).authorize("https://auth.openai.com/codex/device")).toBe(false);
    const tab = fixture();
    tab.closed = true;
    expect(
      new CodexLoginTab(tab as unknown as Window).authorize("https://auth.openai.com/codex/device"),
    ).toBe(false);
  });
  it("refuses foreign URLs and preserves a tab the user already navigated elsewhere", () => {
    const tab = fixture();
    const login = new CodexLoginTab(tab as unknown as Window);
    expect(login.authorize("https://evil.example/login")).toBe(false);
    expect(login.authorize("https://user:password@auth.openai.com/codex/device")).toBe(false);
    tab.location.href = "https://example.com";
    expect(login.authorize("https://auth.openai.com/codex/device")).toBe(false);
    login.closeWaiting();
    expect(tab.close).not.toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });
  it("closes only the waiting page if requesting a session fails", () => {
    const tab = fixture();
    new CodexLoginTab(tab as unknown as Window).closeWaiting();
    expect(tab.close).toHaveBeenCalledOnce();
  });
});

describe("provider-specific login tabs", () => {
  it("allows only the selected Claude or Google provider", () => {
    const claude = fixture(),
      google = fixture();
    const claudeLogin = new CodexLoginTab(claude as unknown as Window, "CLAUDE");
    expect(claudeLogin.authorize("https://accounts.google.com/o/oauth2/auth")).toBe(false);
    expect(claudeLogin.authorize("https://claude.com/cai/oauth/authorize")).toBe(true);
    const googleLogin = new CodexLoginTab(google as unknown as Window, "ANTIGRAVITY");
    expect(googleLogin.authorize("https://claude.com/cai/oauth/authorize")).toBe(false);
    expect(googleLogin.authorize("https://accounts.google.com/o/oauth2/auth")).toBe(true);
  });
});
