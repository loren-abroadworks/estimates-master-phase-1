# Language Option — Phase 1 (Infrastructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dependency-free i18n infrastructure (types, catalog, translation hooks, mock content-translator, settings Language card) and translate one reference screen (sidebar nav) end-to-end as the pattern Phase 2 will copy.

**Architecture:** A lightweight custom i18n layer. A `Language` type and two fields (`appLanguage`, `clientLanguage`) on `GlobalSettings`. A pure `translate(lang, key, vars)` resolver backed by `en`/`es` catalog objects with English→raw-key fallback. React context (`LanguageProvider`) exposes the two languages; `useTranslation()` resolves against the app language, `useClientTranslation()` against the client language. A separate `mockTranslate(text, lang)` fakes content auto-translation via a seeded phrase dictionary (no API).

**Tech Stack:** React 19, TypeScript, Vite, Vitest + @testing-library/react. Path alias `@` → project root. Tests are colocated `*.test.ts(x)`.

**Spec:** `docs/superpowers/specs/2026-06-13-language-option-design.md`

**Key-naming convention (used by all tasks and Phase 2):** dotted, lowercase-area keys of the form `<area>.<component>.<descriptor>` — e.g. `nav.dashboard`, `settings.language.appLabel`, `common.english`.

---

### Task 1: Add `Language` type and settings fields

**Files:**
- Modify: `types.ts` (the `GlobalSettings` interface, ~line 174)
- Modify: `constants.ts` (`DEFAULT_SETTINGS`, ~line 154)
- Test: `i18n/settings.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `i18n/settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../constants';

