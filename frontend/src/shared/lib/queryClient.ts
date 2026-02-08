import { QueryClient } from '@tanstack/react-query';

export const QUERY_DEFAULT_STALE_TIME_MS = 10_000;
export const QUERY_DEFAULT_GC_TIME_MS = 300_000;

export const createQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_DEFAULT_STALE_TIME_MS,
        gcTime: QUERY_DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
};
