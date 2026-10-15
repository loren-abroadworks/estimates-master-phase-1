import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvailabilityBadge } from './AvailabilityBadge';

describe('AvailabilityBadge', () => {
  it('reads Off on a day the member is off', () => {
    render(<AvailabilityBadge avail={{ off: true, startTime: '08:00', endTime: '17:00' }} />);
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('shows the reason they gave instead of the bare word', () => {
    render(<AvailabilityBadge avail={{ off: true, reason: 'Vacation', startTime: '08:00', endTime: '17:00' }} />);
    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });

  it('shows the working window on a normal day', () => {
    render(<AvailabilityBadge avail={{ off: false, startTime: '08:00', endTime: '12:00' }} />);
    expect(screen.getByText('8am–12pm')).toBeInTheDocument();
  });

  it('carries the caller\'s positioning classes through', () => {
    render(<AvailabilityBadge avail={{ off: true, startTime: '08:00', endTime: '17:00' }} className="absolute top-1 right-1" />);
    expect(screen.getByText('Off').className).toContain('absolute top-1 right-1');
  });
});
