/**
 * One global exception filter, one error shape — the Node port of
 * `apps/core/exceptions.py`'s `envelope_exception_handler`.
 *
 * `error.request_id` is attached from the request context whenever one
 * exists; `error.debug` (message + stack) only when `DJANGO_DEBUG` is
 * true. Neither is a top-level key — `errorEnvelope()` puts both inside
 * `error`, matching `apps/core/envelope.py`.
 *
 * An exception can override its code by carrying an explicit `code`
 * property in its response body — `resolve()` reads that before falling
 * back to the status-code table. The three 401s rely on this.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.schema.js';
import { errorEnvelope } from '../envelope/envelope.js';
import { getRequestId } from '../logging/request-context.js';
import { log } from '../logging/logger.js';
import { getRequestPath } from '../http/request-path.js';
import {
  INTERNAL_MESSAGE,
  NON_FIELD_KEY,
  STATUS_TO_CODE,
  VALIDATION_MESSAGE,
} from './error-codes.js';

interface Resolved {
  status: number;
  code: string;
  message: string;
  fields: Record<string, string[]>;
}

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('exceptions');

  constructor(private readonly configService: ConfigService<Env, true>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolve(exception);
    const path = getRequestPath(request);

    if (resolved.status >= 500) {
      const excClass =
        exception instanceof Error
          ? exception.constructor.name
          : typeof exception;
      // Matches apps/core/exceptions.py's _internal_error_response structured
      // fields: http_path (never the full URL with its query string —
      // CONVENTIONS.md § 10/§ 34), http_method, exc_class.
      log('error', 'exceptions', `Unhandled exception at ${path}`, {
        http_path: path,
        http_method: request.method,
        exc_class: excClass,
      });
    }

    const envelope = errorEnvelope(
      resolved.code,
      resolved.message,
      resolved.fields,
    );

    const requestId = getRequestId();
    if (requestId && envelope.error) {
      envelope.error.request_id = requestId;
    }

    // Django passes `debug=` only from the unrecognised/500 path; every
    // recognised 4xx gets none, DEBUG or not. Attaching it to all errors
    // here would diverge on every 4xx.
    if (
      resolved.status >= 500 &&
      this.configService.get('DJANGO_DEBUG', { infer: true }) &&
      envelope.error
    ) {
      envelope.error.debug = {
        exception:
          exception instanceof Error ? exception.toString() : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      };
    }

    response.status(resolved.status).json(envelope);
  }

  private resolve(exception: unknown): Resolved {
    // Nest's ExpressAdapter.mapException rewrites the body-parser's raw
    // SyntaxError into a BadRequestException below this filter, so
    // `instanceof SyntaxError` can never be true here. The rewrap drops
    // `.type` and `.expose` too, leaving the message as the only signal
    // (V8's JSON.parse errors always mention "JSON").
    if (exception instanceof HttpException && exception.getStatus() === 400) {
      const body = exception.getResponse();
      const message =
        typeof body === 'object' &&
        body !== null &&
        typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : undefined;
      if (message?.includes('JSON')) {
        return {
          status: 400,
          code: 'parse_error',
          message: 'Malformed request body.',
          fields: {},
        };
      }
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    return {
      status: 500,
      code: 'internal_error',
      message: INTERNAL_MESSAGE,
      fields: {},
    };
  }

  private resolveHttpException(exception: HttpException): Resolved {
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;

      // A future validation pipe's own convention: pre-built field errors.
      if (record.fields && typeof record.fields === 'object') {
        return {
          status,
          code:
            typeof record.code === 'string'
              ? record.code
              : (STATUS_TO_CODE[status] ?? 'error'),
          message:
            typeof record.message === 'string'
              ? record.message
              : VALIDATION_MESSAGE,
          fields: record.fields as Record<string, string[]>,
        };
      }

      // class-validator's ValidationPipe shape: { message: string[], ... }.
      if (Array.isArray(record.message)) {
        const messages = record.message.map(String);
        return {
          status,
          code: STATUS_TO_CODE[status] ?? 'error',
          message:
            status === 400
              ? VALIDATION_MESSAGE
              : (messages[0] ?? INTERNAL_MESSAGE),
          fields: status === 400 ? { [NON_FIELD_KEY]: messages } : {},
        };
      }

      if (typeof record.message === 'string') {
        return {
          status,
          code:
            typeof record.code === 'string'
              ? record.code
              : (STATUS_TO_CODE[status] ?? 'error'),
          message: record.message,
          fields: {},
        };
      }
    }

    return {
      status,
      code: STATUS_TO_CODE[status] ?? 'error',
      message: typeof body === 'string' ? body : exception.message,
      fields: {},
    };
  }
}
