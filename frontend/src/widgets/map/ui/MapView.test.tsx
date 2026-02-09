import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapView } from './MapView';

const useMapSightingsMock = vi.hoisted(() => vi.fn());

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="map-container" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/widgets/map/model/useMapSightings', () => ({
  useMapSightings: (...args: unknown[]) => useMapSightingsMock(...args),
}));

vi.mock('@/widgets/map/ui/MapDisplayModeToggle', () => ({
  MapDisplayModeToggle: () => <div data-testid="map-display-mode-toggle" />,
}));

vi.mock('@/widgets/map/ui/MapInteractionController', () => ({
  MapInteractionController: () => <div data-testid="map-interaction-controller" />,
}));

vi.mock('@/widgets/map/ui/MapLegend', () => ({
  MapLegend: () => <div data-testid="map-legend" />,
}));

vi.mock('@/widgets/map/ui/MapLocationMarkers', () => ({
  MapLocationMarkers: () => <div data-testid="map-location-markers" />,
}));

vi.mock('@/widgets/map/ui/MapSightingsLayer', () => ({
  MapSightingsLayer: () => <div data-testid="map-sightings-layer" />,
}));

vi.mock('@/widgets/map/ui/MapStatusBanners', () => ({
  MapStatusBanners: () => <div data-testid="map-status-banners" />,
}));

vi.mock('@/shared/ui', () => ({
  ImageModal: () => <div data-testid="image-modal" />,
}));

const createUseMapSightingsResult = (overrides: Record<string, unknown> = {}) => ({
  sightings: [],
  loading: false,
  error: null,
  selectedImage: null,
  displayMode: 'national' as const,
  locationStatus: 'idle' as const,
  currentLocation: null,
  manualLocation: null,
  nearbyBounds: null,
  setDisplayMode: vi.fn(),
  setManualLocation: vi.fn(),
  openImage: vi.fn(),
  closeImage: vi.fn(),
  ...overrides,
});

describe('MapView', () => {
  beforeEach(() => {
    useMapSightingsMock.mockReset();
    useMapSightingsMock.mockReturnValue(createUseMapSightingsResult());
  });

  it('loading=true でも地図コンテナを描画し、ローディングオーバーレイを表示する', () => {
    useMapSightingsMock.mockReturnValue(createUseMapSightingsResult({ loading: true }));

    render(<MapView />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText('目撃情報を読み込み中...')).toBeInTheDocument();
  });

  it('loading=false ではローディングオーバーレイを表示しない', () => {
    useMapSightingsMock.mockReturnValue(createUseMapSightingsResult({ loading: false }));

    render(<MapView />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.queryByText('目撃情報を読み込み中...')).not.toBeInTheDocument();
  });
});
