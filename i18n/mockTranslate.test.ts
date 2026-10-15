import { describe, it, expect } from 'vitest';
import { mockTranslate } from './mockTranslate';

describe('mockTranslate', () => {
  it('translates a seeded phrase from English to Spanish', () => {
    expect(mockTranslate('Interior Repaint', 'es')).toBe('Repintado Interior');
  });

  it('translates a seeded phrase from Spanish back to English', () => {
    expect(mockTranslate('Repintado Interior', 'en')).toBe('Interior Repaint');
  });

  it('returns unknown text unchanged', () => {
    expect(mockTranslate('Some custom note the contractor typed', 'es'))
      .toBe('Some custom note the contractor typed');
  });

  it('returns empty/falsy input unchanged', () => {
    expect(mockTranslate('', 'es')).toBe('');
  });
});
