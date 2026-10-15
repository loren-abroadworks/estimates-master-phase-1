import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictStrip } from './ConflictStrip';

describe('ConflictStrip', () => {
  it('shows a green all-clear when there are no issues', () => {
    render(<ConflictStrip issueCount={0} lockedCount={0} canAutoFix={false} onAutoFix={() => {}} />);
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
  });

  it('shows the conflict count and an Auto-Fix button when fixable', () => {
    const onAutoFix = vi.fn();
    render(<ConflictStrip issueCount={2} lockedCount={0} canAutoFix onAutoFix={onAutoFix} />);
    expect(screen.getByText('2 conflicts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /auto-fix/i }));
    expect(onAutoFix).toHaveBeenCalled();
  });

  it('singularizes one conflict and hides Auto-Fix when not fixable', () => {
    render(<ConflictStrip issueCount={1} lockedCount={0} canAutoFix={false} onAutoFix={() => {}} />);
    expect(screen.getByText('1 conflict')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auto-fix/i })).not.toBeInTheDocument();
  });
});
