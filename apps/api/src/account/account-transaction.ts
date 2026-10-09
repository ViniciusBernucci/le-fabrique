import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
/** Reuse domain services inside the same transaction as the account permission check.
 * Their callback transactions join this transaction; no separate commit or writer is created. */
export function scopedClient(tx: Prisma.TransactionClient): PrismaService {
  return new Proxy(tx, {
    get(target, key) {
      if (key === "$transaction")
        return (callback: (t: Prisma.TransactionClient) => unknown) => callback(tx);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as PrismaService;
}
