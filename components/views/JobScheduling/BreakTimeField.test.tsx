import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreakTimeField } from './BreakTimeField';

const timeInput = (c: HTMLElement) => c.querySelector('input[type="time"]');

describe('BreakTimeField', () => {
  it('shows Anytime selected and hides the time picker when value is undefined', () => {
    const { container } = render(<BreakTimeField value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anytime' })).toBeInTheDocument();
    expect(timeInput(container)).toBeNull();
  });

  it('shows the time picker with the value when a time is set', () => {
    const { container } = render(<BreakTimeField value="12:30" onChange={vi.fn()} />);
    const input = timeInput(container) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('12:30');
  });

  it('emits 12:00 when switching from Anytime to a set time', () => {
    const onChange = vi.fn();
    render(<BreakTimeField value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'At a set time' }));
    expect(onChange).toHaveBeenCalledWith('12:00');
  });

  it('emits undefined when switching to Anytime', () => {
    const onChange = vi.fn();
    render(<BreakTimeField value="12:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anytime' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('normalizes a cleared time input to undefined', () => {
    const onChange = vi.fn();
    const { container } = render(<BreakTimeField value="12:30" onChange={onChange} />);
    fireEvent.change(timeInput(container) as HTMLInputElement, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
