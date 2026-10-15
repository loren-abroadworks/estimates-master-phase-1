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
