import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('k.missing', 'week'));
    expect(result.current[0]).toBe('week');
  });

  it('reads a previously stored value on mount', () => {
    localStorage.setItem('k.stored', JSON.stringify('month'));
    const { result } = renderHook(() => useLocalStorage('k.stored', 'week'));
    expect(result.current[0]).toBe('month');
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('k.write', false));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(JSON.parse(localStorage.getItem('k.write')!)).toBe(true);
  });

  it('falls back to the initial value when stored JSON is malformed', () => {
    localStorage.setItem('k.bad', '{not json');
    const { result } = renderHook(() => useLocalStorage('k.bad', 'week'));
    expect(result.current[0]).toBe('week');
  });
});
