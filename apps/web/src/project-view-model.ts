import { gitCommitShaSchema } from "@le-fabrique/contracts";

export function hasExecutableBaseRevision(baseRef: string): boolean {
  return gitCommitShaSchema.safeParse(baseRef).success;
}
