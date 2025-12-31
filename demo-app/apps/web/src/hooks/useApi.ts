import { useState, useCallback, useRef, useEffect } from 'react';
import type { ApiError } from '../types/simulator';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (url: string, options?: FetchOptions) => Promise<T | null>;
  reset: () => void;
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeout?: number;
}

async function fetchApi<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
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

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as ApiError;
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }

    return data as T;
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

      try {
        const result = await fetchApi<T>(url, options);
        if (mountedRef.current) {
          setData(result);
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (mountedRef.current) {
          setError(message);
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
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
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
