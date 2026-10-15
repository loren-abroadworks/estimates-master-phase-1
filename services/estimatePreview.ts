import type { Package } from '../types';

export interface PreviewContext {
  id: string;
  projectName: string;
  estimateNumber: string;
  dates: { estimateDate: string; validUntilDate: string };
  status: string;
  description: string;
  customer: any;
  jobAddress: any;
  salesman: any;
  templateScopeIds: string[];
  internalNotes: string;
  settings: any;
  materials: any;
  rates: any;
}

/** Flatten a package's scope + estimate-level constants into the shape ClientEstimatePreview renders. */
export function buildPackagePreviewData(pkg: Package, ctx: PreviewContext) {
  return {
    id: ctx.id,
    projectName: ctx.projectName,
    projectInfo: { name: ctx.projectName, number: ctx.estimateNumber, date: ctx.dates.estimateDate, validUntil: ctx.dates.validUntilDate },
    status: ctx.status,
    scopeId: pkg.scopeId || ctx.templateScopeIds[0] || 'scope-int',
    scopeIds: pkg.scopeId ? [pkg.scopeId] : ctx.templateScopeIds,
    description: ctx.description,
    packageDescription: pkg.description || '',
    customer: ctx.customer,
    jobAddress: ctx.jobAddress,
    salesman: ctx.salesman,
    estimateAreas: pkg.estimateAreas,
    areas: pkg.estimateAreas,
    lineItems: pkg.lineItems,
    formLayout: pkg.formLayout,
    layout: pkg.formLayout,
    paintColors: pkg.paintColors,
    sundries: pkg.sundries,
    notes: { customer: pkg.customerNotes || '', internal: ctx.internalNotes || '' },
    financials: pkg.financials,
    pricingMethod: pkg.pricingMethod,
    finalize: pkg.finalize,
    settings: ctx.settings,
    materials: ctx.materials,
    rates: ctx.rates,
    tierSelections: { heightId: pkg.financials?.selectedHeightTierId, accessId: pkg.financials?.selectedAccessTierId },
  };
}
