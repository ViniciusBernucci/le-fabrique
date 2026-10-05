const args = process.argv.slice(2);

if (args.includes("--version")) {
  console.log("codex-cli test");
  process.exit(0);
}

if (args.includes("login") && args.includes("status")) {
  console.error("Logged in using ChatGPT");
  process.exit(0);
}

let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  prompt += chunk;
});
process.stdin.on("end", () => {
  if (prompt === "cancel" || prompt === "timeout") {
    process.on("SIGTERM", () => process.exit(0));
    setInterval(() => undefined, 1_000);
    return;
  }
  if (prompt === "rate") {
    console.log(JSON.stringify({ type: "turn.failed", error: { message: "rate limit exceeded" } }));
    console.error("rate limit exceeded: private provider detail");
    process.exit(1);
  }
  const failures = {
    auth: "authentication login required",
    context: "context length too large",
    denied: "sandbox permission denied",
    transient: "provider unavailable",
  };
  if (failures[prompt]) {
    console.error(failures[prompt]);
    process.exit(1);
  }
  if (prompt === "large") {
    console.log("x".repeat(2_048));
    setInterval(() => undefined, 1_000);
    return;
  }
  if (prompt === "malformed") {
    console.log("not-json");
    setInterval(() => undefined, 1_000);
    return;
  }

  const keysPresent = Boolean(process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY);
  const profilePresent = args.some(
    (value) => value.includes('":root"="deny"') && value.includes("network={ enabled=false }"),
  );
  const permissionsArgument =
    args.find((value) => value.startsWith("permissions.lefabrique=")) || "";
  const writablePaths = [...permissionsArgument.matchAll(/"([^"]+)"="write"/g)]
    .map((match) => match[1])
    .filter((path) => path !== ".");
  const access = writablePaths.length > 0 ? writablePaths.join(",") : "read";
  console.log(JSON.stringify({ type: "thread.started", thread_id: "synthetic-thread" }));
  console.log(
    JSON.stringify({
      type: "item.completed",
      item: { type: "reasoning", text: "private chain of thought fixture" },
    }),
  );
  console.log(
    JSON.stringify({
      type: "item.completed",
      item: { type: "command_execution", aggregated_output: "sensitive command output" },
    }),
  );
  console.log(
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: `prompt=${prompt};keys=${keysPresent};profile=${profilePresent};access=${access}`,
      },
    }),
  );
  console.log(
    JSON.stringify({
      type: "turn.completed",
      usage: {
        input_tokens: 100,
        cached_input_tokens: 40,
        output_tokens: 10,
        reasoning_output_tokens: 2,
      },
    }),
  );
});
