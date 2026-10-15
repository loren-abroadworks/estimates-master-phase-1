import { describe, it, expect } from 'vitest';
import type { Estimate, Package, EstimateFinancials } from '../types';

// Compile-time shape check: building a valid Package + Estimate must type-check.
const fin: EstimateFinancials = {
  selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0',
  baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0,
};

const pkg: Package = {
  id: 'pkg-1', name: 'Standard', isRecommended: false, scopeId: 'scope-int',
  pricingMethod: 'hourly', estimateAreas: [], lineItems: {}, formLayout: [],
  paintColors: [], sundries: [], financials: fin, customerNotes: '', description: '',
  finalize: { deposit: '', terms: '' },
};

describe('package types', () => {
  it('an Estimate carries packages, activePackageId, selectedPackageId, internalNotes', () => {
    const est = {
      id: 'e1', projectName: 'P', status: 'Draft',
      customer: {} as any, jobAddress: {} as any, projectInfo: {} as any, salesman: null,
      internalNotes: '', packages: [pkg], activePackageId: 'pkg-1', selectedPackageId: null,
      packagesEnabled: false,
    } as Estimate;
    expect(est.packages).toHaveLength(1);
    expect(est.activePackageId).toBe('pkg-1');
    expect(est.selectedPackageId).toBeNull();
  });
});

import { getActivePackage, getSelectedPackage, getPackageById } from './packages';

const mkPkg = (over: Partial<Package> = {}): Package => ({
  id: 'pkg-1', name: 'Standard', isRecommended: false, scopeId: 'scope-int',
  pricingMethod: 'hourly', estimateAreas: [], lineItems: {}, formLayout: [],
  paintColors: [], sundries: [], financials: { ...fin }, customerNotes: '', description: '',
  finalize: { deposit: '', terms: '' }, ...over,
});

const mkEst = (over: Partial<Estimate> = {}): Estimate => ({
  id: 'e1', projectName: 'P', status: 'Draft',
  customer: {} as any, jobAddress: {} as any, projectInfo: {} as any, salesman: null,
  internalNotes: '', packages: [mkPkg()], activePackageId: 'pkg-1', selectedPackageId: null,
  packagesEnabled: false,
  ...over,
});

describe('package accessors', () => {
  it('getActivePackage returns the active package, else first', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a' }), mkPkg({ id: 'b' })], activePackageId: 'b' });
    expect(getActivePackage(est).id).toBe('b');
    expect(getActivePackage({ ...est, activePackageId: 'missing' }).id).toBe('a');
  });

  it('getSelectedPackage returns selected, else active, else first', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a' }), mkPkg({ id: 'b' })], activePackageId: 'b', selectedPackageId: 'a' });
    expect(getSelectedPackage(est).id).toBe('a');
    expect(getSelectedPackage({ ...est, selectedPackageId: null }).id).toBe('b');
  });

  it('getPackageById finds or returns undefined', () => {
    const est = mkEst();
    expect(getPackageById(est, 'pkg-1')?.id).toBe('pkg-1');
    expect(getPackageById(est, 'nope')).toBeUndefined();
  });
});

import { addPackage, duplicatePackage, deletePackage, setRecommended, migrateEstimate } from './packages';

