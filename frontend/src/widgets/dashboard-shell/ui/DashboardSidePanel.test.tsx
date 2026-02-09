import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardSidePanel } from './DashboardSidePanel';

vi.mock('@/features/camera-register', () => ({
  CameraRegisterPanel: () => <div data-testid="camera-register-panel">CameraRegisterPanel</div>,
}));

vi.mock('@/features/upload-footage', () => ({
  UploadPanel: () => <div data-testid="upload-panel">UploadPanel</div>,
}));

vi.mock('@/widgets/alert-panel', () => ({
  AlertPanel: () => <div data-testid="alert-panel">AlertPanel</div>,
}));

const baseProps = {
  displayMode: 'national' as const,
  timeRange: '7d' as const,
  nearbyBounds: null,
  isCameraPlacementMode: false,
  selectedCameraLocation: null,
  onClose: vi.fn(),
  onUploadComplete: vi.fn(),
  onRegisterComplete: vi.fn(),
  onPlacementModeChange: vi.fn(),
  onClearSelectedLocation: vi.fn(),
  onAlertClick: vi.fn(),
};

describe('DashboardSidePanel', () => {
  it('activePanelがnullの場合は描画しない', () => {
    const { container } = render(<DashboardSidePanel {...baseProps} activePanel={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('activePanelに応じて正しいパネルを表示する', () => {
    const { rerender } = render(<DashboardSidePanel {...baseProps} activePanel="upload" />);
    expect(screen.getByTestId('upload-panel')).toBeInTheDocument();

    rerender(<DashboardSidePanel {...baseProps} activePanel="camera" />);
    expect(screen.getByTestId('camera-register-panel')).toBeInTheDocument();

    rerender(<DashboardSidePanel {...baseProps} activePanel="alerts" />);
    expect(screen.getByTestId('alert-panel')).toBeInTheDocument();
  });

  it('オーバーレイと閉じるボタンでonCloseが呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <DashboardSidePanel {...baseProps} activePanel="alerts" onClose={onClose} />
    );

    const overlay = container.querySelector('div[class*="bg-black/40"]');
    expect(overlay).not.toBeNull();
    if (!overlay) {
      throw new Error('overlay is not found');
    }
    await user.click(overlay);
    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
