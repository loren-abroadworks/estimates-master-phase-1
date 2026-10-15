import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientEstimatePreview } from './ClientEstimatePreview';

const baseSettings = {
  financialModel: {}, estimateDefaults: {}, projectDiscounts: [], taxRegions: [], taxRates: [],
  heightTiers: [], accessTiers: [], extraColumns: [],
};

const mkData = (areaName: string, total: number) => ({
  customer: { firstName: 'Sarah', lastName: 'J' }, jobAddress: {}, projectInfo: { name: 'P', number: 'E1' },
  salesman: null, layout: ['a1'], areas: [{ id: 'a1', name: areaName, length: 0, width: 0, height: 0, rows: [], visibility: {} }],
  lineItems: {}, notes: { customer: '' }, finalize: { deposit: '', terms: '' },
  financials: { baseGrandTotal: total, baseSubtotal: total }, paintColors: [], materials: [], sundries: [],
  settings: baseSettings, rates: [], tierSelections: {}, pricingMethod: 'hourly',
});

const previewPackages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 697, data: mkData('Living Room', 697) },
  { id: 'b', name: 'Premium', isRecommended: false, total: 881, data: mkData('Master Bath', 881) },
];

const baseProps = {
  data: previewPackages[0].data,
  onBack: vi.fn(), onUpdateVisibility: vi.fn(), onReorder: vi.fn(), onGlobalVisibility: vi.fn(),
};

describe('ClientEstimatePreview package switching', () => {
  it('renders the picker and switches the rendered scope + fires onSelectPackage', () => {
    const onSelectPackage = vi.fn();
    render(<ClientEstimatePreview {...baseProps} previewPackages={previewPackages} selectedPackageId="a" onSelectPackage={onSelectPackage} />);
    // default view = package a
    expect(screen.getByText('Living Room')).toBeInTheDocument();
    // switch to package b (the picker renders in both a desktop rail and a mobile bar;
    // jsdom applies no CSS so both are present — clicking either switches).
    fireEvent.click(screen.getAllByRole('button', { name: /Premium/ })[0]);
    expect(onSelectPackage).toHaveBeenCalledWith('b');
    expect(screen.getByText('Master Bath')).toBeInTheDocument();
  });

  it('does not render the picker for a single package', () => {
    render(<ClientEstimatePreview {...baseProps} previewPackages={[previewPackages[0]]} selectedPackageId="a" onSelectPackage={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Premium/ })).not.toBeInTheDocument();
  });

  it('renders the package description when present', () => {
    const data = { ...baseProps.data, packageDescription: 'Two coats, premium paint' };
    render(<ClientEstimatePreview {...baseProps} data={data} />);
    expect(screen.getByText('Two coats, premium paint')).toBeInTheDocument();
  });

  it('prompts package selection before anything else when accepting with multiple packages', () => {
    render(<ClientEstimatePreview {...baseProps} previewPackages={previewPackages} selectedPackageId="a" onSelectPackage={vi.fn()} />);
    // Click the accept action (sticky bar uses "Accept Estimate").
    fireEvent.click(screen.getAllByRole('button', { name: /accept estimate/i })[0]);
    // The package-selection modal appears, with its own Continue button.
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });
});
