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
