import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardHeader } from './DashboardHeader';

describe('DashboardHeader', () => {
  it('主要アクションのクリックでコールバックが呼ばれる', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const onOpenSettings = vi.fn();
    const onTogglePanel = vi.fn();
    const onLogout = vi.fn();

    render(
      <DashboardHeader
        userLabel="tester"
        activePanel={null}
        onRefresh={onRefresh}
        onOpenSettings={onOpenSettings}
        onTogglePanel={onTogglePanel}
        onLogout={onLogout}
      />
    );

    await user.click(screen.getByRole('button', { name: '地図を更新' }));
    await user.click(screen.getByRole('button', { name: '設定' }));
    await user.click(screen.getByRole('button', { name: 'カメラ登録' }));
    await user.click(screen.getByRole('button', { name: 'ログアウト' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onTogglePanel).toHaveBeenCalledWith('camera');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('activePanelに応じてボタン状態クラスが切り替わる', () => {
    render(
      <DashboardHeader
        userLabel="tester"
        activePanel="upload"
        onRefresh={vi.fn()}
        onOpenSettings={vi.fn()}
        onTogglePanel={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const uploadButton = screen.getByRole('button', { name: '映像をアップロード' });
    const cameraButton = screen.getByRole('button', { name: 'カメラ登録' });

    expect(uploadButton.className).toContain('bg-white/15');
    expect(cameraButton.className).toContain('hover:bg-white/10');
  });
});
