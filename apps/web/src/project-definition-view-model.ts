import type { ContextSourceRole, ProjectExecutionProfile } from "@le-fabrique/contracts";

export function parsePathLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseContextSourceLines(value: string): ProjectExecutionProfile["contextSources"] {
  const sources = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [path, rawRole, ...extra] = line.split("|").map((part) => part.trim());
      if (!path || !rawRole || extra.length > 0) {
        throw new Error("Context sources must use the format path | ROLE");
      }
      const role = rawRole.toUpperCase() as ContextSourceRole;
      if (
        ![
          "INSTRUCTION",
          "TICKET",
          "SPECIFICATION",
          "ARCHITECTURE",
          "SOURCE",
          "TEST",
          "FINDING",
        ].includes(role)
      ) {
        throw new Error("Context source role is not supported");
      }
      return { path, role };
    });
  return sources;
}

export function formatContextSourceLines(
  sources: ProjectExecutionProfile["contextSources"],
): string {
  return sources.map(({ path, role }) => `${path} | ${role}`).join("\n");
}

export function parseCheckArguments(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((argument) => typeof argument === "string")) {
    throw new Error("Check arguments must be a JSON string array");
  }
  return parsed;
}
