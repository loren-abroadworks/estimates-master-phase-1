import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobCard } from './JobCard';
import type { BoardCard } from '../../../services/productionBoard';

const card = (over: Partial<BoardCard> = {}): BoardCard => ({
  jobId: 'j', jobName: 'Repaint', jobNumber: 'J-1', color: '#123456',
  startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false,
  startTime: '08:00', endTime: '12:00', ...over,
});

describe('JobCard shift label', () => {
  it('shows the shift name when present', () => {
    render(<JobCard card={card({ shiftName: 'Prep' })} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.getByText(/Prep/)).toBeInTheDocument();
  });

  it('omits a shift prefix for a legacy card', () => {
    render(<JobCard card={card()} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});

describe('JobCard crew avatars', () => {
  const staff = [
    { id: 'm1', name: 'Mike Smith' },
    { id: 'm2', name: 'Sara Jones' },
    { id: 'm3', name: 'Ana Diaz' },
    { id: 'm4', name: 'Bo Lee' },
    { id: 'm5', name: 'Kim Wu' },
  ];

  it('renders an initials avatar per assigned member', () => {
    render(<JobCard card={card({ memberIds: ['m1', 'm2'] })} staff={staff} durationDays={2} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.getByTitle('Mike Smith')).toBeInTheDocument();
    expect(screen.getByText('MS')).toBeInTheDocument();
    expect(screen.getByText('SJ')).toBeInTheDocument();
  });

  it('caps a wide bar at three avatars and shows the rest as an overflow count', () => {
    render(<JobCard card={card({ memberIds: ['m1', 'm2', 'm3', 'm4', 'm5'] })} staff={staff} durationDays={3} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.getByText('MS')).toBeInTheDocument();
    expect(screen.getByText('AD')).toBeInTheDocument();
    expect(screen.queryByText('BL')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByTitle('Bo Lee, Kim Wu')).toBeInTheDocument();
  });

  it('shows a single avatar plus overflow on a one-day bar', () => {
    render(<JobCard card={card({ memberIds: ['m1', 'm2', 'm3'] })} staff={staff} durationDays={1} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(screen.getByText('MS')).toBeInTheDocument();
    expect(screen.queryByText('SJ')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('drops unknown member ids and hides the stack when none resolve', () => {
    const { container } = render(<JobCard card={card({ memberIds: ['ghost'] })} staff={staff} durationDays={2} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(0);
  });

  it('names the crew in the bar tooltip', () => {
    const { container } = render(<JobCard card={card({ memberIds: ['m1', 'm2'] })} staff={staff} durationDays={2} draggable={false} onPointerDownDrag={vi.fn()} />);
    expect((container.firstChild as HTMLElement).title).toContain('Mike Smith, Sara Jones');
  });
});
