export const queryKeys = {
  sightings: {
    all: ['sightings'] as const,
    list: (params: { bounds: string | null; limit: number; includeTotal: boolean }) =>
      ['sightings', 'list', params] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    unacknowledged: (limit: number) => ['alerts', 'unacknowledged', limit] as const,
    count: ['alerts', 'count'] as const,
  },
  cameras: {
    all: ['cameras'] as const,
    list: (isActive?: boolean) => ['cameras', 'list', { isActive: isActive ?? null }] as const,
  },
  user: {
    all: ['user'] as const,
    profile: (uid: string) => ['user', 'profile', uid] as const,
  },
};
