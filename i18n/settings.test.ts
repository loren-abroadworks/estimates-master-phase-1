import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants';

describe('language settings defaults', () => {
  it('defaults appLanguage and clientLanguage to English', () => {
    expect(DEFAULT_SETTINGS.appLanguage).toBe('en');
    expect(DEFAULT_SETTINGS.clientLanguage).toBe('en');
  });
});
