/**
 * Central HTTP API Client for AgriSmart
 * Connects to the Spring Boot REST backend using native fetch.
 */

export interface ApiErrorPayload {
  timestamp?: string | undefined;
  status?: number | undefined;
  error?: string | undefined;
  errorCode?: string | undefined;
  message?: string | undefined;
  path?: string | undefined;
  details?: unknown | undefined;
  fieldErrors?: Record<string, string> | undefined;
  validationErrors?: Record<string, string> | undefined;
}

export type ApiErrorResponse = ApiErrorPayload;

/**
 * Standard typed API error representing backend errors and network failures.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly errorCode?: string | undefined;
  readonly path?: string | undefined;
  readonly timestamp?: string | undefined;
  readonly details?: unknown | undefined;
  readonly fieldErrors?: Record<string, string> | undefined;
  readonly validationErrors?: Record<string, string> | undefined;
  readonly isNetworkError: boolean;

  constructor(options: {
    message: string;
    status?: number | undefined;
    error?: string | undefined;
    errorCode?: string | undefined;
    path?: string | undefined;
    timestamp?: string | undefined;
    details?: unknown | undefined;
    fieldErrors?: Record<string, string> | undefined;
    validationErrors?: Record<string, string> | undefined;
    isNetworkError?: boolean | undefined;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "ApiError";
    this.status = options.status ?? (options.isNetworkError ? 0 : 500);
    this.error = options.error ?? (options.isNetworkError ? "NETWORK_ERROR" : "API_ERROR");
    this.errorCode = options.errorCode;
    this.path = options.path;
    this.timestamp = options.timestamp;
    this.details = options.details;
    this.fieldErrors = options.fieldErrors;
    this.validationErrors = options.validationErrors ?? options.fieldErrors;
    this.isNetworkError = Boolean(options.isNetworkError);

    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * True if the failure is an HTTP 400 validation error with field-level details.
   */
  get isValidationError(): boolean {
    return (
      this.status === 400 &&
      (this.error === "VALIDATION_ERROR" ||
        this.errorCode === "VALIDATION_ERROR" ||
        Boolean(this.fieldErrors && Object.keys(this.fieldErrors).length > 0) ||
        Boolean(this.validationErrors && Object.keys(this.validationErrors).length > 0))
    );
  }

  /**
   * True if the request was malformed (HTTP 400).
   */
  get isBadRequest(): boolean {
    return this.status === 400;
  }

  /**
   * True if unauthenticated (HTTP 401).
   */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * True if forbidden (HTTP 403).
   */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * True if resource conflicted / duplicate resource (HTTP 409).
   */
  get isConflict(): boolean {
    return this.status === 409 || this.error === "DUPLICATE_RESOURCE";
  }

  /**
   * True if the backend or an external prerequisite service is unavailable.
   */
  get isUnavailable(): boolean {
    return (
      this.isNetworkError ||
      this.status === 503 ||
      this.status === 502 ||
      this.status === 504 ||
      this.error === "WEATHER_DATA_UNAVAILABLE" ||
      this.error === "ML_SERVICE_UNAVAILABLE"
    );
  }

  /**
   * True if the requested entity was not found (HTTP 404).
   */
  get isNotFound(): boolean {
    return this.status === 404 || this.error === "RESOURCE_NOT_FOUND";
  }

  /**
   * True if business prerequisites are not satisfied (HTTP 422).
   */
  get isUnprocessable(): boolean {
    return (
      this.status === 422 ||
      this.error === "NO_VERIFIED_SOIL_REPORT" ||
      this.error === "WEATHER_LOCATION_UNRESOLVED"
    );
  }
}

/**
 * Resolves the configured base URL for the Spring Boot backend.
 * Falls back to http://localhost:8080 during local development.
 * Normalizes any trailing slashes.
 */
export function getApiBaseUrl(): string {
  const envUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_AGRISMART_API_URL"] as string | undefined)
      : undefined;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "http://localhost:8081";
}

export const API_BASE_URL = getApiBaseUrl();

export interface RequestOptions extends Omit<RequestInit, "body"> {
  baseUrl?: string | undefined;
  params?: Record<string, string | number | boolean | undefined | null> | undefined;
  body?: unknown;
}

/**
 * Core fetch wrapper executing requests against the AgriSmart backend.
 */
export async function apiFetch<T>(path: string, options?: RequestOptions): Promise<T> {
  const baseUrl = options?.baseUrl ? options.baseUrl.replace(/\/+$/, "") : API_BASE_URL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  let fullPath = normalizedPath;
  if (options?.params) {
    const queryParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null) {
        queryParams.append(key, String(val));
      }
    }
    const queryString = queryParams.toString();
    if (queryString) {
      fullPath += (fullPath.includes("?") ? "&" : "?") + queryString;
    }
  }

  const fullUrl = `${baseUrl}${fullPath}`;

  const headers = new Headers(options?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let requestBody: BodyInit | undefined;
  if (options?.body !== undefined) {
    if (
      typeof options.body === "string" ||
      options.body instanceof FormData ||
      options.body instanceof Blob ||
      options.body instanceof URLSearchParams
    ) {
      requestBody = options.body;
    } else {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      requestBody = JSON.stringify(options.body);
    }
  }

  const { baseUrl: _baseUrl, params: _params, body: _body, ...fetchInit } = options ?? {};
  const fetchOptions: RequestInit = {
    ...fetchInit,
    headers,
  };
  if (requestBody !== undefined) {
    fetchOptions.body = requestBody;
  }

  let res: Response;
  try {
    res = await fetch(fullUrl, fetchOptions);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to connect to backend API";
    throw new ApiError({
      message: `Network error: ${errorMsg}`,
      status: 0,
      error: "NETWORK_ERROR",
      path: normalizedPath,
      isNetworkError: true,
      cause: err,
    });
  }

  if (!res.ok) {
    let errorPayload: ApiErrorPayload | null = null;
    let rawText = "";

    try {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        errorPayload = (await res.json()) as ApiErrorPayload;
      } else {
        rawText = await res.text();
      }
    } catch {
      // Body may not be valid JSON or empty
    }

    const message =
      errorPayload?.message ||
      rawText.trim() ||
      `HTTP ${res.status}: ${res.statusText || "Request failed"}`;

    throw new ApiError({
      message,
      status: res.status,
      error: errorPayload?.error || `HTTP_${res.status}`,
      errorCode: errorPayload?.errorCode,
      path: errorPayload?.path || normalizedPath,
      timestamp: errorPayload?.timestamp,
      details: errorPayload?.details,
      fieldErrors: errorPayload?.fieldErrors,
      validationErrors: errorPayload?.validationErrors,
      isNetworkError: false,
    });
  }

  // Handle empty successful responses (e.g. 204 No Content)
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export function apiGet<T>(path: string, options?: Omit<RequestOptions, "body">): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "GET" });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "POST", body });
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "PUT", body });
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "PATCH", body });
}

export function apiDelete<T>(path: string, options?: Omit<RequestOptions, "body">): Promise<T> {
  return apiFetch<T>(path, { ...options, method: "DELETE" });
}

export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
  fetch: apiFetch,
  getBaseUrl: getApiBaseUrl,
};
