import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiError } from '@repo/types';
import type { Request, Response } from 'express';

import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../errors/domain-errors';
import { assignCorrelationId } from '../logging/correlation-id';

interface Mapped {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  /** Extra fields for the filter's log line; never sent to the client. */
  log?: Record<string, unknown>;
}

/**
 * Client errors from Express's body parsers (`express.json()`,
 * `express.urlencoded()`, via body-parser and raw-body), keyed by the `type`
 * they set. They are raised before any route or the request logger runs.
 * Each gets a fixed message: the parsers' own messages can echo client input
 * (`unsupported charset "…"`).
 *
 * Not listed, so they stay an opaque 500: `stream.encoding.set` and
 * `stream.not.readable`, which raw-body raises with status 500 for a server
 * fault. Malformed JSON (`entity.parse.failed`) is a `SyntaxError`, which Nest
 * turns into a 400 `BadRequestException` before this filter sees it.
 */
const BODY_PARSER_ERRORS: Readonly<Record<string, Omit<Mapped, 'details' | 'log'>>> = {
  'entity.too.large': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request body is too large.',
  },
  'parameters.too.many': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request body has too many parameters.',
  },
  'charset.unsupported': {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'The request body charset is not supported.',
  },
  'encoding.unsupported': {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'The request body content encoding is not supported.',
  },
  'request.aborted': {
    status: HttpStatus.BAD_REQUEST,
    code: 'BAD_REQUEST',
    message: 'The request body was not received in full.',
  },
  'request.size.invalid': {
    status: HttpStatus.BAD_REQUEST,
    code: 'BAD_REQUEST',
    message: 'The request body does not match its Content-Length.',
  },
  // A URL-encoded body nested deeper than the parser allows.
  'querystring.parse.rangeError': {
    status: HttpStatus.BAD_REQUEST,
    code: 'BAD_REQUEST',
    message: 'The request body is nested too deeply.',
  },
  // Only raised when a parser is given a `verify` function (none today).
  'entity.verify.failed': {
    status: HttpStatus.FORBIDDEN,
    code: 'FORBIDDEN',
    message: 'The request body was rejected.',
  },
};

function bodyParserErrorType(exception: unknown): string | undefined {
  if (!(exception instanceof Error)) return undefined;
  const { type } = exception as Error & { type?: unknown };
  return typeof type === 'string' && Object.hasOwn(BODY_PARSER_ERRORS, type) ? type : undefined;
}

/**
 * Global exception filter: maps every error — domain errors, HTTP exceptions,
 * Prisma errors, and unexpected failures — to the standard {@link ApiError}
 * envelope. Internal details and stack traces never reach the client. 5xx are
 * logged as incidents with the correlation id; 4xx are expected outcomes.
 * See docs/BACKEND_ARCHITECTURE.md (Error handling).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const mapped = this.mapException(exception);
    // A request rejected before the request logger ran (body parsing) has no
    // id yet; give it one so the log line and the response still carry it.
    const correlationId = request.id ?? assignCorrelationId(request, response);

    const body: ApiError = {
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details === undefined ? {} : { details: mapped.details }),
      },
    };

    if (mapped.status >= 500) {
      this.logger.error(
        { correlationId, err: exception, path: request.url },
        `Unhandled ${mapped.status} on ${request.method} ${request.url}`,
      );
    } else {
      this.logger.warn(
        { correlationId, code: mapped.code, path: request.url, ...mapped.log },
        `${mapped.status} ${mapped.code} on ${request.method} ${request.url}`,
      );
    }

    response.status(mapped.status).json(body);
  }

  private mapException(exception: unknown): Mapped {
    if (exception instanceof DomainError) {
      return {
        status: this.domainStatus(exception),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrisma(exception);
    }

    if (exception instanceof HttpException) {
      return this.mapHttp(exception);
    }

    const bodyParserType = bodyParserErrorType(exception);
    if (bodyParserType !== undefined) {
      return { ...BODY_PARSER_ERRORS[bodyParserType]!, log: { type: bodyParserType } };
    }

    // Unknown/unexpected → opaque 500 (never leak internals).
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private domainStatus(error: DomainError): number {
    if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
    if (error instanceof ConflictError) return HttpStatus.CONFLICT;
    if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
    if (error instanceof ValidationError) return HttpStatus.UNPROCESSABLE_ENTITY;
    return HttpStatus.BAD_REQUEST;
  }

  private mapPrisma(error: Prisma.PrismaClientKnownRequestError): Mapped {
    switch (error.code) {
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Resource not found.' };
      // Inconsistent column data: a value Prisma cannot convert to the column's
      // type, such as a malformed UUID. Boundary validation (ParseUuidPipe,
      // IsCursor) should stop these first; this keeps a missed one a 400
      // rather than a 500 (docs/API.md → Status codes).
      case 'P2023':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'BAD_REQUEST',
          message: 'The request contains a malformed value.',
        };
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'A resource with these details already exists.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        };
    }
  }

  private mapHttp(exception: HttpException): Mapped {
    const status = exception.getStatus();
    const res = exception.getResponse();
    // Nest's ValidationPipe returns { message: string[], error, statusCode }.
    let message = exception.message;
    let details: unknown;
    if (typeof res === 'object' && res !== null) {
      const record = res as Record<string, unknown>;
      if (Array.isArray(record.message)) {
        message = 'Validation failed.';
        details = record.message;
      } else if (typeof record.message === 'string') {
        message = record.message;
      }
    }
    return { status, code: this.statusCode(status), message, details };
  }

  private statusCode(status: number): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
      [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_FAILED',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    };
    return codes[status] ?? 'ERROR';
  }
}
