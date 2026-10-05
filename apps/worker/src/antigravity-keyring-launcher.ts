import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import path from "node:path";

/** Runs only under a fresh dbus-run-session, with an account-private HOME. */
async function main() {
  process.umask(0o077);
  const [binary, secretPath, ...args] = process.argv.slice(2);
  if (
    !binary ||
    !secretPath ||
    !path.isAbsolute(binary) ||
    !path.isAbsolute(secretPath) ||
    !process.env.DBUS_SESSION_BUS_ADDRESS
  )
    throw new Error("Private keyring configuration unavailable");
  const file = await open(secretPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let password: Buffer;
  try {
    const metadata = await file.stat();
    if (
      !metadata.isFile() ||
      metadata.uid !== process.getuid?.() ||
      (metadata.mode & 0o077) !== 0 ||
      metadata.size !== 64
    )
      throw new Error("Private keyring configuration unavailable");
    password = await file.readFile();
  } finally {
    await file.close();
  }
  if (!/^[a-f0-9]{64}$/.test(password.toString()))
    throw new Error("Private keyring configuration unavailable");
  if (!process.env.XDG_RUNTIME_DIR) throw new Error("Private keyring configuration unavailable");
  const controlDirectory = await mkdtemp(path.join(process.env.XDG_RUNTIME_DIR, "keyring-"));
  const daemon = spawn(
    "/usr/bin/gnome-keyring-daemon",
    ["--foreground", "--unlock", "--components=secrets", "--control-directory", controlDirectory],
    { env: process.env, shell: false, stdio: ["pipe", "ignore", "ignore"] },
  );
  daemon.stdin.on("error", () => {});
  daemon.on("error", () => {});
  daemon.stdin.end(Buffer.concat([password, Buffer.from("\n")]));
  password.fill(0);
  let client: ReturnType<typeof spawn> | undefined;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30 && !ready; attempt++) {
      ready = await new Promise<boolean>((resolve) => {
        let output = "";
        const probe = spawn(
          "/usr/bin/dbus-send",
          [
            "--session",
            "--dest=org.freedesktop.DBus",
            "--type=method_call",
            "--print-reply",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus.NameHasOwner",
            "string:org.freedesktop.secrets",
          ],
          { env: process.env, shell: false, stdio: ["ignore", "pipe", "ignore"] },
        );
        const timer = setTimeout(() => probe.kill("SIGKILL"), 1000);
        probe.stdout.on("data", (chunk) => {
          if (output.length < 4096) output += chunk.toString();
        });
        probe.once("error", () => {
          clearTimeout(timer);
          resolve(false);
        });
        probe.once("close", () => {
          clearTimeout(timer);
          resolve(/boolean true/.test(output));
        });
      });
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error("Private keyring service unavailable");
    client = spawn(binary, args, { env: process.env, shell: false, stdio: "inherit" });
    const code = await new Promise<number | null>((resolve, reject) => {
      client?.once("error", () => reject(new Error("Official client unavailable")));
      client?.once("exit", resolve);
    });
    process.exitCode = code ?? 1;
  } finally {
    client?.kill("SIGKILL");
    daemon.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (daemon.exitCode !== null || daemon.signalCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        daemon.kill("SIGKILL");
        resolve();
      }, 1000);
      daemon.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await rm(controlDirectory, { recursive: true, force: true });
  }
}
void main().catch(() => {
  console.error("Antigravity private keyring or official client unavailable");
  process.exitCode = 1;
});
