import { ConflictException, HttpException, HttpStatus } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/** Shared row lock orders claim and administrative pause commits. */
export async function factorySchedulingPause(
  transaction: Prisma.TransactionClient,
): Promise<boolean> {
  const [state] = await transaction.$queryRaw<{ paused: boolean }[]>`
    SELECT paused FROM factory_operations WHERE id='factory' FOR SHARE`;
  if (!state || typeof state.paused !== "boolean")
    throw new ConflictException("Factory scheduling is uninitialized");
  return state.paused;
}
export async function requireFactoryScheduling(transaction: Prisma.TransactionClient) {
  if (await factorySchedulingPause(transaction))
    throw new HttpException(
      { code: "FACTORY_PAUSED", message: "Factory scheduling is paused" },
      HttpStatus.LOCKED,
    );
}
