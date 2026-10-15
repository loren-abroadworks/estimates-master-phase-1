import { describe, it, expect } from 'vitest';
import { translate } from './translate';
import { en, es } from './catalog';

describe('translate', () => {
  it('resolves a key in the requested language', () => {
    expect(translate('es', 'nav.dashboard')).toBe('Panel');
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
  });

  it('falls back to English when the key is missing in the target language', () => {
    // 'test.enOnly' exists only in `en`; requesting it in 'es' must yield the English value.
    expect(translate('es', 'test.enOnly')).toBe('English only');
  });

  it('falls back to the raw key when the key is missing everywhere', () => {
    expect(translate('en', 'totally.unknown.key')).toBe('totally.unknown.key');
  });

  it('interpolates {var} placeholders', () => {
    // 'test.greeting' is a fixture key defined in the catalog for this test.
    expect(translate('en', 'test.greeting', { name: 'Sam' })).toBe('Hello, Sam');
    expect(translate('es', 'test.greeting', { name: 'Sam' })).toBe('Hola, Sam');
  });
});

describe('catalog integrity', () => {
  it('every real English key has a Spanish translation', () => {
    // `test.*` keys are fixtures (some intentionally en-only) and are excluded.
    const missing = Object.keys(en)
      .filter((k) => !k.startsWith('test.'))
      .filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });
});
