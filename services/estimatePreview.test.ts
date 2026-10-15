import { describe, it, expect } from 'vitest';
import { buildPackagePreviewData, PreviewContext } from './estimatePreview';
import type { Package } from '../types';

const pkg = {
  id: 'pkg-1', name: 'Standard', isRecommended: false, scopeId: 'scope-int',
  pricingMethod: 'hourly',
  estimateAreas: [{ id: 'area-1', name: 'Living Room' } as any],
  lineItems: { 'li-1': { id: 'li-1' } as any },
  formLayout: ['area-1', 'li-1'],
  paintColors: [{ id: 'c1', colorCode: '1' } as any],
  sundries: [{ id: 's1' } as any],
  financials: { selectedAccessTierId: 'acc', selectedHeightTierId: 'h', taxId: 't', baseGrandTotal: 500, baseTaxAmount: 0, baseDiscountAmount: 0 } as any,
  customerNotes: 'thanks',
  description: '',
  finalize: { deposit: '25%', terms: 'T' },
} as Package;

const ctx: PreviewContext = {
  id: 'est-1', projectName: 'P', estimateNumber: 'EST-1',
  dates: { estimateDate: '2026-01-01', validUntilDate: '2026-02-01' },
  status: 'Draft', description: 'desc',
  customer: { firstName: 'Sarah' } as any, jobAddress: { address: '123' } as any,
  salesman: null, templateScopeIds: ['scope-int'], internalNotes: 'internal',
  settings: {} as any, materials: [] as any, rates: [] as any,
};

describe('buildPackagePreviewData', () => {
  it('maps package scope + estimate constants into the preview shape', () => {
    const d = buildPackagePreviewData(pkg, ctx);
    expect(d.areas).toBe(pkg.estimateAreas);
    expect(d.estimateAreas).toBe(pkg.estimateAreas);
    expect(d.lineItems).toBe(pkg.lineItems);
    expect(d.layout).toBe(pkg.formLayout);
    expect(d.formLayout).toBe(pkg.formLayout);
    expect(d.paintColors).toBe(pkg.paintColors);
    expect(d.sundries).toBe(pkg.sundries);
    expect(d.financials).toBe(pkg.financials);
    expect(d.pricingMethod).toBe('hourly');
    expect(d.finalize).toBe(pkg.finalize);
    expect(d.notes).toEqual({ customer: 'thanks', internal: 'internal' });
    expect(d.tierSelections).toEqual({ heightId: 'h', accessId: 'acc' });
    expect(d.projectInfo).toEqual({ name: 'P', number: 'EST-1', date: '2026-01-01', validUntil: '2026-02-01' });
    expect(d.customer).toBe(ctx.customer);
    expect(d.settings).toBe(ctx.settings);
  });

  it('falls back to context scope ids when the package has no scopeId', () => {
    const d = buildPackagePreviewData({ ...pkg, scopeId: '' } as Package, ctx);
    expect(d.scopeIds).toEqual(['scope-int']);
  });

  it('includes the package description as packageDescription', () => {
    const withDesc = { ...pkg, description: 'Premium repaint' } as Package;
    const d = buildPackagePreviewData(withDesc, ctx);
    expect(d.packageDescription).toBe('Premium repaint');
  });

  it('defaults packageDescription to empty string when missing', () => {
    const d = buildPackagePreviewData(pkg, ctx);
    expect(d.packageDescription).toBe('');
  });
});
