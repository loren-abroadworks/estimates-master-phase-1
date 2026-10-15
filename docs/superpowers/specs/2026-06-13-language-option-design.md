# Language Option (English / Spanish) — Design

**Date:** 2026-06-13
**Status:** Approved design, ready for planning

## Summary

Add a language feature with two independent settings:

1. **App language** — the language the contractor sees throughout the app UI.
2. **Client document language** — the language used on documents sent to clients (estimates/proposals).

The two are independent. The driving scenario: a Spanish-speaking contractor runs the
app in Spanish (`appLanguage: 'es'`) while sending estimates to English-speaking clients
(`clientLanguage: 'en'`).

For now the only supported languages are **English (`en`)** and **Spanish (`es`)**.

The app currently has **no i18n infrastructure** — every string is hardcoded English
across ~80+ component files. This feature introduces a lightweight, dependency-free
translation layer and (over two implementation phases) translates the entire UI.

## Scope decisions (confirmed)

- **App UI coverage:** the **entire** app UI is translated to Spanish (not a subset).
- **Client document translation:**
  - App-generated **labels/headings** render in the client language via the catalog.
  - Contractor-**typed content** (line-item descriptions, scope notes, terms text, about
    blurb) is "auto-translated" into the client language — but **faked via a seeded
    dictionary for presentation/demo purposes only. No external translation API.**
- **Client language granularity:** a single **global default** (no per-estimate override
  in this iteration).
- **Persistence:** none beyond existing behavior. Settings live in the in-memory
  `GlobalSettings` React state (seeded from mock data, resets on reload), like every other
  setting in this demo app.

## Approach

**Approach A — Lightweight custom i18n (React Context + key dictionaries).** No new
dependencies; fits the plain-React style of the codebase; full control over the faked
client-content translation. (Rejected: a library like react-i18next — overkill for a
2-language demo; runtime DOM text translation — fragile, not a real path to full coverage.)

## Data model

Add to `GlobalSettings` (in `types.ts`):

```ts
type Language = 'en' | 'es';

interface GlobalSettings {
  // ...existing
  appLanguage: Language;     // what the contractor sees in the app UI; default 'en'
  clientLanguage: Language;  // what client-facing documents render in; default 'en'
}
```

Both default to `'en'`. Set via the existing `setSettings` flow. A `Language` type alias
lives in `types.ts`. The initial settings object in `App.tsx` is updated with the defaults.

## Translation layer (`i18n/` module)

Framework-free, dependency-free.

- **`i18n/catalog.ts`** — two nested dictionaries, `en` and `es`, keyed by dotted strings
  grouped by feature area (e.g. `settings.language.title`, `estimate.total`,
  `nav.dashboard`). Single source of truth for UI strings. A documented **key-naming
  convention** (`<area>.<component>.<descriptor>`) is established here so Phase 2 subagents
  follow one consistent pattern.
- **`i18n/LanguageContext.tsx`** — `LanguageProvider` wraps the app in `App.tsx`, reads
  `appLanguage`/`clientLanguage` off settings, and exposes them via context.
- **`useTranslation()`** — returns `t(key, vars?)`. Resolves against the **app** language,
  supports simple `{var}` interpolation, and **falls back to the English string, then to
  the raw key**, when a translation is missing. This fallback makes incremental rollout
  safe — untranslated strings show English rather than crashing.
- **`useClientTranslation()`** — returns `tc(key)` that resolves the same catalog against
  the **client** language. Used only inside client-facing document rendering.
- **`i18n/mockTranslate.ts`** — `mockTranslate(text, targetLang)`: the faked
  "auto-translate" for contractor-typed content. Backed by a seeded EN↔ES phrase dictionary
  covering the demo/mock-data content; on a miss it returns the original text unchanged so
  the demo never shows broken output. Pure and synchronous (no async/API failure modes).

**Rule of thumb:** static UI **labels** flow through the catalog (`t`/`tc`); dynamic
contractor-typed **content** flows through `mockTranslate`.

