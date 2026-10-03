// Synthetic transport fixture only. This does not test Claude's native permission enforcement.
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("2.1.285 (Claude Code)");
  process.exit(0);
}
if (args.includes("auth")) {
  console.log(
    JSON.stringify({ loggedIn: true, authMethod: "claudeai", apiProvider: "firstParty" }),
  );
  process.exit(0);
}
const settings = JSON.parse(args[args.indexOf("--settings") + 1] || "{}");
if (
  args[args.indexOf("--permission-mode") + 1] !== "dontAsk" ||
  !settings.permissions?.allow?.length ||
  !args.includes("--restricted")
)
  process.exit(2);
let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  prompt += chunk;
});
process.stdin.on("end", () => {
  const first = prompt.match(/First Write ("(?:\\.|[^"\\])*")/);
  const second = prompt.match(/then Read ("(?:\\.|[^"\\])*")/);
  if (!first || !second) process.exit(3);
  let sequence = 0;
  const emit = (value) => {
    console.log(JSON.stringify(value));
  };
  const observe = (name, file, denied) => {
    const id = `fixture-${++sequence}`;
    emit({
      type: "assistant",
      message: { content: [{ type: "tool_use", id, name, input: { file_path: file } }] },
    });
    emit({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: id,
            is_error: denied,
            content: denied ? "Permission denied" : "Synthetic operation completed",
          },
        ],
      },
    });
  };
  emit({ type: "system", model: "synthetic-preflight-model" });
  const writePath = JSON.parse(first[1]);
  const editPath = JSON.parse(second[1]);
  fs.writeFileSync(writePath, "PROBE_WRITE");
  observe("Write", writePath, false);
  fs.writeFileSync(editPath, "PROBE_EDIT");
  observe("Edit", editPath, false);
  for (const match of prompt.matchAll(/Attempt (Write|Edit|Read) on ("(?:\\.|[^"\\])*")/g))
    observe(match[1], JSON.parse(match[2]), true);
  emit({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "Synthetic completed",
    usage: { input_tokens: 1, output_tokens: 1 },
  });
});