describe('language settings defaults', () => {
  it('defaults appLanguage and clientLanguage to English', () => {
    expect(DEFAULT_SETTINGS.appLanguage).toBe('en');
    expect(DEFAULT_SETTINGS.clientLanguage).toBe('en');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n/settings.test.ts`
Expected: FAIL — `appLanguage`/`clientLanguage` are `undefined`.

- [ ] **Step 3: Add the `Language` type and the two fields**

In `types.ts`, add the type alias near the top of the file (after the existing leading imports/aliases):

```ts
export type Language = 'en' | 'es';
```

In the `GlobalSettings` interface, add (just after the `userProfile` line):

```ts
  appLanguage: Language;     // language the contractor sees in the app UI
  clientLanguage: Language;  // language client-facing documents render in
```

In `constants.ts`, inside the `DEFAULT_SETTINGS` object literal, add these two fields right after the `userProfile: { ... }` block:

```ts
  appLanguage: 'en',
  clientLanguage: 'en',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- i18n/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the type-check passes**

Run: `npm run lint`
Expected: no errors (the new required fields are satisfied by `DEFAULT_SETTINGS`, which is the only `GlobalSettings` literal in the app).

- [ ] **Step 6: Commit**

```bash
git add types.ts constants.ts i18n/settings.test.ts
git commit -m "feat(i18n): add Language type and app/client language settings"
```

---

### Task 2: Translation catalog and pure resolver

**Files:**
- Create: `i18n/catalog.ts`
- Create: `i18n/translate.ts`
- Test: `i18n/translate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `i18n/translate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n/translate.test.ts`
Expected: FAIL — `Cannot find module './translate'`.

- [ ] **Step 3: Create the catalog**

Create `i18n/catalog.ts`:

```ts
import { Language } from '../types';

export type TranslationCatalog = Record<string, string>;

// Key-naming convention: <area>.<component>.<descriptor> (dotted, lowercase area).
// Keep `en` and `es` in sync — the catalog-integrity test enforces it.

export const en: TranslationCatalog = {
  // --- Reference screen: sidebar navigation ---
  'nav.dashboard': 'Dashboard',
  'nav.calendar': 'Sales Calendar',
  'nav.scheduling': 'Job Scheduling',
  'nav.leads': 'Lead Pipeline',
  'nav.contacts': 'Contacts',
  'nav.estimates': 'Estimates',
  'nav.presentationBuilder': 'Presentation Builder',
  'nav.jobs': 'Jobs',
  'nav.workOrders': 'Work Orders',
  'nav.invoices': 'Invoices',
  'nav.reports': 'Reports',

  // --- Settings: Language card ---
  'settings.language.title': 'Language',
  'settings.language.appLabel': 'App Language',
  'settings.language.appHelp': 'The language you see throughout the app.',
  'settings.language.clientLabel': 'Client Document Language',
  'settings.language.clientHelp': 'What your clients see on estimates you send.',

  // --- Common ---
  'common.english': 'English',
  'common.spanish': 'Spanish',

  // --- Test fixtures (used only by translate.test.ts) ---
  'test.greeting': 'Hello, {name}',
  'test.enOnly': 'English only', // intentionally NOT present in `es` (exercises English fallback)
};

export const es: TranslationCatalog = {
  // --- Reference screen: sidebar navigation ---
  'nav.dashboard': 'Panel',
  'nav.calendar': 'Calendario de Ventas',
  'nav.scheduling': 'Programación de Trabajos',
  'nav.leads': 'Embudo de Prospectos',
  'nav.contacts': 'Contactos',
  'nav.estimates': 'Presupuestos',
  'nav.presentationBuilder': 'Creador de Presentaciones',
  'nav.jobs': 'Trabajos',
  'nav.workOrders': 'Órdenes de Trabajo',
  'nav.invoices': 'Facturas',
  'nav.reports': 'Reportes',

  // --- Settings: Language card ---
  'settings.language.title': 'Idioma',
  'settings.language.appLabel': 'Idioma de la Aplicación',
  'settings.language.appHelp': 'El idioma que ves en toda la aplicación.',
  'settings.language.clientLabel': 'Idioma de Documentos del Cliente',
  'settings.language.clientHelp': 'Lo que tus clientes ven en los presupuestos que envías.',

  // --- Common ---
  'common.english': 'Inglés',
  'common.spanish': 'Español',

  // --- Test fixtures (used only by translate.test.ts) ---
  'test.greeting': 'Hola, {name}',
  // NOTE: no 'test.enOnly' here on purpose — it exercises the English fallback path.
};

export const catalogs: Record<Language, TranslationCatalog> = { en, es };
```

- [ ] **Step 4: Create the resolver**

Create `i18n/translate.ts`:

```ts
import { Language } from '../types';
import { catalogs, en } from './catalog';

/**
 * Resolve a translation key for a language.
 * Fallback order: target language → English → the raw key.
 * Supports simple {var} interpolation.
 */
export function translate(
  lang: Language,
  key: string,
  vars?: Record<string, string | number>
): string {
  const table = catalogs[lang] ?? en;
  let str = table[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.split(`{${name}}`).join(String(value));
    }
  }
  return str;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- i18n/translate.test.ts`
Expected: PASS (all 5 assertions).

- [ ] **Step 6: Commit**

```bash
git add i18n/catalog.ts i18n/translate.ts i18n/translate.test.ts
git commit -m "feat(i18n): add translation catalog and resolver with fallback"
```

---

### Task 3: Mock content translator

**Files:**
- Create: `i18n/mockTranslate.ts`
- Test: `i18n/mockTranslate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `i18n/mockTranslate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n/mockTranslate.test.ts`
Expected: FAIL — `Cannot find module './mockTranslate'`.

- [ ] **Step 3: Create the mock translator**

Create `i18n/mockTranslate.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- i18n/mockTranslate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add i18n/mockTranslate.ts i18n/mockTranslate.test.ts
git commit -m "feat(i18n): add seeded mock content translator"
```

---

### Task 4: Language context and hooks

**Files:**
- Create: `i18n/LanguageContext.tsx`
- Test: `i18n/LanguageContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `i18n/LanguageContext.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider, useTranslation, useClientTranslation } from './LanguageContext';

const Probe = () => {
  const { t } = useTranslation();
  const { tc } = useClientTranslation();
  return (
    <div>
      <span data-testid="app">{t('nav.dashboard')}</span>
      <span data-testid="client">{tc('nav.dashboard')}</span>
    </div>
  );
};

describe('LanguageProvider + hooks', () => {
  it('resolves app strings via appLanguage and client strings via clientLanguage independently', () => {
    render(
      <LanguageProvider appLanguage="es" clientLanguage="en">
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId('app')).toHaveTextContent('Panel');     // Spanish app UI
    expect(screen.getByTestId('client')).toHaveTextContent('Dashboard'); // English client docs
  });

  it('defaults to English when no provider is present', () => {
    render(<Probe />);
    expect(screen.getByTestId('app')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('client')).toHaveTextContent('Dashboard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n/LanguageContext.test.tsx`
Expected: FAIL — `Cannot find module './LanguageContext'`.

- [ ] **Step 3: Create the context and hooks**

Create `i18n/LanguageContext.tsx`:

```tsx
import React, { createContext, useContext } from 'react';
import { Language } from '../types';
import { translate } from './translate';

interface LanguageContextValue {
  appLanguage: Language;
  clientLanguage: Language;
}

const LanguageContext = createContext<LanguageContextValue>({
  appLanguage: 'en',
  clientLanguage: 'en',
});

export const LanguageProvider: React.FC<{
  appLanguage: Language;
  clientLanguage: Language;
  children: React.ReactNode;
}> = ({ appLanguage, clientLanguage, children }) => (
  <LanguageContext.Provider value={{ appLanguage, clientLanguage }}>
    {children}
  </LanguageContext.Provider>
);

type Vars = Record<string, string | number>;

/** Resolve UI strings against the contractor's app language. */
export function useTranslation() {
  const { appLanguage } = useContext(LanguageContext);
  const t = (key: string, vars?: Vars) => translate(appLanguage, key, vars);
  return { t, language: appLanguage };
}

/** Resolve labels against the client-document language (for client-facing output). */
export function useClientTranslation() {
  const { clientLanguage } = useContext(LanguageContext);
  const tc = (key: string, vars?: Vars) => translate(clientLanguage, key, vars);
  return { tc, clientLanguage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- i18n/LanguageContext.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add i18n/LanguageContext.tsx i18n/LanguageContext.test.tsx
git commit -m "feat(i18n): add LanguageProvider and translation hooks"
```

---

### Task 5: Wire `LanguageProvider` into the app

**Files:**
- Modify: `App.tsx` (import near other component imports; wrap the authenticated return at ~line 220)

- [ ] **Step 1: Add the import**

In `App.tsx`, add with the other local imports (e.g. just after the `// UI` import block around line 56):

```ts
import { LanguageProvider } from './i18n/LanguageContext';
```

- [ ] **Step 2: Wrap the authenticated render tree**

The authenticated branch currently returns (line ~220):

```tsx
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-sans overflow-hidden">
```

Wrap that root `<div>` with `LanguageProvider`, reading the two languages from `settings`. The closing `</div>` of that root gains a matching `</LanguageProvider>`:

```tsx
  return (
    <LanguageProvider appLanguage={settings.appLanguage} clientLanguage={settings.clientLanguage}>
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-sans overflow-hidden">
      {/* ...existing children unchanged... */}
    </div>
    </LanguageProvider>
  );
```

(Find the matching closing `</div>` for the root flex container — it is the last `</div>` before the `);` that ends this `return` — and add `</LanguageProvider>` immediately after it.)

- [ ] **Step 3: Verify the type-check passes**

Run: `npm run lint`
Expected: no errors. (`settings.appLanguage`/`clientLanguage` are typed `Language`, matching the provider props.)

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: all tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat(i18n): wrap app in LanguageProvider"
```

---

### Task 6: Settings Language card (translated, wired)

**Files:**
- Modify: `components/settings/ProfileSettingsView.tsx`
- Test: `components/settings/ProfileSettingsView.test.tsx` (Create)

- [ ] **Step 1: Write the failing test**

Create `components/settings/ProfileSettingsView.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSettingsView } from './ProfileSettingsView';
import { LanguageProvider } from '../../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../../constants';

const renderCard = (appLanguage: 'en' | 'es', setSettings = vi.fn()) => {
  const settings = { ...DEFAULT_SETTINGS, appLanguage, clientLanguage: 'en' as const };
  render(
    <LanguageProvider appLanguage={appLanguage} clientLanguage="en">
      <ProfileSettingsView settings={settings} setSettings={setSettings} />
    </LanguageProvider>
  );
  return { settings, setSettings };
};

describe('ProfileSettingsView language card', () => {
  it('renders the language card title in Spanish when appLanguage is es', () => {
    renderCard('es');
    expect(screen.getByText('Idioma')).toBeInTheDocument();
  });

  it('updates appLanguage when the App Language select changes', () => {
    const { settings, setSettings } = renderCard('en');
    fireEvent.change(screen.getByLabelText('App Language'), { target: { value: 'es' } });
    expect(setSettings).toHaveBeenCalledWith({ ...settings, appLanguage: 'es' });
  });

  it('updates clientLanguage when the Client Document Language select changes', () => {
    const { settings, setSettings } = renderCard('en');
    fireEvent.change(screen.getByLabelText('Client Document Language'), { target: { value: 'es' } });
    expect(setSettings).toHaveBeenCalledWith({ ...settings, clientLanguage: 'es' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/settings/ProfileSettingsView.test.tsx`
Expected: FAIL — no "Idioma" text and no "App Language" labelled control yet.

- [ ] **Step 3: Add the imports**

In `components/settings/ProfileSettingsView.tsx`, update the imports:

```ts
import { User, Mail, Phone, Camera, Lock, Save, Moon, Sun, Languages } from 'lucide-react';
import { Card, TextInput, Button, InputGroup, Toggle, PhoneInput, Select } from '../UI';
import { GlobalSettings, Language } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
```

- [ ] **Step 4: Add the language card**

Inside the component body, add at the top (after `const profile = settings.userProfile;`):

```tsx
  const { t } = useTranslation();
  const langOptions = [
    { label: t('common.english'), value: 'en' },
    { label: t('common.spanish'), value: 'es' },
  ];
```

Then add the card as the first child inside `<div className="space-y-8">` (immediately before the existing Appearance `Card`):

```tsx
        {/* Language Settings */}
        <Card className="p-8 border-0 shadow-lg bg-white dark:bg-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-6 flex items-center gap-2">
                <Languages className="w-5 h-5 text-primary-500" /> {t('settings.language.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label={t('settings.language.appLabel')}>
                    <Select
                        ariaLabel="App Language"
                        value={settings.appLanguage}
                        onChange={(v) => setSettings({ ...settings, appLanguage: v as Language })}
                        options={langOptions}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.language.appHelp')}</p>
                </InputGroup>
                <InputGroup label={t('settings.language.clientLabel')}>
                    <Select
                        ariaLabel="Client Document Language"
                        value={settings.clientLanguage}
                        onChange={(v) => setSettings({ ...settings, clientLanguage: v as Language })}
                        options={langOptions}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.language.clientHelp')}</p>
                </InputGroup>
            </div>
        </Card>
```

Note: the `ariaLabel` values are intentionally the English label text so the test can target the controls regardless of the active language; the visible `InputGroup` label is the translated `t(...)` string.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- components/settings/ProfileSettingsView.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Verify the type-check passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/settings/ProfileSettingsView.tsx components/settings/ProfileSettingsView.test.tsx
git commit -m "feat(settings): add translated Language card with app/client selectors"
```

---

### Task 7: Reference screen — translate the sidebar navigation

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Test: `components/layout/Sidebar.test.tsx` (Create)

- [ ] **Step 1: Write the failing test**

Create `components/layout/Sidebar.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { LanguageProvider } from '../../i18n/LanguageContext';

const renderSidebar = (appLanguage: 'en' | 'es') =>
  render(
    <LanguageProvider appLanguage={appLanguage} clientLanguage="en">
      <Sidebar currentScreen="dashboard" onNavigate={() => {}} onLogout={() => {}} onboardingProgress={100} />
    </LanguageProvider>
  );

describe('Sidebar navigation labels', () => {
  it('shows English labels by default', () => {
    renderSidebar('en');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Work Orders')).toBeInTheDocument();
  });

  it('shows Spanish labels when appLanguage is es', () => {
    renderSidebar('es');
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Órdenes de Trabajo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/layout/Sidebar.test.tsx`
Expected: FAIL — Spanish labels not found (labels are hardcoded English).

- [ ] **Step 3: Add the hook import and call**

In `components/layout/Sidebar.tsx`, add the import near the top:

```ts
import { useTranslation } from '../../i18n/LanguageContext';
```

Inside the `Sidebar` component body (near the top, before the returned JSX), add:

```ts
  const { t } = useTranslation();
```

- [ ] **Step 4: Replace the hardcoded nav labels**

Replace each `label="..."` on the nav `SidebarItem`s with the matching `t(...)` call:

| Current `label` | Replace with |
|---|---|
| `label="Dashboard"` | `label={t('nav.dashboard')}` |
| `label="Sales Calendar"` | `label={t('nav.calendar')}` |
| `label="Job Scheduling"` | `label={t('nav.scheduling')}` |
| `label="Lead Pipeline"` | `label={t('nav.leads')}` |
| `label="Contacts"` | `label={t('nav.contacts')}` |
| `label="Estimates"` | `label={t('nav.estimates')}` |
| `label="Presentation Builder"` | `label={t('nav.presentationBuilder')}` |
| `label="Jobs"` | `label={t('nav.jobs')}` |
| `label="Work Orders"` | `label={t('nav.workOrders')}` |
| `label="Invoices"` | `label={t('nav.invoices')}` |
| `label="Reports"` | `label={t('nav.reports')}` |

(Leave any non-nav labels, the "Estimate Master" brand, and the onboarding widget text unchanged — those belong to Phase 2.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- components/layout/Sidebar.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 6: Verify the type-check passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/layout/Sidebar.tsx components/layout/Sidebar.test.tsx
git commit -m "feat(i18n): translate sidebar navigation as Phase 2 reference pattern"
```

---

### Task 8: Full-suite verification

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests pass, including the new `i18n/*` and component tests.

- [ ] **Step 2: Run the type-check**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Confirm Phase 1 is complete**

Verify the following exist and pass:
- `i18n/catalog.ts`, `i18n/translate.ts`, `i18n/mockTranslate.ts`, `i18n/LanguageContext.tsx`
- `Language` type + `appLanguage`/`clientLanguage` on `GlobalSettings`, defaulted in `DEFAULT_SETTINGS`
- `LanguageProvider` wrapping the app
- Translated Language card in `ProfileSettingsView`
- Translated sidebar nav (reference pattern)

No commit needed (verification only).

---

## Phase 2 handoff (not part of this plan)

Phase 2 is the high-volume grind, orchestrated from the capable model and dispatched to cheaper-model subagents:
- **Sonnet 4.6 subagents** — go file-by-file across remaining components, replace hardcoded strings with `t()` calls following the Task 6/7 pattern, and append `en` catalog entries.
- **Haiku 4.5 subagents** — fill the matching `es` catalog entries.
- Expand the `mockTranslate` `PAIRS` dictionary with the mock-data content phrases.
The catalog-integrity test (Task 2) keeps `en`/`es` in sync as keys are added.

## Self-Review

- **Spec coverage:** data model (Task 1) ✓; `i18n/` module — catalog + convention (Task 2), `mockTranslate` (Task 3), context + `useTranslation`/`useClientTranslation` + English fallback (Tasks 2 & 4) ✓; provider wired into `App.tsx` (Task 5) ✓; Settings Language card in `ProfileSettingsView` (Task 6) ✓; full test suite incl. catalog integrity, resolution/fallback, mockTranslate, independence, settings (Tasks 2,3,4,6) ✓; one reference screen end-to-end (Task 7) ✓. Phase 2 is explicitly out of scope and documented.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code.
- **Type consistency:** `Language`, `translate(lang,key,vars)`, `useTranslation().t`, `useClientTranslation().tc`, `LanguageProvider` props (`appLanguage`/`clientLanguage`), `mockTranslate(text,lang)`, and the catalog keys are used identically across all tasks.
