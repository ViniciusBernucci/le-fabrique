import { ARTIFACT_HTTP_MAX_BYTES } from "@le-fabrique/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";

/** Bounded artifact plus the authenticated worker/fence envelope; never unlimited. */
export function configureBodyLimits(app: NestExpressApplication): void {
  app.useBodyParser("json", { limit: ARTIFACT_HTTP_MAX_BYTES });
}
