import { executionArtifactSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ArtifactView } from "./ArtifactPanel";

it("shows full diff as escaped text and offers a deliberate JSON download", () => {
  const patch = "+<script>alert('untrusted')</script>\n";
  const artifact = executionArtifactSchema.parse({
    schemaVersion: 1,
    manifest: {
      schemaVersion: 1,
      snapshotId: crypto.randomUUID(),
      baseRevision: "a".repeat(40),
      headRevision: "a".repeat(40),
      patchBytes: patch.length,
      patchSha256: "c".repeat(64),
      untracked: [],
      totalArtifactBytes: patch.length,
      createdAt: new Date().toISOString(),
      manifestHash: "d".repeat(64),
    },
    patchBase64: btoa(patch),
    files: [],
  });
  const html = renderToStaticMarkup(<ArtifactView artifact={artifact} />);
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("Baixar bundle JSON");
  expect(html).toContain("Baixar não aplica");
});
