import type { Prisma } from "@prisma/client";

/** The database invariant is mandatory; a similarly named ordinary index is insufficient. */
export async function hasGlobalWriterGuard(
  transaction: Prisma.TransactionClient,
): Promise<boolean> {
  const [guard] = await transaction.$queryRaw<{ installed: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class ix ON ix.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = current_schema() AND t.relname = 'attempts'
        AND ix.relname = 'attempts_single_unconfirmed_writer'
        AND i.indisunique AND i.indisvalid
        AND pg_get_expr(i.indexprs, i.indrelid) = '1'
        AND pg_get_expr(i.indpred, i.indrelid) = '(stopped_confirmed = false)'
    ) AS installed`;
  return guard?.installed === true;
}
