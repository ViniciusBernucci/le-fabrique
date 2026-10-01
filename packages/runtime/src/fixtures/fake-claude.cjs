const args = process.argv.slice(2);

if (args.includes("--version")) {
  process.stdout.write("2.1.285 (Claude Code)\n");
  process.exit(0);
}

if (args.includes("auth") && args.includes("status")) {
  process.stdout.write(
    JSON.stringify({
      loggedIn: process.env.FAKE_CLAUDE_LOGGED_IN !== "false",
      authMethod: process.env.FAKE_CLAUDE_AUTH_METHOD || "claudeai",
      apiProvider: process.env.FAKE_CLAUDE_API_PROVIDER || "firstParty",
    }),
  );
  process.exit(0);
}

let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  prompt += chunk;
});
process.stdin.on("end", () => {
  if (prompt === "cancel" || prompt === "timeout") {
    setInterval(() => {}, 1000);
    return;
  }
  if (prompt === "malformed") {
    process.stdout.write("not-json\n");
    return;
  }
  if (prompt === "large") {
    process.stdout.write("x".repeat(32 * 1024));
    return;
  }
  const failure = {
    auth: "login required: private account detail",
    rate: "usage limit reached: private quota detail",
    denied: "permission denied: private path",
    context: "context length too large: private prompt",
    transient: "provider unavailable: private diagnostic",
  }[prompt];
  if (failure) {
    process.stdout.write(
      `${JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: failure, session_id: "private-session" })}\n`,
    );
    process.exit(1);
  }
  const keysPresent = Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.ANTHROPIC_BASE_URL ||
      process.env.CLAUDE_CODE_USE_BEDROCK ||
      process.env.CLAUDE_CODE_USE_VERTEX ||
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.CLAUDE_CODE_OAUTH_TOKEN,
  );
  const requiredFlags = [
    "--safe-mode",
    "--restricted",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--no-chrome",
  ].every((flag) => args.includes(flag));
  const permissionPromptsIndex = args.indexOf("--permission-prompts");
  const safePermissions =
    permissionPromptsIndex >= 0 &&
    args[permissionPromptsIndex + 1] === "none" &&
    !args.includes("--dangerously-skip-permissions");
  const tools = args[args.indexOf("--tools") + 1] || "";
  const access = tools.includes("Write") ? "write" : "read";
  process.stdout.write(
    `${JSON.stringify({ type: "system", subtype: "init", session_id: "synthetic-claude-session", model: "synthetic-claude" })}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "private reasoning omitted" },
          {
            type: "tool_use",
            name: access === "write" ? "Edit" : "Read",
            input: { private: true },
          },
        ],
      },
    })}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: "synthetic-claude-session", result: `prompt=${prompt};keys=${keysPresent};profile=${requiredFlags && safePermissions};access=${access}`, usage: { input_tokens: 80, cache_read_input_tokens: 20, output_tokens: 8 } })}\n`,
  );
});

process.on("SIGTERM", () => process.exit(143));
