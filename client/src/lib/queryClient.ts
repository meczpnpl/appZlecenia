import { QueryClient, QueryFunction } from "@tanstack/react-query";
import camelcaseKeys from 'camelcase-keys';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Poprawiona funkcja apiRequest z parametrami w prawidłowej kolejności
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`ApiRequest: ${method} ${url}`, data);
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Rozszerzamy obiekt Response, by automatycznie konwertować dane
  // z snake_case do camelCase podczas wywołania json()
  const originalJson = res.json;
  res.json = async function() {
    const data = await originalJson.call(this);
    return camelcaseKeys(data, { deep: true });
  };
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  customUrl?: string;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, customUrl }) =>
  async ({ queryKey }) => {
    const url = customUrl || (queryKey[0] as string);
    console.log("Wykonuję zapytanie API do:", url);
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    // Konwertujemy dane z formatu snake_case na camelCase
    const data = await res.json();
    return camelcaseKeys(data, { deep: true });
  };

// Tworzenie QueryClient z prostszymi ustawieniami
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
