"use strict";

const {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmdirSync,
  symlinkSync,
  writeFileSync,
} = require("node:fs");
const { basename, join } = require("node:path");
const { spawnSync } = require("node:child_process");

function checked(binary, args) {
  const result = spawnSync(binary, args, { stdio: "ignore" });
  if (result.error || result.status !== 0) throw new Error("sandbox isolation setup failed");
}

function mountTmpfs(target, options) {
  checked("/usr/bin/mount", ["-t", "tmpfs", "-o", options, "tmpfs", target]);
}

function bindReadonly(source, target) {
  checked("/usr/bin/mount", ["--bind", source, target]);
  checked("/usr/bin/mount", ["-o", "remount,bind,ro", target]);
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o755 });
}

function installDevice(root, name) {
  const target = join(root, "dev", name);
  writeFileSync(target, "", { mode: 0o600 });
  checked("/usr/bin/mount", ["--bind", `/dev/${name}`, target]);
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

let root = null;
let rootMounted = false;
let pivoted = false;

try {
  checked("/usr/bin/mount", ["--make-rprivate", "/"]);
  root = mkdtempSync("/tmp/le-fabrique-sandbox-root-");
  mountTmpfs(root, "mode=755,nodev,nosuid,noexec,size=256m");
  rootMounted = true;

  for (const directory of [
    "dev",
    "etc",
    "home",
    "mnt",
    "opt",
    "proc",
    "root",
    "run",
    "sys",
    "tmp",
    "usr",
    "var",
  ]) {
    ensureDirectory(join(root, directory));
  }
  for (const directory of ["var/cache", "var/lib", "var/log", "var/tmp", "dev/shm"]) {
    ensureDirectory(join(root, directory));
  }

  checked("/usr/bin/mount", ["--bind", "/usr", join(root, "usr")]);
  checked("/usr/bin/mount", ["-o", "remount,bind,ro", join(root, "usr")]);
  bindReadonly(workspace, join(root, "mnt"));

  const writablePaths = JSON.parse(Buffer.from(encodedWritablePaths, "base64url").toString("utf8"));
  if (!Array.isArray(writablePaths)) throw new Error("sandbox isolation setup failed");
  for (const writablePath of writablePaths) {
    if (
      typeof writablePath !== "string" ||
      writablePath.startsWith("/") ||
      writablePath
        .split("/")
        .some((segment) => !segment || segment === "." || segment === ".." || segment === ".git")
    ) {
      throw new Error("sandbox isolation setup failed");
    }
    const target = join(root, "mnt", writablePath);
    checked("/usr/bin/mount", ["--bind", target, target]);
    checked("/usr/bin/mount", ["-o", "remount,bind,rw", target]);
  }

  for (const name of ["bin", "lib", "lib64", "sbin"]) {
    symlinkSync(`usr/${name}`, join(root, name));
  }

  for (const directory of ["home", "root", "run", "sys", "tmp", "var"]) {
    const options =
      directory === "tmp"
        ? "mode=1777,nosuid,nodev,noexec,size=128m"
        : "mode=755,nosuid,nodev,noexec,size=32m";
    mountTmpfs(join(root, directory), options);
  }
  ensureDirectory(join(root, "tmp", "home"));
  chmodSync(join(root, "tmp", "home"), 0o700);
  writeFileSync(join(root, "etc", "passwd"), "root:x:0:0:Le Fabrique sandbox:/tmp/home:/bin/sh\n");
  writeFileSync(join(root, "etc", "group"), "root:x:0:\n\nnogroup:x:65534:\n");
  ensureDirectory(join(root, "var", "cache"));
  ensureDirectory(join(root, "var", "lib"));
  ensureDirectory(join(root, "var", "log"));
  ensureDirectory(join(root, "var", "tmp"));
  ensureDirectory(join(root, "dev", "shm"));
  mountTmpfs(join(root, "dev", "shm"), "mode=1777,nosuid,nodev,noexec,size=32m");
  for (const name of ["null", "random", "urandom", "zero"]) installDevice(root, name);

  checked("/usr/bin/mount", ["--move", "/proc", join(root, "proc")]);
  ensureDirectory(join(root, ".oldroot"));
  checked("/usr/sbin/pivot_root", [root, join(root, ".oldroot")]);
  pivoted = true;
  process.chdir("/");

  // Remove the temporary mountpoint from the detached host tree before hiding that tree.
  checked("/usr/bin/rmdir", [join("/.oldroot", "tmp", basename(root))]);
  checked("/usr/bin/umount", ["-l", "/.oldroot"]);
  rmdirSync("/.oldroot");
  process.chdir("/mnt");

  const requestedEnvironment = JSON.parse(
    Buffer.from(encodedEnvironment, "base64url").toString("utf8"),
  );
  const environment = {
    HOME: "/tmp/home",
    LANG: "C.UTF-8",
    PATH: "/usr/local/bin:/usr/bin:/bin",
    TMPDIR: "/tmp",
    ...requestedEnvironment,
  };
  const result = spawnSync(
    "/usr/bin/setpriv",
    [
      "--no-new-privs",
      "--bounding-set=-all",
      "--inh-caps=-all",
      "--ambient-caps=-all",
      "--securebits=+noroot,+noroot_locked,+no_setuid_fixup,+no_setuid_fixup_locked",
      "--",
      "/usr/bin/prlimit",
      `--nofile=${maxOpenFiles}`,
      `--fsize=${maxFileBytes}`,
      "--",
      command,
      ...args,
    ],
    { cwd: "/mnt", env: environment, stdio: "inherit" },
  );
  if (result.error) throw new Error("sandbox command could not start");
  process.exitCode = result.status ?? 125;
} catch {
  process.exitCode = 125;
} finally {
  if (root && !pivoted) {
    if (rootMounted) spawnSync("/usr/bin/umount", ["-l", root], { stdio: "ignore" });
    spawnSync("/usr/bin/rmdir", [root], { stdio: "ignore" });
  }
}
