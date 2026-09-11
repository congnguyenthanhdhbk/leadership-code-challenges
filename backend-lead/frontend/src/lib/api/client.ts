import type { ApiErrorBody, ApiErrorCode } from './types';

// Requests go to /api/* on this origin; next.config.ts rewrites them to the wallet API.
export const API_PREFIX = '/api';

export type HttpMethod = 'GET' | 'POST';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error;
    this.body = body;
  }
}

// One record per HTTP round trip. The activity store keeps these so the UI can show
// exactly what was sent and what came back, since the API has no read endpoints for
// deposits, wagers or the ledger.
export interface RequestRecord {
  method: HttpMethod;
  path: string;
  requestBody: unknown;
  status: number | null;
  ok: boolean;
  responseBody: unknown;
  durationMs: number;
  startedAt: string;
}

export type RequestObserver = (record: RequestRecord) => void;

const observers = new Set<RequestObserver>();

export function observeRequests(observer: RequestObserver): () => void {
  observers.add(observer);
  return () => observers.delete(observer);
}

function notify(record: RequestRecord) {
  for (const observer of observers) {
    try {
      observer(record);
    } catch {
      // An observer must never break the request pipeline.
    }
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<TResponse>(method: HttpMethod, path: string, body?: unknown): Promise<TResponse> {
  const startedAt = new Date();
  const started = performance.now();
  let response: Response;

  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'request failed';
    notify({
      method,
      path,
      requestBody: body ?? null,
      status: null,
      ok: false,
      responseBody: { error: 'network_error', message },
      durationMs: performance.now() - started,
      startedAt: startedAt.toISOString(),
    });
    throw new ApiError(0, { error: 'network_error', message });
  }

  const responseBody = await readBody(response);
  notify({
    method,
    path,
    requestBody: body ?? null,
    status: response.status,
    ok: response.ok,
    responseBody,
    durationMs: performance.now() - started,
    startedAt: startedAt.toISOString(),
  });

  if (!response.ok) {
    const errorBody: ApiErrorBody =
      responseBody && typeof responseBody === 'object' && 'error' in responseBody
        ? (responseBody as ApiErrorBody)
        : { error: 'unexpected_response', status: response.status, raw: responseBody };
    throw new ApiError(response.status, errorBody);
  }

  return responseBody as TResponse;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
