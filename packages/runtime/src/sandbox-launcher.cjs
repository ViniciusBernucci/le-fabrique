"use strict";

const { spawnSync } = require("node:child_process");

function checked(binary, args) {
  const result = spawnSync(binary, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 125);
}

const [
  workspace,
  maxOpenFiles,
  maxFileBytes,
  encodedEnvironment,
  encodedWritablePaths,
  separator,
  command,
  ...args
] = process.argv.slice(2);
if (
  !workspace ||
  !maxOpenFiles ||
  !maxFileBytes ||
  !encodedEnvironment ||
  !encodedWritablePaths ||
  separator !== "--" ||
  !command
) {
  process.exit(125);
}

checked("/usr/bin/mount", ["--make-rprivate", "/"]);
checked("/usr/bin/mount", ["--bind", workspace, "/mnt"]);
checked("/usr/bin/mount", ["-o", "remount,bind,ro", "/mnt"]);
const writablePaths = JSON.parse(Buffer.from(encodedWritablePaths, "base64url").toString("utf8"));
if (!Array.isArray(writablePaths)) process.exit(125);
for (const writablePath of writablePaths) {
  if (
    typeof writablePath !== "string" ||
    writablePath.startsWith("/") ||
    writablePath
      .split("/")
      .some((segment) => !segment || segment === "." || segment === ".." || segment === ".git")
  ) {
    process.exit(125);
  }
  const target = `/mnt/${writablePath}`;
  checked("/usr/bin/mount", ["--bind", target, target]);
  checked("/usr/bin/mount", ["-o", "remount,bind,rw", target]);
}
checked("/usr/bin/mount", ["-t", "tmpfs", "-o", "mode=700,nosuid,nodev,noexec", "tmpfs", "/home"]);
checked("/usr/bin/mount", ["-t", "tmpfs", "-o", "mode=700,nosuid,nodev,noexec", "tmpfs", "/root"]);
checked("/usr/bin/mount", ["-t", "tmpfs", "-o", "mode=700,nosuid,nodev", "tmpfs", "/run"]);
checked("/usr/bin/mount", ["-t", "tmpfs", "-o", "mode=700,nosuid,nodev", "tmpfs", "/tmp"]);
checked("/usr/bin/mount", ["-t", "tmpfs", "-o", "mode=700,nosuid,nodev", "tmpfs", "/var/tmp"]);
checked("/usr/bin/mount", ["-t", "tmpfs", "-o", "mode=700,nosuid,nodev", "tmpfs", "/dev/shm"]);
process.chdir("/mnt");

const requestedEnvironment = JSON.parse(
  Buffer.from(encodedEnvironment, "base64url").toString("utf8"),
);
const environment = {
  HOME: "/nonexistent",
  LANG: "C.UTF-8",
  PATH: "/usr/local/bin:/usr/bin:/bin",
  TMPDIR: "/tmp",
  ...requestedEnvironment,
};
const result = spawnSync(
  "/usr/bin/prlimit",
  [`--nofile=${maxOpenFiles}`, `--fsize=${maxFileBytes}`, "--", command, ...args],
  { cwd: "/mnt", env: environment, stdio: "inherit" },
);
process.exit(result.status ?? 125);
