import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureBodyLimits } from "./body-limits";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureBodyLimits(app);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  const webOrigin = process.env.WEB_ORIGIN;
  if (webOrigin) {
    app.enableCors({ origin: webOrigin, credentials: true });
  }

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
