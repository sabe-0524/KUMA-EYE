import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMapSightings } from './useMapSightings';

const getSightingsMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/api', () => ({
  getSightings: (...args: unknown[]) => getSightingsMock(...args),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
};

describe('useMapSightings', () => {
  beforeEach(() => {
    getSightingsMock.mockReset();
    getSightingsMock.mockResolvedValue({
      total: 0,
      sightings: [],
    });
  });

  it('初回取得で limit=200 と include_total=false を指定する', async () => {
    const { queryClient, Wrapper } = createWrapper();

    renderHook(
      () =>
        useMapSightings({
          refreshInterval: 30_000,
          refreshTrigger: 0,
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(getSightingsMock).toHaveBeenCalledWith({
        limit: 200,
        include_total: false,
      });
    });

    const cacheKey = queryKeys.sightings.list({
      bounds: null,
      limit: 200,
      includeTotal: false,
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(cacheKey)).toEqual([]);
    });
  });
});
