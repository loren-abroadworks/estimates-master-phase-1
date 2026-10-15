import { Language } from '../types';

// Seeded EN↔ES phrase pairs for demo/presentation purposes only (no real API).
// Phase 2 expands this with the actual mock-data content phrases.
const PAIRS: Array<[string, string]> = [
  ['Interior Repaint', 'Repintado Interior'],
  ['Exterior Repaint', 'Repintado Exterior'],
  ['Cabinet Refinishing', 'Renovación de Gabinetes'],
];

const enToEs = new Map(PAIRS);
const esToEn = new Map(PAIRS.map(([e, s]) => [s, e]));

/**
 * Fake "auto-translation" of contractor-typed content for client documents.
 * Looks the text up in a seeded dictionary; returns it unchanged on a miss
 * so the demo never shows broken output. Pure and synchronous.
 */
export function mockTranslate(text: string, targetLang: Language): string {
  if (!text) return text;
  const map = targetLang === 'es' ? enToEs : esToEn;
  return map.get(text.trim()) ?? text;
}
