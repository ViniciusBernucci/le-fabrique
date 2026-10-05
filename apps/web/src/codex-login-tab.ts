/** Reserve the tab during the user gesture; redirect only when the official challenge arrives. */
export class CodexLoginTab {
  private waiting = true;
  constructor(private readonly tab: Window | null) {
    if (!tab) return;
    tab.opener = null;
    tab.document.title = "Conectar assinatura Codex";
    tab.document.body.textContent =
      "Aguardando a URL oficial do Codex. Volte à Le Fabrique para consultar o código temporário e o andamento do login.";
  }

  authorize(url: string): boolean {
    if (!this.waiting || !this.tab || this.tab.closed) return false;
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !["auth.openai.com", "chatgpt.com"].includes(parsed.hostname) ||
      parsed.username ||
      parsed.password
    )
      return false;
    try {
      if (this.tab.location.href !== "about:blank") return false;
      this.tab.location.replace(url);
      this.waiting = false;
      return true;
    } catch {
      return false;
    }
  }

  closeWaiting(): void {
    if (!this.waiting || !this.tab || this.tab.closed) return;
    try {
      if (this.tab.location.href === "about:blank") this.tab.close();
    } catch {
      /* Preserve a tab the user navigated elsewhere. */
    }
    this.waiting = false;
  }
}

export function openCodexLoginTab(): CodexLoginTab {
  return new CodexLoginTab(window.open("about:blank", "_blank"));
}
