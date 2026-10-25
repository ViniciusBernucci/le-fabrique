import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";

/** Never serialize or log raw Prisma errors with account/private-session arguments. */
@Catch()
export class AccountExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
      status(code: number): { json(body: unknown): void };
    }>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    const message =
      error instanceof HttpException
        ? error.message
        : "Serviço da conta temporariamente indisponível.";
    response.setHeader("Cache-Control", "no-store");
    response.status(status).json({ statusCode: status, message });
  }
}
