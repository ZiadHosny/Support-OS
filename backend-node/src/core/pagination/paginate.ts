/**
 * The Node port of `apps/core/pagination.py`'s `DefaultPageNumberPagination
 * .get_paginated_response`. No domain module uses this in NODE-1 — it
 * exists so `NODE-4` (the first domain module) does not invent its own.
 *
 * Query params are `page` and `page_size`. `page_size` above the ceiling
 * is CLAMPED, not rejected (`README.md` § API conventions, "Paginated").
 * `next`/`previous` are absolute URLs built from the incoming request,
 * matching DRF; they will differ by host/port between the two services —
 * expected, and `NODE-2`'s harness compares shape and semantics, not
 * generated identifiers or hosts.
 */

import type { Request } from 'express';
import { successEnvelope, type Envelope } from '../envelope/envelope.js';
import { getRequestPath } from '../http/request-path.js';

export interface PageParams {
  page: number;
  pageSize: number;
}

export function resolvePageParams(
  request: Request,
  defaultPageSize: number,
  maxPageSize: number,
): PageParams {
  const rawPage = Number(request.query.page);
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawPageSize = Number(request.query.page_size);
  let pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.floor(rawPageSize)
      : defaultPageSize;
  if (pageSize > maxPageSize) {
    pageSize = maxPageSize;
  }

  return { page, pageSize };
}

export interface Pagination {
  count: number;
  page: number;
  page_size: number;
  num_pages: number;
  next: string | null;
  previous: string | null;
}

export function paginate<T>(options: {
  request: Request;
  rows: T[];
  count: number;
  page: number;
  pageSize: number;
}): Envelope<T[]> {
  const { request, rows, count, page, pageSize } = options;
  const numPages = pageSize > 0 ? Math.ceil(count / pageSize) : 0;

  const buildPageUrl = (targetPage: number): string | null => {
    if (targetPage < 1 || targetPage > numPages) {
      return null;
    }
    const host = request.get('host') ?? 'localhost';
    // getRequestPath(), not request.path: this handler may run behind
    // Nest's global-prefix middleware mount, where request.path is
    // relative to that mount point rather than the true root.
    const url = new URL(
      `${request.protocol}://${host}${getRequestPath(request)}`,
    );
    for (const [key, value] of Object.entries(request.query)) {
      if (typeof value === 'string') {
        url.searchParams.set(key, value);
      }
    }
    url.searchParams.set('page', String(targetPage));
    url.searchParams.set('page_size', String(pageSize));
    return url.toString();
  };

  const pagination: Pagination = {
    count,
    page,
    page_size: pageSize,
    num_pages: numPages,
    next: buildPageUrl(page + 1),
    previous: buildPageUrl(page - 1),
  };

  return successEnvelope(rows, {
    pagination: pagination as unknown as Record<string, unknown>,
  });
}
