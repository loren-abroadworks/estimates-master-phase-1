import { describe, it, expect } from 'vitest';
import { createInvoiceFromEstimate } from './invoiceService';
import { DEFAULT_SETTINGS } from '../constants';
import type { Estimate, Package } from '../types';

const fin = { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 };
const mkPkg = (over: Partial<Package>): Package => ({
  id: 'p', name: 'P', isRecommended: false, scopeId: 'scope-int', pricingMethod: 'hourly',
  estimateAreas: [], lineItems: {}, formLayout: [], paintColors: [], sundries: [],
  financials: { ...fin }, customerNotes: '', description: '', finalize: { deposit: '', terms: '' }, ...over,
});
const est: Estimate = {
  id: 'e1', projectName: 'P', status: 'Approved',
  customer: { id: 'c', firstName: 'A', lastName: 'B', email: '', phone: '', billingAddress: '', city: '', state: '', zip: '' },
  jobAddress: { address: '', city: '', state: '', zip: '', accessCode: '' },
  projectInfo: { name: 'P', number: 'EST-1', date: '', validUntil: '' },
  salesman: null, internalNotes: '',
  packages: [
    mkPkg({ id: 'standard', financials: { ...fin, baseGrandTotal: 100, baseSubtotal: 100 } }),
    mkPkg({ id: 'premium', financials: { ...fin, baseGrandTotal: 900, baseSubtotal: 900 } }),
  ],
  activePackageId: 'standard', selectedPackageId: 'premium',
  packagesEnabled: true,
};

describe('createInvoiceFromEstimate with packages', () => {
  it('uses the selected package totals, not the active one', () => {
    const invoice = createInvoiceFromEstimate(est, DEFAULT_SETTINGS, [], []);
    expect(invoice.subtotal).toBe(900);
  });
});
