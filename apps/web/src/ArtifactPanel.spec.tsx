import { executionArtifactSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ArtifactView } from "./ArtifactPanel";

it.each([0, 128 * 1024])(
  "shows full diff (%i padding bytes) as escaped text and offers a deliberate JSON download",
  (padding) => {
    const patch = `${"x".repeat(padding)}+<script>alert('untrusted')</script>\n+end-of-patch\n`;
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
    expect(html).toContain("+end-of-patch");
    expect(html).toContain("8 MiB");
  },
);