describe('package mutations', () => {
  it('addPackage appends a blank package and makes it active', () => {
    const est = mkEst();
    const next = addPackage(est, 'Premium');
    expect(next.packages).toHaveLength(2);
    const added = next.packages[1];
    expect(added.name).toBe('Premium');
    expect(added.estimateAreas).toEqual([]);
    expect(next.activePackageId).toBe(added.id);
    expect(est.packages).toHaveLength(1); // immutable: original untouched
  });

  it('duplicatePackage deep-copies with fresh ids and no shared references', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a', estimateAreas: [{ id: 'area-1' } as any] })], activePackageId: 'a' });
    const next = duplicatePackage(est, 'a');
    const copy = next.packages[1];
    expect(copy.id).not.toBe('a');
    expect(copy.estimateAreas[0].id).not.toBe('area-1');
    expect(copy.estimateAreas).not.toBe(est.packages[0].estimateAreas); // new array
  });

  it('duplicatePackage rewrites formLayout to the cloned area/line-item ids', () => {
    const est = mkEst({
      packages: [mkPkg({
        id: 'a',
        estimateAreas: [{ id: 'area-1' } as any],
        lineItems: { 'li-1': { id: 'li-1' } as any },
        formLayout: ['area-1', 'li-1'],
      })],
      activePackageId: 'a',
    });
    const copy = duplicatePackage(est, 'a').packages[1];
    const newAreaId = copy.estimateAreas[0].id;
    const newLineItemId = Object.keys(copy.lineItems)[0];
    // formLayout must point at the cloned ids so the scope-of-work list still resolves.
    expect(copy.formLayout).toEqual([newAreaId, newLineItemId]);
    // every layout entry resolves to a real area or line item
    copy.formLayout.forEach((id) => {
      const resolves = copy.estimateAreas.some((ar) => ar.id === id) || !!copy.lineItems[id];
      expect(resolves).toBe(true);
    });
  });

  it('deletePackage is blocked when only one remains', () => {
    const est = mkEst();
    expect(deletePackage(est, 'pkg-1').packages).toHaveLength(1);
  });

  it('deletePackage reassigns active when the active is deleted', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a' }), mkPkg({ id: 'b' })], activePackageId: 'b' });
    const next = deletePackage(est, 'b');
    expect(next.packages.map((p) => p.id)).toEqual(['a']);
    expect(next.activePackageId).toBe('a');
  });

  it('setRecommended sets one and clears the others', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a', isRecommended: true }), mkPkg({ id: 'b' })] });
    const next = setRecommended(est, 'b');
    expect(next.packages.find((p) => p.id === 'a')!.isRecommended).toBe(false);
    expect(next.packages.find((p) => p.id === 'b')!.isRecommended).toBe(true);
  });
});

describe('migrateEstimate', () => {
  it('wraps a legacy estimate (no packages) into packages[0]', () => {
    const legacy: any = {
      id: 'old', projectName: 'Old', status: 'Draft',
      customer: {}, jobAddress: {}, projectInfo: {}, salesman: null,
      scopeId: 'scope-int', pricingMethod: 'labor',
      estimateAreas: [{ id: 'area-1' }], lineItems: { x: { id: 'x' } }, formLayout: ['a'],
      paintColors: [{ id: 'c' }], sundries: [],
      financials: { ...fin, baseGrandTotal: 500 },
      notes: { customer: 'hi client', internal: 'note to self' },
      finalize: { deposit: '25%', terms: 'T' },
    };
    const est = migrateEstimate(legacy);
    expect(est.packages).toHaveLength(1);
    expect(est.packages[0].estimateAreas).toEqual([{ id: 'area-1' }]);
    expect(est.packages[0].financials.baseGrandTotal).toBe(500);
    expect(est.packages[0].customerNotes).toBe('hi client');
    expect(est.internalNotes).toBe('note to self');
    expect(est.activePackageId).toBe(est.packages[0].id);
    expect(est.selectedPackageId).toBeNull();
    expect((est as any).estimateAreas).toBeUndefined();
  });

  it('is idempotent for already-migrated estimates', () => {
    const est = mkEst();
    expect(migrateEstimate(est)).toEqual(est);
  });
});

describe('package descriptions', () => {
  it('addPackage creates a blank package with an empty description', () => {
    const next = addPackage(mkEst(), 'Better');
    const created = next.packages[next.packages.length - 1];
    expect(created.description).toBe('');
  });

  it('addPackage accepts an explicit description', () => {
    const next = addPackage(mkEst(), 'Better', undefined, 'Premium repaint');
    const created = next.packages[next.packages.length - 1];
    expect(created.description).toBe('Premium repaint');
  });

  it('addPackage from a source carries the source description forward', () => {
    const est = mkEst({ packages: [mkPkg({ id: 'a', description: 'Carried over' })], activePackageId: 'a' });
    const next = addPackage(est, 'Copy', 'a');
    const created = next.packages[next.packages.length - 1];
    expect(created.description).toBe('Carried over');
  });

  it('migrateEstimate backfills description on legacy estimates', () => {
    const legacy: any = { id: 'e2', projectName: 'Legacy', status: 'Draft', estimateAreas: [], lineItems: {} };
    const migrated = migrateEstimate(legacy);
    expect(migrated.packages[0].description).toBe('');
  });

  it('migrateEstimate backfills description on already-migrated packages', () => {
    const already = { ...mkEst(), packages: [mkPkg({ description: undefined as any })] };
    const migrated = migrateEstimate(already as any);
    expect(migrated.packages[0].description).toBe('');
  });
});