## UI surfaces & content flow

- **Settings — Language card.** Added to `ProfileSettingsView.tsx` (user-level
  preferences). Two controls built from existing `UI.tsx` primitives:
  - **App Language** — English / Español → writes `settings.appLanguage`.
  - **Client Document Language** — English / Español, with helper text ("What your clients
    see on estimates you send") → writes `settings.clientLanguage`.
- **App UI consumption.** Components use `const { t } = useTranslation()` and replace
  hardcoded strings with `t('key')`.
- **Client document rendering.** Wherever client-facing output is generated
  (PresentationBuilder sections, estimate documents, rendered message/terms templates):
  - Labels/headings → `tc('key')` (client language).
  - Contractor-typed content → `mockTranslate(content, clientLanguage)`.

This realizes "app in Spanish, client sees English": `t` follows `appLanguage`;
`tc`/`mockTranslate` follow `clientLanguage`.

## Testing

Colocated `*.test.ts(x)` files under `vitest` (`npm test`):

- **Catalog integrity** — every key present in `en` has a translation in `es` (guards
  full-coverage completeness).
- **`t`/`tc` resolution** — correct language per setting; interpolation works; missing key
  falls back to English, then to the raw key.
- **`mockTranslate`** — seeded phrases translate EN↔ES; unknown text returns unchanged;
  respects target language.
- **Independence** — `appLanguage: 'es'` + `clientLanguage: 'en'` yields Spanish app
  strings via `t` but English document labels via `tc`.
- **Settings** — the Language card updates `appLanguage`/`clientLanguage` via `setSettings`.

**Error handling:** no throws on missing keys/translations; always degrade to English or
the original text.

## Implementation phases

The work is split into two phases so the high-volume, mechanical grind can run on cheaper
models, orchestrated automatically (no manual model switching by the user).

### Phase 1 — Infrastructure (capable model)

Low-volume, design-sensitive, error-prone work:

- `Language` type + `appLanguage`/`clientLanguage` on `GlobalSettings`; defaults in
  `App.tsx` initial settings.
- The full `i18n/` module: `catalog.ts` scaffolding + documented key-naming convention,
  `LanguageContext.tsx` (`LanguageProvider`), `useTranslation`, `useClientTranslation`,
  English-fallback logic, and `mockTranslate.ts` (engine; dictionary seeded in Phase 2).
- `LanguageProvider` wired into `App.tsx`.
- The Settings **Language card** in `ProfileSettingsView.tsx`, fully wired and fully
  translated.
- Full test suite for the plumbing.
- **One reference screen translated end-to-end** (the Language card + navigation), which
  becomes the exact pattern every Phase 2 subagent copies.

### Phase 2 — Translation grind (orchestrated; mixed cheaper models)

High-volume, repetitive, pattern-following work. The capable model **orchestrates** (cheap
coordination) and dispatches work to subagents via the `Agent` tool's `model` override —
**no manual model switching required**:

- **Sonnet 4.6 subagents — code edits.** Go file-by-file across all ~80+ components:
  replace hardcoded strings with `t()` calls and append `en` catalog entries, following the
  Phase 1 reference pattern. (Code-touching/JSX-editing work goes to Sonnet for reliability.)
- **Haiku 4.5 subagents — translation text.** Fill the `es` catalog entries for every key
  (pure text, low risk).
- Seed the `mockTranslate` EN↔ES dictionary for the demo content.

The English-fallback means a missed string degrades to English rather than breaking, so
per-file delegation is low blast radius. Phase 2 can be executed incrementally; the app
keeps working throughout.

**Mechanics:** one design spec (this document). `writing-plans` produces the **Phase 1
plan** first; Phase 1 is implemented on the capable model. The **Phase 2 plan** is produced
afterward and executed via cheaper-model subagents orchestrated from the capable model.

## Out of scope (this iteration)

- Languages other than English and Spanish.
- Per-estimate client-language override.
- A real machine-translation API for contractor-typed content.
- Persisting language preferences beyond in-memory settings state.
