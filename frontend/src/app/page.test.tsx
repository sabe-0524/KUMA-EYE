import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './page';

const pushMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockDynamicMap() {
      return <div data-testid="map-view">MapView</div>;
    };
  },
}));

vi.mock('@/shared/providers/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/widgets/dashboard-shell', () => ({
  DashboardHeader: () => <div data-testid="dashboard-header">DashboardHeader</div>,
  DashboardSidePanel: () => <div data-testid="dashboard-side-panel">DashboardSidePanel</div>,
  DashboardFooter: () => <div data-testid="dashboard-footer">DashboardFooter</div>,
}));

describe('HomePage auth guard', () => {
  beforeEach(() => {
    pushMock.mockReset();
    useAuthMock.mockReset();
  });

  it('loading=true の場合はローディング表示を出す', () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
      logout: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('loading=false かつ user=null の場合は /login へ遷移する', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
    });

    const { container } = render(<HomePage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('userありの場合は主要コンポーネントを描画する', () => {
    useAuthMock.mockReturnValue({
      user: {
        displayName: 'Test User',
        email: 'test@example.com',
      },
      loading: false,
      logout: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-side-panel')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-footer')).toBeInTheDocument();
  });
});
