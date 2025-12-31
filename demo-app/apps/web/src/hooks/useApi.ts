import { useState, useCallback, useRef, useEffect } from 'react';
import type { ApiError } from '../types/simulator';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
  execute: (url: string, options?: FetchOptions) => Promise<T | null>;
  reset: () => void;
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeout?: number;
}

export interface FetchResult<T> {
  data: T;
  ok: boolean;
  status: number;
}

async function fetchApi<T>(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult<T | null>> {
  const { method = 'GET', body, timeout = 30000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle empty responses (204 No Content, etc.)
    const contentLength = response.headers.get('content-length');
    const hasBody = contentLength !== '0' && response.status !== 204;

    let data: T | null = null;
    if (hasBody) {
      try {
        data = await response.json() as T;
      } catch {
        // Response body is not valid JSON - this is OK for some responses
        data = null;
      }
    }

    // Return both data and status info - let caller decide how to handle non-2xx
    return {
      data,
      ok: response.ok,
      status: response.status,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
    throw new Error('Unknown error occurred');
  }
}

export function useApi<T>(): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const mountedRef = useRef(true);

  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (
      url: string,
      options?: FetchOptions,
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);
      setStatus(null);

      try {
        const result = await fetchApi<T>(url, options);
        if (mountedRef.current) {
          // Always set data from response body, even for non-2xx responses
          // This allows displaying error response bodies (e.g., HTTP status simulator)
          // Note: For non-2xx responses, both data and error may be set.
          // data contains the response body, error contains a human-readable message.
          setData(result.data);
          setStatus(result.status);

          // Set error message for non-2xx responses (for components that need it)
          if (!result.ok) {
            const errorData = result.data as ApiError | null;
            setError(errorData?.message || errorData?.error || `HTTP ${result.status}`);
          }
        }
        return result.data;
      } catch (err) {
        // Network errors, timeouts, etc. (not HTTP status errors)
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (mountedRef.current) {
          setError(message);
          setData(null);
          setStatus(null);
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus(null);
    setLoading(false);
  }, []);

  return { data, loading, error, status, execute, reset };
}

// Convenience hooks for specific HTTP methods
export function useGet<T>() {
  const api = useApi<T>();

  const get = useCallback(
    (url: string, timeout?: number) =>
      api.execute(url, { method: 'GET', timeout }),
    [api],
  );

  return { ...api, get };
}

export function usePost<T>() {
  const api = useApi<T>();

  const post = useCallback(
    (url: string, body?: unknown, timeout?: number) =>
      api.execute(url, { method: 'POST', body, timeout }),
    [api],
  );

  return { ...api, post };
}

export function useDelete<T>() {
  const api = useApi<T>();

  const del = useCallback(
    (url: string) =>
      api.execute(url, { method: 'DELETE' }),
    [api],
  );

  return { ...api, del };
}
