
import { Invoice, GlobalSettings, WorkOrder, PaymentRecord, Material, ProductionRate, EstimateArea, InvoiceItem, PaintColorEntry } from '../types';
import { calculateMaterial } from './calcEngine';
import { getSelectedPackage } from './packages';

/**
 * Creates a new Invoice from an Estimate Data object (when accepted)
 */
export const createInvoiceFromEstimate = (
  estimate: any,
  settings: GlobalSettings,
  materials: Material[],
  rates: ProductionRate[],
  workOrderId?: string
): Invoice => {
  
  const pkg = getSelectedPackage(estimate);

  const safeBaseGrandTotal = pkg.financials?.baseGrandTotal || 0;

  // Calculate Deposit
  const depositPercent = settings.paymentSettings.defaultDepositPercentage || 25;
  const depositRequired = Math.round(safeBaseGrandTotal * (depositPercent / 100));

  // Generate Detailed Itemized List
  const items: InvoiceItem[] = [];

  const estimateAreas: EstimateArea[] = pkg.estimateAreas || [];
  const paintColors: PaintColorEntry[] = pkg.paintColors || [];

  // Tiers from settings - needed to recalculate row prices accurately
  const heightTier = settings.heightTiers.find(t => t.id === pkg.financials?.selectedHeightTierId);
  const accessTier = settings.accessTiers.find(t => t.id === pkg.financials?.selectedAccessTierId);
  const hMult = heightTier ? heightTier.multiplier : 1.0;
  const aMult = accessTier ? accessTier.multiplier : 1.0;

  estimateAreas.forEach(area => {
      if (area.isOptional) return;

      area.rows.forEach(row => {
          if (row.isOptional) return;

          const rate = rates.find(r => r.id === row.productionRateId);
          
          // --- Price Calculation ---
          let laborCost = 0;
          if (rate) {
             const useLaborMargin = pkg.pricingMethod === 'labor'; // Check estimate specific pricing method if available or assume standard
             const baseHourly = rate.laborRate > 0 ? rate.laborRate : settings.defaultLaborRate;
             const hourlyRate = useLaborMargin ? baseHourly * (1 + settings.laborMargin) : baseHourly;
             
             // Base row hours (including tier multipliers)
             let totalHours = (row.hours || 0) * hMult * aMult;
             
             // Add Extra hours (Prep etc) from columns
             const extraHours = settings.extraColumns
                .filter(c => c.type === 'hours')
                .reduce((sum, col) => sum + (Number(row.customValues[col.id]) || 0), 0);
             
             totalHours += extraHours;
             laborCost = totalHours * hourlyRate;
          }

          // Material Cost
          let material: Material | null = null;
          let productDetails = '';
          let productName = '';

          if (row.colorNum) {
             const paintEntry = paintColors.find(pc => pc.colorCode === row.colorNum);
             if (paintEntry?.productId) {
                 material = materials.find(m => m.id === paintEntry.productId) || null;
                 if (material) {
                     productName = material.name;
                     // Format: "Sheen • #ColorCode"
                     const sheen = material.sheen || paintEntry.finish || '';
                     productDetails = `${sheen ? sheen + ' • ' : ''}#${paintEntry.colorCode}`;
                 }
             }
          }
          
          const { materialCost } = calculateMaterial(row.amount, material, row.coats, settings.wasteEnabled ? settings.wastePercentage : 0);
          const totalRowCost = laborCost + materialCost;

          items.push({
              id: `inv-item-${row.id}`,
              areaName: area.name,
              description: row.item,
              quantity: row.amount,
              unit: row.unit,
              coats: row.coats,
              product: productName || '-',
              productDetails: productDetails,
              amount: totalRowCost
          });
      });
  });

  // Add Misc Items as separate rows
  Object.values(pkg.lineItems || {}).forEach((item: any) => {
      if (!item.isOptional) {
          items.push({
              id: `inv-item-${item.id}`,
              areaName: 'Additional Items',
              description: item.description,
              amount: item.total,
              quantity: item.quantity,
              unit: 'Ea'
          });
      }
  });

  // Handle Sundries
  const sundries: InvoiceItem[] = (pkg.sundries || []).map((s: any) => ({
      id: s.id,
      description: s.name,
      quantity: s.count,
      unitPrice: s.unitPrice,
      amount: s.total,
      unit: 'Ea'
  }));

  // Extract Scope of Work (Descriptive Items)
  const scopeOfWork = Object.values(pkg.lineItems || {})
    .filter((item: any) => item.itemType === 'descriptive' && !item.isOptional)
    .map((item: any) => ({
      title: item.description,
      description: item.details
    }));

  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(now.getDate() + 14); // Default Net 14

  // Mock Files for Demo (In real app, fetch from estimate.attachments)
  const files = [
      { id: 'att-site', type: 'image', name: 'Site_Plan.jpg', date: 'Oct 24, 2023', size: '1.2 MB', url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=300&auto=format&fit=crop' } as any,
      { id: 'att-guide', type: 'file', name: 'HOA_Color_Guidelines.pdf', date: 'Oct 20, 2023', size: '4.5 MB' } as any
  ];

  // Helper to format address
  const formatAddress = (addrObj: any) => {
      if (!addrObj) return '';
      if (typeof addrObj === 'string') return addrObj;
      const parts = [addrObj.address, addrObj.city, addrObj.state ? `${addrObj.state} ${addrObj.zip}` : ''];
      return parts.filter(p => p).join(', ');
  };

  return {
    id: `inv-${Date.now()}`,
    number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    createdDate: now.toISOString(),
    dueDate: dueDate.toISOString(),
    estimateId: estimate.id,
    workOrderId,
    clientId: estimate.customer?.id || 'unknown',
    
    // Enhanced Client Details
    clientName: `${estimate.customer?.firstName} ${estimate.customer?.lastName}`,
    clientAddress: estimate.customer?.billingAddress ? formatAddress({ 
        address: estimate.customer.billingAddress,
        city: estimate.customer.city,
        state: estimate.customer.state,
        zip: estimate.customer.zip 
    }) : '',
    clientEmail: estimate.customer?.email || '',
    clientPhone: estimate.customer?.phone || '',
    
    projectName: estimate.projectName || estimate.name || estimate.projectInfo?.name || "Untitled Project",
    jobAddress: estimate.jobAddress ? formatAddress(estimate.jobAddress) : '',
    
    subtotal: pkg.financials?.baseSubtotal || 0,
    taxAmount: pkg.financials?.baseTaxAmount || 0,
    totalAmount: safeBaseGrandTotal,
    
    depositRequired,
    depositPaid: false,
    amountPaid: 0,
    balanceDue: safeBaseGrandTotal,
    status: 'Sent', 
    
    payments: [],
    items,
    sundries,
    files,
    scopeOfWork,
    terms: pkg.finalize?.terms || ''
  };
};

/**
 * Process a payment for an invoice
 */
export const processInvoicePayment = (
  invoice: Invoice,
  amount: number,
  method: PaymentRecord['method'],
  reference?: string
): Invoice => {
  const newAmountPaid = invoice.amountPaid + amount;
  const newBalanceDue = invoice.totalAmount - newAmountPaid;
  
  const payment: PaymentRecord = {
    id: `pay-${Date.now()}`,
    date: new Date().toISOString(),
    amount,
    method,
    reference,
    recordedBy: 'Admin'
  };

  const isPaidInFull = newBalanceDue <= 0.01;
  const isDepositMet = newAmountPaid >= invoice.depositRequired;

  let newStatus: Invoice['status'] = 'Partially Paid';
  if (isPaidInFull) newStatus = 'Paid';
  else if (newAmountPaid === 0) newStatus = 'Sent';

  return {
    ...invoice,
    amountPaid: newAmountPaid,
    balanceDue: Math.max(0, newBalanceDue),
    depositPaid: isDepositMet,
    status: newStatus,
    payments: [...invoice.payments, payment]
  };
};

/**
 * Revert (delete) a payment from an invoice
 */
export const revertInvoicePayment = (
  invoice: Invoice,
  paymentId: string
): Invoice => {
  const paymentToRemove = invoice.payments.find(p => p.id === paymentId);
  if (!paymentToRemove) return invoice;

  const newPayments = invoice.payments.filter(p => p.id !== paymentId);
  const newAmountPaid = invoice.amountPaid - paymentToRemove.amount;
  const newBalanceDue = invoice.totalAmount - newAmountPaid;
  
  const isPaidInFull = newBalanceDue <= 0.01;
  const isDepositMet = newAmountPaid >= invoice.depositRequired;

  let newStatus: Invoice['status'] = 'Partially Paid';
  if (isPaidInFull) newStatus = 'Paid';
  else if (newAmountPaid === 0) newStatus = 'Sent';

  return {
    ...invoice,
    amountPaid: newAmountPaid,
    balanceDue: Math.max(0, newBalanceDue),
    depositPaid: isDepositMet,
    status: newStatus,
    payments: newPayments
  };
};
