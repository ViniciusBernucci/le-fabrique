import {
  createEvidenceBackup,
  restoreEvidenceBackup,
  verifyEvidenceBackup,
} from "@le-fabrique/runtime";

const [command, ...argumentsList] = process.argv.slice(2);
const allowed = new Set([
  "--database-dump",
  "--snapshots",
  "--journal",
  "--key-file",
  "--output",
  "--archive",
  "--destination",
  "--confirm-services-stopped",
  "--confirm-isolated-destination",
]);
const flags = new Set(["--confirm-services-stopped", "--confirm-isolated-destination"]);
const values = new Map<string, string>();
async function main() {
  try {
    for (let index = 0; index < argumentsList.length; index++) {
      const key = argumentsList[index];
      if (!key || !allowed.has(key) || values.has(key))
        throw new Error("Unknown or duplicate backup option");
      if (flags.has(key)) values.set(key, "true");
      else {
        const value = argumentsList[++index];
        if (!value || value.startsWith("--")) throw new Error("Missing backup option value");
        values.set(key, value);
      }
    }
    const required = (key: string) => {
      const value = values.get(key);
      if (!value) throw new Error(`Missing required option ${key}`);
      return value;
    };
    let result: unknown;
    if (command === "create")
      result = await createEvidenceBackup({
        databaseDump: required("--database-dump"),
        snapshots: required("--snapshots"),
        journal: required("--journal"),
        keyFile: required("--key-file"),
        output: required("--output"),
        servicesStopped: values.get("--confirm-services-stopped") === "true",
      });
    else if (command === "verify")
      result = await verifyEvidenceBackup({
        archive: required("--archive"),
        keyFile: required("--key-file"),
      });
    else if (command === "restore")
      result = await restoreEvidenceBackup({
        archive: required("--archive"),
        keyFile: required("--key-file"),
        destination: required("--destination"),
        isolatedDestination: values.get("--confirm-isolated-destination") === "true",
      });
    else throw new Error("Choose backup create, verify or restore");
    console.log(JSON.stringify(result));
  } catch {
    // Filesystem/crypto parser errors can contain private paths or plaintext; never forward them.
    console.error(
      "Backup operation refused or failed. Check command, stopped services, private paths, key, limits and integrity. No overwrite is allowed.",
    );
    process.exitCode = 1;
  }
}
void main();
