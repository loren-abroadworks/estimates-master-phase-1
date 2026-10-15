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
