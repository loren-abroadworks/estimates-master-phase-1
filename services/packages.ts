import type { Estimate, Package } from '../types';

/** The package the estimator is currently editing. Falls back to the first package. */
export function getActivePackage(estimate: Estimate): Package {
  return getPackageById(estimate, estimate.activePackageId) ?? estimate.packages[0];
}

/** The client's chosen package. Falls back to active, then first. */
export function getSelectedPackage(estimate: Estimate): Package {
  return (
    (estimate.selectedPackageId ? getPackageById(estimate, estimate.selectedPackageId) : undefined) ??
    getActivePackage(estimate)
  );
}

export function getPackageById(estimate: Estimate, id: string): Package | undefined {
  return estimate.packages.find((p) => p.id === id);
}

let pkgCounter = 0;
function newId(prefix: string): string {
  pkgCounter += 1;
  return `${prefix}-${Date.now()}-${pkgCounter}`;
}

function blankFinancials(): import('../types').EstimateFinancials {
  return { selectedAccessTierId: '', selectedHeightTierId: '', taxId: '', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 };
}

function blankPackage(name: string): Package {
  return {
    id: newId('pkg'), name, isRecommended: false, scopeId: '', pricingMethod: 'hourly',
    estimateAreas: [], lineItems: {}, formLayout: [], paintColors: [], sundries: [],
    financials: blankFinancials(), customerNotes: '', description: '', finalize: { deposit: '', terms: '' },
  };
}

/** Deep clone with fresh ids on the package and every nested entity that has an id. */
function clonePackage(src: Package, name: string): Package {
  const clone: Package = JSON.parse(JSON.stringify(src));
  clone.id = newId('pkg');
  clone.name = name;
  clone.isRecommended = false;
  // Track old→new ids so formLayout (which orders areas/line items by id) can be relinked.
  const idMap = new Map<string, string>();
  clone.estimateAreas = clone.estimateAreas.map((area) => {
    const id = newId('area');
    idMap.set(area.id, id);
    return { ...area, id, rows: (area.rows || []).map((row) => ({ ...row, id: newId('row') })) };
  });
  const relinkedLineItems: Record<string, import('../types').MiscLineItem> = {};
  Object.values(clone.lineItems).forEach((item) => {
    const id = newId('li');
    idMap.set(item.id, id);
    relinkedLineItems[id] = { ...item, id };
  });
  clone.lineItems = relinkedLineItems;
  // Repoint the layout at the cloned ids; drop any entry that no longer resolves.
  clone.formLayout = (clone.formLayout || []).map((id) => idMap.get(id)).filter((id): id is string => !!id);
  clone.paintColors = clone.paintColors.map((c) => ({ ...c, id: newId('color') }));
  return clone;
}

export function addPackage(estimate: Estimate, name: string, fromPackageId?: string, description?: string): Estimate {
  const source = fromPackageId ? getPackageById(estimate, fromPackageId) : undefined;
  const pkg = source ? clonePackage(source, name) : blankPackage(name);
  if (description !== undefined) pkg.description = description;
  return { ...estimate, packages: [...estimate.packages, pkg], activePackageId: pkg.id };
}

export function duplicatePackage(estimate: Estimate, id: string): Estimate {
  const source = getPackageById(estimate, id);
  if (!source) return estimate;
  return addPackage(estimate, `${source.name} (Copy)`, id);
}

export function deletePackage(estimate: Estimate, id: string): Estimate {
  if (estimate.packages.length <= 1) return estimate;
  const packages = estimate.packages.filter((p) => p.id !== id);
  const activePackageId = estimate.activePackageId === id ? packages[0].id : estimate.activePackageId;
  const selectedPackageId = estimate.selectedPackageId === id ? null : estimate.selectedPackageId;
  return { ...estimate, packages, activePackageId, selectedPackageId };
}

export function setRecommended(estimate: Estimate, id: string): Estimate {
  return { ...estimate, packages: estimate.packages.map((p) => ({ ...p, isRecommended: p.id === id })) };
}

/** Wrap a legacy estimate (scope fields on the estimate) into a single package. Idempotent. */
export function migrateEstimate(raw: any): Estimate {
  if (raw && Array.isArray(raw.packages) && raw.activePackageId) {
    // Backfill packagesEnabled for already-migrated estimates: default on only if multiple packages exist.
    // Backfill description for packages saved before the field existed.
    return {
      ...raw,
      packages: raw.packages.map((p: any) => ({ ...p, description: p.description ?? '' })),
      packagesEnabled: raw.packagesEnabled ?? (raw.packages.length > 1),
    } as Estimate;
  }
  const pkg: Package = {
    id: newId('pkg'),
    name: 'Standard',
    isRecommended: false,
    scopeId: raw.scopeId ?? '',
    pricingMethod: raw.pricingMethod ?? 'hourly',
    estimateAreas: raw.estimateAreas ?? [],
    lineItems: raw.lineItems ?? {},
    formLayout: raw.formLayout ?? [],
    paintColors: raw.paintColors ?? [],
    sundries: raw.sundries ?? [],
    financials: raw.financials ?? blankFinancials(),
    customerNotes: raw.notes?.customer ?? '',
    description: raw.description ?? '',
    finalize: raw.finalize ?? { deposit: '', terms: '' },
  };
  return {
    id: raw.id, projectName: raw.projectName, status: raw.status,
    customer: raw.customer, jobAddress: raw.jobAddress, projectInfo: raw.projectInfo, salesman: raw.salesman,
    internalNotes: raw.notes?.internal ?? '',
    packages: [pkg], activePackageId: pkg.id, selectedPackageId: null,
    packagesEnabled: raw.packagesEnabled ?? false,
  };
}
