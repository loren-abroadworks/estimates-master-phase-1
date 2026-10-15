
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layers, Trash2, Share2 } from 'lucide-react';
import { Toast } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';
import {
  GlobalSettings, Material, ProductionRate, LineItemTemplate, TermsTemplate, PackageDescriptionTemplate,
  EstimateArea, MiscLineItem, PaintColorEntry, EstimateRow, Estimate,
  Invoice, WorkOrder, UnitType, Client, Lead, Package
} from '../../types';
import { EstimateFormLayout } from './EstimateForm/EstimateFormLayout';
import { PackageSwitcher } from './EstimateForm/PackageSwitcher';
import { PackageModal } from './EstimateForm/PackageModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { addPackage as addPkg, duplicatePackage as duplicatePkg, deletePackage as deletePkg, setRecommended as setRec, migrateEstimate } from '../../services/packages';
import { buildPackagePreviewData, PreviewContext } from '../../services/estimatePreview';
import { ClientEstimatePreview } from './ClientEstimatePreview';
import { calculateLabor, calculateMaterial, calculateExteriorProductionHours, optimizeContainers } from '../../services/calcEngine';

// Modals
import { RichTextEditorModal } from '../modals/RichTextEditorModal';
import { BreakdownModal } from '../modals/BreakdownModal';
import { PaintBreakdownModal } from '../modals/PaintBreakdownModal';
import { SaveSuccessModal } from '../modals/SaveSuccessModal';
import { SendEstimateModal } from '../modals/SendEstimateModal';
import { AddItemModal } from '../modals/AddItemModal';
import { LineItemTemplateModal } from '../modals/LineItemTemplateModal';
import { AreaTemplateModal } from '../modals/AreaTemplateModal';
import { TableColumnsSettingsModal } from '../modals/TableColumnsSettingsModal';
import { ManageColorModal } from '../modals/ManageColorModal';
import { ProductSelectorModal } from '../modals/ProductSelectorModal';
import { SheenSelectorModal } from '../modals/SheenSelectorModal';
import { SundrySelectionModal } from '../modals/SundrySelectionModal';
import { SalesmanSelectionModal } from '../modals/SalesmanSelectionModal';
import { EditClientModal } from '../modals/EditClientModal';
import { EditJobSiteModal } from '../modals/EditJobSiteModal';
import { EditEstimateDatesModal } from '../modals/EditEstimateDatesModal';
import { LineItemTypeModal } from '../modals/LineItemTypeModal';
import { ClientSelectionModal } from '../modals/ClientSelectionModal';
import { PropertySelectionModal } from '../modals/PropertySelectionModal';
import AddMaterialModal from '../modals/AddMaterialModal'; // Default export

interface EstimateFormViewProps {
  settings: GlobalSettings;
  materials: Material[];
  areaTemplates: any[];
  rates: ProductionRate[];
  termsTemplates: TermsTemplate[];
  packageDescriptionTemplates: PackageDescriptionTemplate[];
  setPackageDescriptionTemplates: React.Dispatch<React.SetStateAction<PackageDescriptionTemplate[]>>;
  onAddMaterial: () => void;
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  onUpdateSettings: (s: GlobalSettings) => void;
  template: any | null; 
  estimateType: 'interior' | 'exterior';
  mode: 'template' | 'estimate'; 
  onSaveTemplate: (data: any) => void;
  onSaveEstimate: (data: any) => void;
  onBack?: () => void;
  isInvoiceMode?: boolean;
  onAcceptEstimate?: (data: any) => void;
  onEstimateSent?: (data: any) => void;
  onDeleteEstimate?: (id: string) => void;
  formTitle?: string;
  isTourActive?: boolean;
  
  // Read-only / Linked Data
  linkedInvoice?: Invoice;
  linkedWorkOrder?: WorkOrder;
  onViewInvoice?: (id: string) => void;
  onViewWorkOrder?: (id: string) => void;
  onCreateInvoice?: () => void;
}

export const EstimateFormView = ({
  settings,
  materials,
  areaTemplates,
  rates,
  termsTemplates,
  packageDescriptionTemplates,
  setPackageDescriptionTemplates,
  onAddMaterial,
  setMaterials,
  onUpdateSettings,
  template,
  estimateType,
  mode,
  onSaveTemplate,
  onSaveEstimate,
  onBack,
  isInvoiceMode,
  onAcceptEstimate,
  onEstimateSent,
  onDeleteEstimate,
  formTitle,
  isTourActive,
  linkedInvoice,
  linkedWorkOrder,
  onViewInvoice,
  onViewWorkOrder,
  onCreateInvoice
}: EstimateFormViewProps) => {
  const { t } = useTranslation();
  // --- Data State ---
  const [projectName, setProjectName] = useState('New Estimate');
  const [estimateNumber, setEstimateNumber] = useState('EST-0000');
  
  // Template Specific
  const [description, setDescription] = useState('');
  const [templateScopeIds, setTemplateScopeIds] = useState<string[]>([]);
  
  const [customer, setCustomer] = useState(template?.customer || { firstName: '', lastName: '', email: '', phone: '', billingAddress: '', city: '', state: '', zip: '' });
  const [jobAddress, setJobAddress] = useState(template?.jobAddress || { address: '', city: '', state: '', zip: '', accessCode: '' });
  const [dates, setDates] = useState({ estimateDate: new Date().toISOString(), validUntilDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
  const [salesman, setSalesman] = useState<any>(template?.salesman || null);

  const [estimateAreas, setEstimateAreas] = useState<EstimateArea[]>([]);
  const [lineItems, setLineItems] = useState<Record<string, MiscLineItem>>({});
  const [formLayout, setFormLayout] = useState<string[]>([]);
  
  const [paintColors, setPaintColors] = useState<PaintColorEntry[]>([]);
  const [sundries, setSundries] = useState<any[]>([]);
  const [notes, setNotes] = useState({ customer: '', internal: '' });
  
  const [financials, setFinancials] = useState({
    selectedAccessTierId: '',
    selectedHeightTierId: '',
    taxId: settings.defaultTaxRateId,
    baseGrandTotal: 0,
    baseTaxAmount: 0,
    baseDiscountAmount: 0,
    discountId: settings.defaultDiscountId,
    burdenRate: 0, // Calculated
    opexRate: settings.operatingExpensePercentage,
    baseSubtotal: 0, 
    includeMiscExpense: settings.financialModel.includeMiscExpense !== false 
  });
  
  const [pricingMethod, setPricingMethod] = useState<'hourly' | 'labor'>('hourly');
  const [finalize, setFinalize] = useState({ deposit: '', terms: '' });

  // --- Packages State ---
  const [packages, setPackages] = useState<Package[]>([]);
  const [activePackageId, setActivePackageId] = useState<string>('');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packagesEnabled, setPackagesEnabled] = useState(false);

  // Read the current scalar form state into a package scope (keeping id/name/flags).
  const readFormIntoPackage = (base: Package): Package => ({
    ...base,
    scopeId: templateScopeIds[0] || base.scopeId || 'scope-int',
    pricingMethod,
    estimateAreas,
    lineItems,
    formLayout,
    paintColors,
    sundries,
    financials,
    customerNotes: notes.customer,
    finalize,
  });

  // Push a package's scope into the scalar form state (with burden-rate default).
  const loadPackageIntoForm = (pkg: Package) => {
    setEstimateAreas(pkg.estimateAreas || []);
    setLineItems(pkg.lineItems || {});
    setFormLayout(pkg.formLayout || []);
    setPaintColors(pkg.paintColors || []);
    setSundries(pkg.sundries || []);
    const loaded: any = { ...(pkg.financials || {}) };
    if (!loaded.burdenRate) {
      const model = settings.financialModel;
      const burdenPercent = model.taxSocialSecurity + model.taxFUTA + model.taxSUTA + model.taxWorkmansComp + model.taxLiability + model.benefits;
      loaded.burdenRate = model.avgHourlyPay * (1 + burdenPercent / 100);
    }
    if (loaded.includeMiscExpense === undefined) {
      loaded.includeMiscExpense = settings.financialModel.includeMiscExpense !== false;
    }
    setFinancials(prev => ({ ...prev, ...loaded }));
    setPricingMethod(pkg.pricingMethod || 'hourly');
    setFinalize(pkg.finalize || { deposit: '', terms: '' });
    setNotes(prev => ({ ...prev, customer: pkg.customerNotes || '' }));
  };

  const foldActive = (): Package[] =>
    packages.map(p => (p.id === activePackageId ? readFormIntoPackage(p) : p));

  const switchPackage = (id: string) => {
    if (id === activePackageId) return;
    const folded = foldActive();
    setPackages(folded);
    setActivePackageId(id);
    const target = folded.find(p => p.id === id)!;
    setTemplateScopeIds([target.scopeId || 'scope-int']);
    loadPackageIntoForm(target);
  };

  // Package dialog state (replaces window.prompt/confirm).
  const [packageModal, setPackageModal] = useState<{ open: boolean; mode: 'add' | 'rename' }>({ open: false, mode: 'add' });
  const [confirmDeletePackage, setConfirmDeletePackage] = useState(false);

  const openAddPackage = () => setPackageModal({ open: true, mode: 'add' });
  const openRenamePackage = () => setPackageModal({ open: true, mode: 'rename' });

  // Apply the PackageModal result: create (optionally from a source) or rename the active package.
  const submitPackageModal = (name: string, description: string, sourceId?: string) => {
    if (packageModal.mode === 'rename') {
      setPackages(prev => prev.map(p => (p.id === activePackageId ? { ...p, name, description } : p)));
      return;
    }
    const estLike = { packages: foldActive(), activePackageId, selectedPackageId } as any;
    const next = sourceId ? addPkg(estLike, name, sourceId, description) : addPkg(estLike, name, undefined, description);
    setPackages(next.packages);
    setActivePackageId(next.activePackageId);
    const na = next.packages.find(p => p.id === next.activePackageId)!;
    setTemplateScopeIds([na.scopeId || 'scope-int']);
    loadPackageIntoForm(na);
  };

  const handleSaveDescriptionTemplate = (templateName: string, description: string) => {
    setPackageDescriptionTemplates(prev => [...prev, { id: `pdt-${Date.now()}`, name: templateName, description }]);
  };

  const handleDeleteDescriptionTemplate = (id: string) => {
    setPackageDescriptionTemplates(prev => prev.filter(tpl => tpl.id !== id));
  };

  // One-click duplicate of the active package (no prompt; names it "… (Copy)").
  const handleDuplicatePackage = () => {
    const estLike = { packages: foldActive(), activePackageId, selectedPackageId } as any;
    const next = duplicatePkg(estLike, activePackageId);
    setPackages(next.packages);
    setActivePackageId(next.activePackageId);
    const na = next.packages.find(p => p.id === next.activePackageId)!;
    setTemplateScopeIds([na.scopeId || 'scope-int']);
    loadPackageIntoForm(na);
  };

  const confirmDeleteActivePackage = () => {
    const estLike = { packages: foldActive(), activePackageId, selectedPackageId } as any;
    const next = deletePkg(estLike, activePackageId);
    setPackages(next.packages);
    setActivePackageId(next.activePackageId);
    setSelectedPackageId(next.selectedPackageId);
    const na = next.packages.find(p => p.id === next.activePackageId)!;
    if (na) {
      setTemplateScopeIds([na.scopeId || 'scope-int']);
      loadPackageIntoForm(na);
    }
  };

  const handleToggleRecommended = (id: string) => {
    const next = setRec({ packages: foldActive() } as any, id);
    setPackages(next.packages);
  };

  // Packages mode toggle (driven from the toolbar ⋮ menu).
  const [confirmDisablePackages, setConfirmDisablePackages] = useState(false);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);

  const enablePackages = () => {
    setPackages(foldActive());
    setPackagesEnabled(true);
    // Bring the newly-revealed section into view once it renders.
    setTimeout(() => {
      document.getElementById('packages-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    // Prompt the estimator to name and describe this first package right away.
    setPackageModal({ open: true, mode: 'rename' });
  };

  // Copy a client-facing share link to the clipboard (demo behaviour).
  const handleShare = () => {
    const link = `https://share.estimatemaster.com/e/${estimateNumber}`;
    try { navigator.clipboard?.writeText(link); } catch { /* clipboard unavailable */ }
    setToast({ id: `share-${Date.now()}`, message: t('estimateMenu.shareCopied') });
  };

  // Collapse back to a single normal estimate, keeping the package currently being edited.
  const collapseToActivePackage = () => {
    const folded = foldActive();
    const active = folded.find(p => p.id === activePackageId) || folded[0];
    setPackages([active]);
    setActivePackageId(active.id);
    setSelectedPackageId(null);
    setPackagesEnabled(false);
  };

  const requestDisablePackages = () => {
    if (packages.length > 1) {
      setConfirmDisablePackages(true);
    } else {
      collapseToActivePackage();
    }
  };

  // UI State
  const [currentViewMode, setCurrentViewMode] = useState<'edit' | 'client'>('edit');
  const [paintingModeColorId, setPaintingModeColorId] = useState<string | null>(null);
  const [activeAreaForConfig, setActiveAreaForConfig] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null); 
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedRowInfo, setDraggedRowInfo] = useState<{ areaId: string, rowId: string } | null>(null);
  const [hasViewedPreview, setHasViewedPreview] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // --- Modals State ---
  const [modals, setModals] = useState({
    richText: { isOpen: false, id: '', content: '', title: '' },
    breakdown: { isOpen: false, data: null as any },
    addItem: { isOpen: false, areaId: '' },
    lineItemType: { isOpen: false },
    lineItemTemplate: { isOpen: false, type: null as 'priced' | 'descriptive' | null },
    areaTemplate: { isOpen: false },
    columns: { isOpen: false },
    manageColor: { isOpen: false, colorId: null as string | null },
    productSelect: { isOpen: false, colorId: null as string | null },
    sheenSelect: { isOpen: false, colorId: null as string | null },
    sundrySelect: { isOpen: false },
    addMaterial: { isOpen: false }, 
    salesman: { isOpen: false },
    editClient: { isOpen: false },
    editJobSite: { isOpen: false },
    editDates: { isOpen: false },
    clientSelect: { isOpen: false },
    propertySelect: { isOpen: false },
    saveSuccess: { isOpen: false },
    sendEstimate: { isOpen: false }
  });

  const [paintBreakdownData, setPaintBreakdownData] = useState({
      isOpen: false,
      colorCode: '',
      colorName: '',
      productName: '',
      items: [] as any[],
      totalGallons: 0,
      recommendation: null as any
  });

  // Force edit mode during tour
  useEffect(() => {
    if (isTourActive) {
      setCurrentViewMode('edit');
    }
  }, [isTourActive]);

  // --- Initialization ---
  useEffect(() => {
    if (template) {
        setProjectName(template.projectName || template.name || 'New Estimate');
        setEstimateNumber(template.projectInfo?.number || template.id || 'EST-0000');
        setDescription(template.description || ''); // For Template Mode
        
        // Initialize scopes
        if (template.scopeIds && Array.isArray(template.scopeIds)) {
            setTemplateScopeIds(template.scopeIds);
        } else if (template.scopeId) {
            setTemplateScopeIds([template.scopeId]);
        } else {
            setTemplateScopeIds(['scope-int']);
        }

        if (template.customer) setCustomer(template.customer);
        if (template.jobAddress) setJobAddress(template.jobAddress);
        if (template.projectInfo?.date) setDates({ estimateDate: template.projectInfo.date, validUntilDate: template.projectInfo.validUntil });
        if (template.salesman) setSalesman(template.salesman);
        
        // Wrap legacy/migrated estimate into packages and load the active one into the form.
        const migrated = migrateEstimate(template);
        setPackages(migrated.packages);
        setActivePackageId(migrated.activePackageId);
        setSelectedPackageId(migrated.selectedPackageId);
        setPackagesEnabled(migrated.packagesEnabled);
        const activePkg = migrated.packages.find(p => p.id === migrated.activePackageId) || migrated.packages[0];
        if (activePkg.scopeId) setTemplateScopeIds([activePkg.scopeId]);
        loadPackageIntoForm(activePkg);
        setNotes(prev => ({ ...prev, internal: migrated.internalNotes || '' }));
    } else {
         const model = settings.financialModel;
         const burdenPercent = model.taxSocialSecurity + model.taxFUTA + model.taxSUTA + model.taxWorkmansComp + model.taxLiability + model.benefits;
         const calculatedBurdenRate = model.avgHourlyPay * (1 + burdenPercent / 100);
         setFinancials(prev => ({ ...prev, burdenRate: calculatedBurdenRate, includeMiscExpense: model.includeMiscExpense !== false }));
         setTemplateScopeIds(['scope-int']);
         // Seed a single blank package so a brand-new estimate always has one.
         const blank = migrateEstimate({ id: `est-${Date.now()}`, projectName: 'New Estimate', status: 'Draft', customer, jobAddress, projectInfo: {}, salesman: null, scopeId: 'scope-int', notes: { customer: '', internal: '' } });
         setPackages(blank.packages);
         setActivePackageId(blank.activePackageId);
         setSelectedPackageId(null);
         setPackagesEnabled(false);
    }
  }, [template, settings.financialModel]);

  useEffect(() => {
      if (currentViewMode === 'client') setHasViewedPreview(true);
  }, [currentViewMode]);

  // --- Helper Functions ---
  const toggleModal = (key: keyof typeof modals, value: any) => {
      setModals(prev => ({ ...prev, [key]: value }));
  };

  const isExteriorMode = estimateType === 'exterior';

  // --- Calculations ---
  
  // 1. Labor & Paint Calculations (Memoized for performance)
  const calculatedData = useMemo(() => {
      const heightTier = settings.heightTiers.find(t => t.id === financials.selectedHeightTierId);
      const accessTier = settings.accessTiers.find(t => t.id === financials.selectedAccessTierId);
      
      const hMult = heightTier ? heightTier.multiplier : 1.0;
      const aMult = accessTier ? accessTier.multiplier : 1.0;
      
      const useLaborMargin = pricingMethod === 'labor';
      
      // Accumulators
      let totalLaborHours = 0;
      let totalLaborCost = 0;
      let totalPaintCost = 0;
      
      // Row Breakdown Data for Summary
      const laborBreakdown: any[] = [];
      const paintRequirements: Record<string, number> = {}; // Key: ColorCode-ProductId

      estimateAreas.forEach(area => {
          if (area.isOptional) return; 

          area.rows.forEach(row => {
              if (row.isOptional) return;

              const rate = rates.find(r => r.id === row.productionRateId);
              let rowLaborHours = 0;
              let rowLaborCost = 0;
              let rowPaintCost = 0;

              // Labor Calc
              if (rate) {
                  // Determine Base Hours
                  let baseHrs = 0;
                  if (row.isHoursOverridden) {
                      baseHrs = row.hours || 0;
                  } else {
                      if (isExteriorMode) {
                          baseHrs = calculateExteriorProductionHours(row, rate, settings);
                      } else {
                          const { totalLaborHours } = calculateLabor(row.amount, rate, row.coats, 1, 1, 0, 0, false);
                          baseHrs = totalLaborHours;
                      }
                  }
                  
                  // Add Extra Column Hours
                  const extraHours = settings.extraColumns.reduce((sum, col) => {
                      if (col.type === 'hours') {
                          if (isExteriorMode && ['col-coat1', 'col-coat2', 'col-coat3'].includes(col.id)) return sum;
                          return sum + (Number(row.customValues[col.id]) || 0);
                      }
                      return sum;
                  }, 0);

                  const totalRowHours = (baseHrs + extraHours) * hMult * aMult;
                  
                  const baseHourly = rate.laborRate > 0 ? rate.laborRate : settings.defaultLaborRate;
                  const hourlyRate = useLaborMargin ? baseHourly * (1 + settings.laborMargin) : baseHourly;
                  
                  rowLaborHours = totalRowHours;
                  rowLaborCost = totalRowHours * hourlyRate;
              }

              // Material Calc
              if (row.colorNum) {
                  const paintEntry = paintColors.find(p => p.colorCode === row.colorNum);
                  if (paintEntry && paintEntry.productId) {
                      const material = materials.find(m => m.id === paintEntry.productId);
                      if (material) {
                          const { materialCost, requiredWithWaste } = calculateMaterial(
                              row.amount, material, row.coats, settings.wasteEnabled ? settings.wastePercentage : 0
                          );
                          rowPaintCost = materialCost;
                          
                          // Track gallons for summary
                          const key = `${row.colorNum}|${paintEntry.productId}`;
                          paintRequirements[key] = (paintRequirements[key] || 0) + requiredWithWaste;
                      }
                  }
              }

              // Add to totals
              totalLaborHours += rowLaborHours;
              totalLaborCost += rowLaborCost;
              totalPaintCost += rowPaintCost;

              // Add to breakdown
              laborBreakdown.push({
                  areaName: area.name,
                  surface: row.item,
                  amount: row.amount,
                  unit: row.unit,
                  coats: row.coats,
                  totalHours: rowLaborHours,
                  colorName: paintColors.find(p => p.colorCode === row.colorNum)?.colorName || 'Unassigned',
                  code: row.colorNum,
                  isOptional: row.isOptional
              });
          });
      });

      let optimizedPaintCost = 0;
      const paintSummaryList: any[] = [];

      Object.entries(paintRequirements).forEach(([key, gallons]) => {
          const [colorCode, productId] = key.split('|');
          const material = materials.find(m => m.id === productId);
          const paintEntry = paintColors.find(p => p.colorCode === colorCode);
          
          if (material) {
              const { cost, containersUsed } = optimizeContainers(gallons, material.containers);
              optimizedPaintCost += cost;
              
              containersUsed.forEach(c => {
                  paintSummaryList.push({
                      id: `${key}-${c.label}`,
                      productName: material.name,
                      brand: material.brand,
                      sheen: material.sheen || paintEntry?.finish,
                      colorName: paintEntry?.colorName,
                      colorCode: colorCode,
                      containerLabel: c.label,
                      count: c.count,
                      unitPrice: c.price,
                      total: c.cost
                  });
              });
          }
      });

      return {
          totalLaborHours,
          totalLaborCost,
          totalPaintCost: optimizedPaintCost,
          laborBreakdown,
          paintSummaryList
      };

  }, [estimateAreas, financials.selectedHeightTierId, financials.selectedAccessTierId, pricingMethod, rates, settings, paintColors, materials, isExteriorMode]);

  // 2. Sundries & Misc Totals
  const miscTotal = useMemo(() => {
      return Object.values(lineItems).reduce((acc: number, item: MiscLineItem) => {
          if (item.isOptional) return acc;
          const profitMargin = settings.financialModel?.miscExpenseProfit || 0;
          const applyProfit = settings.financialModel?.applyProfitToMisc && item.operationType !== 'percent';
          const itemTotal = item.total * (applyProfit ? (1 + profitMargin / 100) : 1);
          return acc + itemTotal;
      }, 0);
  }, [lineItems, settings.financialModel]);

  const sundriesTotal = useMemo(() => {
      return sundries.reduce((acc, s) => acc + (s.total || 0), 0);
  }, [sundries]);

  // 3. Grand Total Calculation
  useEffect(() => {
      const model = settings.financialModel;
      const totalAllocatedExpenses = model.materialCost + model.marketingExpense + model.miscExpense;
      const payrollPercent = 100 - model.profitMargin - totalAllocatedExpenses;
      
      let opexDivisorPercent = payrollPercent + model.materialCost;
      if (financials.includeMiscExpense) {
          opexDivisorPercent += model.miscExpense;
      }
      
      const calculatedOpexRate = Math.max(0.01, opexDivisorPercent / 100);
      let baseSubtotal = 0;
      
      if (pricingMethod === 'hourly') {
          baseSubtotal = calculatedData.totalLaborCost + calculatedData.totalPaintCost + sundriesTotal + miscTotal;
      } else {
          const burdenedLaborCost = calculatedData.totalLaborHours * (financials.burdenRate || 0);
          const miscBaseTotal = Object.values(lineItems).reduce((acc: number, item: MiscLineItem) => {
              if (item.isOptional) return acc;
              return acc + item.total; 
          }, 0);

          const totalCost = burdenedLaborCost + calculatedData.totalPaintCost + sundriesTotal + miscBaseTotal;
          baseSubtotal = totalCost / calculatedOpexRate;
      }
      
      const discount = settings.projectDiscounts.find(d => d.id === financials.discountId);
      let discountAmount = 0;
      if (discount) {
          discountAmount = discount.type === 'flat' ? discount.value : baseSubtotal * discount.value;
      }

      const taxableAmount = baseSubtotal - discountAmount;
      const taxRegion = settings.taxRegions.find(r => r.id === financials.taxId) || settings.taxRates.find(r => r.id === financials.taxId); 
      let taxAmount = 0;
      if (taxRegion) {
          if ('salesTaxRate' in taxRegion) taxAmount = taxableAmount * taxRegion.salesTaxRate;
          else if ('rate' in taxRegion) taxAmount = taxableAmount * (taxRegion.rate as number);
      }

      const grandTotal = taxableAmount + taxAmount;

      if (
          Math.abs(financials.baseGrandTotal - grandTotal) > 0.01 || 
          Math.abs(financials.baseTaxAmount - taxAmount) > 0.01 ||
          Math.abs(financials.baseSubtotal - baseSubtotal) > 0.01 ||
          Math.abs(financials.opexRate - calculatedOpexRate) > 0.001
      ) {
          setFinancials(prev => ({
              ...prev,
              baseGrandTotal: grandTotal,
              baseTaxAmount: taxAmount,
              baseDiscountAmount: discountAmount,
              baseSubtotal: baseSubtotal,
              opexRate: calculatedOpexRate
          }));
      }
  }, [
      calculatedData, 
      miscTotal, 
      sundriesTotal, 
      financials.discountId, 
      financials.taxId, 
      financials.includeMiscExpense, 
      financials.burdenRate, 
      pricingMethod, 
      settings,
      lineItems
  ]);


  // --- Action Handlers ---

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedItemIndex === null || draggedItemIndex === index) return;
      const newLayout = [...formLayout];
      const movedItem = newLayout[draggedItemIndex];
      newLayout.splice(draggedItemIndex, 1);
      newLayout.splice(index, 0, movedItem);
      setFormLayout(newLayout);
      setDraggedItemIndex(null);
  };

  const handleRowDragStart = (e: React.DragEvent, areaId: string, rowId: string) => {
      setDraggedRowInfo({ areaId, rowId });
      e.dataTransfer.effectAllowed = "move";
      e.stopPropagation();
  };

  const handleRowDrop = (e: React.DragEvent, areaId: string, targetRowId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedRowInfo || draggedRowInfo.areaId !== areaId || draggedRowInfo.rowId === targetRowId) return;

      setEstimateAreas(prev => prev.map(area => {
          if (area.id !== areaId) return area;
          const rows = [...area.rows];
          const fromIdx = rows.findIndex(r => r.id === draggedRowInfo.rowId);
          const toIdx = rows.findIndex(r => r.id === targetRowId);
          if (fromIdx === -1 || toIdx === -1) return area;
          
          const [movedRow] = rows.splice(fromIdx, 1);
          rows.splice(toIdx, 0, movedRow);
          return { ...area, rows };
      }));
      setDraggedRowInfo(null);
  };

  // Area & Row CRUD
  const handleAddArea = (template: any) => {
      const newAreaId = `area-${Date.now()}`;
      const newRows: EstimateRow[] = (template.defaultRateIds || []).map((rateId: string, idx: number) => {
          const rate = rates.find(r => r.id === rateId);
          return {
              id: `row-${Date.now()}-${idx}`,
              item: rate ? rate.name : 'New Item',
              productionRateId: rateId,
              unit: rate ? rate.unit : UnitType.SQFT,
              amount: 0,
              coats: rate ? rate.defaultCoats : 2,
              hours: 0,
              colorNum: '',
              customValues: {},
              isOptional: false
          };
      });

      const newArea: EstimateArea = {
          id: newAreaId,
          name: template.name || 'New Area',
          length: 0, width: 0, height: 0,
          rows: newRows,
          isOptional: false,
          visibility: {}
      };

      setEstimateAreas(prev => [...prev, newArea]);
      setFormLayout(prev => [...prev, newAreaId]);
      toggleModal('areaTemplate', { isOpen: false });
  };

  const handleAddItemToArea = (rate: ProductionRate) => {
      const areaId = modals.addItem.areaId;
      if (!areaId) return;

      const newRow: EstimateRow = {
          id: `row-${Date.now()}`,
          item: rate.name,
          productionRateId: rate.id,
          unit: rate.unit,
          amount: 0,
          coats: rate.defaultCoats,
          hours: 0,
          colorNum: '',
          customValues: {},
          isOptional: false
      };

      setEstimateAreas(prev => prev.map(area => {
          if (area.id === areaId) {
              return { ...area, rows: [...area.rows, newRow] };
          }
          return area;
      }));
      toggleModal('addItem', { isOpen: false, areaId: '' });
  };

  const updateAreaRow = (areaId: string, rowId: string, field: string, value: any) => {
      setEstimateAreas(prev => prev.map(area => {
          if (area.id !== areaId) return area;
          return {
              ...area,
              rows: area.rows.map(row => {
                  if (row.id !== rowId) return row;
                  
                  if (field === 'hours') {
                      return { ...row, hours: value, isHoursOverridden: true };
                  }
                  
                  if (row.hasOwnProperty(field) || field === 'item' || field === 'amount' || field === 'coats' || field === 'colorNum' || field === 'isOptional' || field === 'coatQuantities') {
                      return { ...row, [field]: value };
                  } else {
                      return { ...row, customValues: { ...row.customValues, [field]: value } };
                  }
              })
          };
      }));
  };

  const deleteAreaRow = (areaId: string, rowId: string) => {
      setEstimateAreas(prev => prev.filter(a => a.id !== areaId));
  };

  const handleDeleteAreaBlock = (id: string) => {
      setEstimateAreas(prev => prev.filter(a => a.id !== id));
      setFormLayout(prev => prev.filter(item => item !== id));
  };

  // Line Item CRUD
  const handleAddLineItem = (template: any) => {
      const id = `misc-${Date.now()}`;
      let newItem: MiscLineItem;

      if (template) {
          newItem = {
              id,
              itemType: template.operationType ? 'priced' : 'descriptive', 
              description: template.title,
              details: template.defaultDetails || '',
              quantity: 1,
              unitPrice: template.defaultPrice || 0,
              total: template.defaultPrice || 0,
              isOptional: false,
              operationType: template.operationType
          };
      } else {
          newItem = {
              id,
              itemType: modals.lineItemTemplate.type || 'descriptive',
              description: 'New Item',
              details: '',
              quantity: 1,
              unitPrice: 0,
              total: 0,
              isOptional: false,
              operationType: 'flat'
          };
      }

      setLineItems(prev => ({ ...prev, [id]: newItem }));
      setFormLayout(prev => [...prev, id]);
      toggleModal('lineItemTemplate', { isOpen: false, type: null });
  };

  const updateMiscLineItem = (id: string, field: keyof MiscLineItem, value: any) => {
      setLineItems(prev => {
          const item = { ...prev[id], [field]: value };
          
          if (field === 'quantity' || field === 'unitPrice' || field === 'operationType') {
              if (item.itemType === 'priced') {
                  if (item.operationType === 'percent') {
                      item.total = item.unitPrice; 
                  } else {
                      item.total = item.quantity * item.unitPrice;
                  }
              }
          }
          return { ...prev, [id]: item };
      });
  };

  const handleDeleteMiscItemBlock = (id: string) => {
      const nextItems = { ...lineItems };
      delete nextItems[id];
      setLineItems(nextItems);
      setFormLayout(prev => prev.filter(item => item !== id));
  };

  // Paint Color CRUD
  const handleAddColor = (color: Partial<PaintColorEntry>) => {
      const newColor: PaintColorEntry = {
          id: `pc-${Date.now()}`,
          colorCode: color.colorCode || '',
          colorName: color.colorName || '',
          brand: color.brand || '',
          productId: color.productId || '',
          finish: color.finish || '',
          area: '',
          surfaces: []
      };
      setPaintColors(prev => [...prev, newColor]);
  };

  const handleUpdateColor = (colorData: Partial<PaintColorEntry>) => {
      if (modals.manageColor.colorId) {
          setPaintColors(prev => prev.map(c => c.id === modals.manageColor.colorId ? { ...c, ...colorData } : c));
      } else {
          handleAddColor(colorData);
      }
  };

  const updatePaintRow = (id: string, field: string, value: any) => {
      setPaintColors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removePaintRow = (id: string) => {
      const removed = paintColors.find(c => c.id === id);
      // Keep the assigned surface rows — just unassign this (now-deleted) color from them.
      if (removed?.colorCode) {
          setEstimateAreas(prev => prev.map(area => ({
              ...area,
              rows: area.rows.map(row => row.colorNum === removed.colorCode ? { ...row, colorNum: '' } : row),
          })));
      }
      setPaintColors(prev => prev.filter(c => c.id !== id));
  };

  const handlePaintRowAction = (areaId: string, rowId: string) => {
      if (paintingModeColorId) {
          const area = estimateAreas.find(a => a.id === areaId);
          const row = area?.rows.find(r => r.id === rowId);
          if (row) {
              const newColor = row.colorNum === paintingModeColorId ? '' : paintingModeColorId;
              updateAreaRow(areaId, rowId, 'colorNum', newColor);
          }
      }
  };

  // Sundry CRUD
  const handleAddSundry = (material: Material) => {
      const newItem = {
          id: `sun-${Date.now()}`,
          materialId: material.id,
          name: material.name,
          count: 1,
          unitPrice: material.containers[0]?.price || 0,
          total: material.containers[0]?.price || 0
      };
      setSundries(prev => [...prev, newItem]);
      toggleModal('sundrySelect', { isOpen: false });
  };

  const handleSundryChange = (id: string, field: 'count' | 'unitPrice', value: number) => {
      setSundries(prev => prev.map(s => {
          if (s.id !== id) return s;
          const next = { ...s, [field]: value };
          next.total = next.count * next.unitPrice;
          return next;
      }));
  };

  const handleOpenBreakdown = (areaName: string, row: EstimateRow) => {
      const rate = rates.find(r => r.id === row.productionRateId);
      if (rate) {
          setModals(prev => ({ 
              ...prev, 
              breakdown: { isOpen: true, data: { row, areaName, rate } } 
          }));
      }
  };

  const handleOpenPaintBreakdown = (colorCode: string) => {
      const paintColor = paintColors.find(p => p.colorCode === colorCode);
      const material = materials.find(m => m.id === paintColor?.productId);
      
      const breakdownItems: any[] = [];
      let totalGallons = 0;

      estimateAreas.forEach(area => {
          area.rows.forEach(row => {
              if (row.colorNum === colorCode) {
                  let gallons = 0;
                  if (material) {
                      const { requiredWithWaste } = calculateMaterial(
                          row.amount, material, row.coats, settings.wasteEnabled ? settings.wastePercentage : 0
                      );
                      gallons = requiredWithWaste;
                  }
                  totalGallons += gallons;
                  breakdownItems.push({
                      areaName: area.name,
                      itemName: row.item,
                      quantity: row.amount,
                      unit: row.unit,
                      coats: row.coats,
                      gallons
                  });
              }
          });
      });

      let recommendation = null;
      if (material && totalGallons > 0) {
          recommendation = optimizeContainers(totalGallons, material.containers);
          recommendation = { 
              containers: recommendation.containersUsed, 
              totalCost: recommendation.cost 
          };
      }

      setPaintBreakdownData({
          isOpen: true,
          colorCode,
          colorName: paintColor?.colorName || '',
          productName: material?.name || '',
          items: breakdownItems,
          totalGallons,
          recommendation
      });
  };

  // --- Final Save Handlers ---
  const prepareEstimateData = (overrideSelectedId?: string) => {
      const base: Package = packages.find(p => p.id === activePackageId) || {
        id: activePackageId || `pkg-${Date.now()}`, name: t('packageSwitcher.defaultName'), isRecommended: false,
        scopeId: templateScopeIds[0] || 'scope-int', pricingMethod, estimateAreas, lineItems, formLayout,
        paintColors, sundries, financials, customerNotes: notes.customer, description: '', finalize,
      };
      const activeFolded = readFormIntoPackage(base);
      const foldedPackages = packages.length
        ? packages.map(p => (p.id === activePackageId ? activeFolded : p))
        : [activeFolded];
      return {
          id: template?.id || `est-${Date.now()}`,
          projectName,
          projectInfo: {
              name: projectName,
              number: estimateNumber,
              date: dates.estimateDate,
              validUntil: dates.validUntilDate
          },
          status: template?.status || 'Draft',
          description,
          scopeIds: templateScopeIds,
          customer,
          jobAddress,
          salesman,
          internalNotes: notes.internal,
          packages: foldedPackages,
          activePackageId: activePackageId || foldedPackages[0].id,
          selectedPackageId: overrideSelectedId ?? selectedPackageId,
          packagesEnabled,

          settings,
          materials,
          rates,
      };
  };

  // Per-package preview data: active package uses live folded state, others use saved scope.
  const previewCtx: PreviewContext = {
    id: template?.id || `est-${estimateNumber}`,
    projectName, estimateNumber, dates, status: template?.status || 'Draft', description,
    customer, jobAddress, salesman, templateScopeIds, internalNotes: notes.internal,
    settings, materials, rates,
  };
  const foldedForPreview: Package[] = packages.length
    ? packages.map(p => (p.id === activePackageId ? readFormIntoPackage(p) : p))
    : [readFormIntoPackage({
        id: activePackageId || `pkg-${estimateNumber}`, name: t('packageSwitcher.defaultName'), isRecommended: false,
        scopeId: templateScopeIds[0] || 'scope-int', pricingMethod, estimateAreas, lineItems, formLayout,
        paintColors, sundries, financials, customerNotes: notes.customer, description: '', finalize,
      } as Package)];
  const previewPackages = foldedForPreview.map(p => ({
    id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.financials?.baseGrandTotal || 0,
    data: buildPackagePreviewData(p, previewCtx),
  }));
  const activePreviewData = previewPackages.find(p => p.id === activePackageId)?.data ?? previewPackages[0].data;
  const buildPreviewData = () => activePreviewData;

  const handleSave = () => {
      const data = prepareEstimateData();
      if (mode === 'template') {
          onSaveTemplate(data);
      } else {
          onSaveEstimate(data);
          toggleModal('saveSuccess', { isOpen: true });
      }
  };

  const handleSendEstimate = (data: any) => {
      const estimate = prepareEstimateData();
      if (onEstimateSent) onEstimateSent({ ...estimate, sentDetails: data });
      toggleModal('sendEstimate', { isOpen: false });
  };

  const handleDeleteCurrent = () => {
      if (!template?.id) {
          if (onBack) onBack();
          return;
      }
      
      if (onDeleteEstimate) {
          onDeleteEstimate(template.id);
      }
  };

  if (currentViewMode === 'client') {
      return (
          <ClientEstimatePreview
              data={buildPreviewData()}
              previewPackages={packagesEnabled ? previewPackages : undefined}
              selectedPackageId={selectedPackageId}
              onSelectPackage={setSelectedPackageId}
              onBack={() => setCurrentViewMode('edit')}
              onUpdateVisibility={(type, id, key, val) => {
                  if (type === 'area') {
                      setEstimateAreas(prev => prev.map(a => a.id === id ? { ...a, visibility: { ...a.visibility, [key]: val } } : a));
                  } else if (type === 'row') {
                      setEstimateAreas(prev => prev.map(a => ({
                          ...a,
                          rows: a.rows.map(r => r.id === id ? { ...r, visibility: { ...r.visibility, [key]: val } } : r)
                      })));
                  } else if (type === 'misc') {
                      setLineItems(prev => ({ ...prev, [id]: { ...prev[id], visibility: { ...prev[id].visibility, [key]: val } } }));
                  }
              }}
              onReorder={(id, dir) => {
                  const idx = formLayout.indexOf(id);
                  if (idx === -1) return;
                  const newLayout = [...formLayout];
                  if (dir === 'up' && idx > 0) {
                      [newLayout[idx], newLayout[idx - 1]] = [newLayout[idx - 1], newLayout[idx]];
                  } else if (dir === 'down' && idx < newLayout.length - 1) {
                      [newLayout[idx], newLayout[idx + 1]] = [newLayout[idx + 1], newLayout[idx]];
                  }
                  setFormLayout(newLayout);
              }}
              onGlobalVisibility={() => { }}
              onAcceptEstimate={(packageId) => {
                  if (packageId) setSelectedPackageId(packageId);
                  if (onAcceptEstimate) onAcceptEstimate(prepareEstimateData(packageId));
              }}
          />
      );
  }

  const computedFormTitle = formTitle || (estimateType === 'exterior' ? t('views.EstimateFormView.exteriorEstimate') : t('views.EstimateFormView.interiorEstimate'));

  // ONBOARDING RULE: If tour is active, override readOnly check to ensure actual buttons are visible.
  const isActuallyReadOnly = isTourActive 
    ? false 
    : (mode === 'template' ? false : (!isUnlocked && (template?.status === 'Sent' || template?.status === 'Approved' || template?.status === 'Paid')));

  // Overflow (⋮) menu actions for the estimate toolbar.
  // Delete is only offered for drafts — sent/approved/paid estimates can't be deleted here.
  const canDeleteEstimate = (template?.status ?? 'Draft') === 'Draft';
  const estimateMenuItems = mode === 'estimate' ? [
    packagesEnabled
      ? { label: t('estimateMenu.disablePackages'), onClick: requestDisablePackages, icon: Layers }
      : { label: t('estimateMenu.enablePackages'), onClick: enablePackages, icon: Layers },
    { label: t('estimateMenu.share'), onClick: handleShare, icon: Share2 },
    ...(canDeleteEstimate
      ? [{ label: t('estimateMenu.deleteEstimate'), onClick: handleDeleteCurrent, icon: Trash2, className: 'text-red-600 dark:text-red-400' }]
      : []),
  ] : undefined;

  const packagesSlot = (mode === 'estimate' && packagesEnabled && packages.length > 0) ? (
    <PackageSwitcher
      packages={packages.map(p => ({
        id: p.id,
        name: p.name,
        isRecommended: p.isRecommended,
        total: p.id === activePackageId ? (financials.baseGrandTotal || 0) : (p.financials?.baseGrandTotal || 0),
      }))}
      activeId={activePackageId}
      onSwitch={switchPackage}
      onAdd={openAddPackage}
      onDuplicate={() => handleDuplicatePackage()}
      onRename={() => openRenamePackage()}
      onDelete={() => setConfirmDeletePackage(true)}
      onToggleRecommended={handleToggleRecommended}
    />
  ) : null;

  return (
    <>
        <PackageModal
          isOpen={packageModal.open}
          mode={packageModal.mode}
          packages={packages.map(p => ({ id: p.id, name: p.name, description: p.description }))}
          activeId={activePackageId}
          initialName={packageModal.mode === 'rename' ? (packages.find(p => p.id === activePackageId)?.name || '') : ''}
          initialDescription={packageModal.mode === 'rename' ? (packages.find(p => p.id === activePackageId)?.description || '') : ''}
          descriptionTemplates={packageDescriptionTemplates}
          onClose={() => setPackageModal(prev => ({ ...prev, open: false }))}
          onSubmit={submitPackageModal}
          onSaveTemplate={handleSaveDescriptionTemplate}
          onDeleteTemplate={handleDeleteDescriptionTemplate}
        />

        <ConfirmationModal
          isOpen={confirmDeletePackage}
          onClose={() => setConfirmDeletePackage(false)}
          onConfirm={confirmDeleteActivePackage}
          title={t('packageModal.deleteTitle')}
          message={t('packageModal.deleteMessage')}
          confirmLabel={t('packageSwitcher.delete')}
        />

        <ConfirmationModal
          isOpen={confirmDisablePackages}
          onClose={() => setConfirmDisablePackages(false)}
          onConfirm={collapseToActivePackage}
          title={t('estimateMenu.disableTitle')}
          message={t('estimateMenu.disableMessage')}
          confirmLabel={t('estimateMenu.disableConfirm')}
        />

        <EstimateFormLayout
            hideHeader={false}
            formTitle={computedFormTitle}
            isInvoiceMode={isInvoiceMode}
            mode={mode}
            packagesSlot={packagesSlot}
            menuItems={estimateMenuItems}

            projectName={projectName}
            setProjectName={setProjectName}
            estimateNumber={estimateNumber}
            viewMode={currentViewMode}
            setViewMode={setCurrentViewMode}
            status={template?.status}
            readOnly={isActuallyReadOnly}
            
            templateDescription={description}
            setTemplateDescription={setDescription}
            selectedScopeIds={templateScopeIds}
            onUpdateScopes={setTemplateScopeIds}

            onSaveDraft={handleSave}
            onSend={() => toggleModal('sendEstimate', { isOpen: true })}
            onDelete={handleDeleteCurrent}
            onEdit={() => setIsUnlocked(true)}
            
            salesman={salesman}
            onOpenSalesmanModal={() => toggleModal('salesman', { isOpen: true })}
            
            customer={customer}
            jobAddress={jobAddress}
            estimateDate={dates.estimateDate}
            validUntilDate={dates.validUntilDate}
            onOpenEditClient={() => toggleModal('editClient', { isOpen: true })}
            onOpenEditJobSite={() => toggleModal('editJobSite', { isOpen: true })}
            onOpenEditDates={() => toggleModal('editDates', { isOpen: true })}
            
            paintColors={paintColors}
            materials={materials}
            getGallonsForPaintRow={(code, prodId) => {
                const mat = materials.find(m => m.id === prodId);
                if (!mat) return 0;
                let total = 0;
                estimateAreas.forEach(a => a.rows.forEach(r => {
                    if (r.colorNum === code) {
                        const { requiredWithWaste } = calculateMaterial(r.amount, mat, r.coats, settings.wasteEnabled ? settings.wastePercentage : 0);
                        total += requiredWithWaste;
                    }
                }));
                return total;
            }}
            openAreaSelector={() => {}} 
            removeSurfaceFromRow={() => {}} 
            openAddSurfaceModal={() => {}}
            updatePaintRow={updatePaintRow}
            openColorModal={(id) => { toggleModal('manageColor', { isOpen: true, colorId: id }); }}
            openSheenModal={(id) => { toggleModal('sheenSelect', { isOpen: true, colorId: id }); }}
            openProductModal={(id) => { toggleModal('productSelect', { isOpen: true, colorId: id }); }}
            removePaintRow={removePaintRow}
            // Fix: pass the toggleModal function directly instead of using undefined names
            addPaintRow={() => toggleModal('manageColor', { isOpen: true, colorId: null })}
            paintSectionRef={null}
            onShowBreakdown={handleOpenPaintBreakdown}
            
            paintingModeColorId={paintingModeColorId}
            setPaintingModeColorId={setPaintingModeColorId}
            handlePaintRow={handlePaintRowAction}
            onAddColor={() => toggleModal('manageColor', { isOpen: true, colorId: null })}
            onEditColor={(id) => toggleModal('manageColor', { isOpen: true, colorId: id })}
            
            formLayout={formLayout}
            estimateAreas={estimateAreas}
            lineItems={lineItems}
            areaSummaries={[]} 
            settings={settings}
            rates={rates} 
            isExterior={isExteriorMode} 
            
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleRowDragStart={handleRowDragStart}
            handleRowDrop={handleRowDrop}
            handleUpdateAreaName={(id, oldN, newN) => setEstimateAreas(prev => prev.map(a => a.id === id ? { ...a, name: newN } : a))}
            handleDeleteAreaBlock={handleDeleteAreaBlock}
            handleDuplicateArea={(id) => {}}
            setIsColumnConfigOpen={() => toggleModal('columns', { isOpen: true })}
            handleSaveAreaAsTemplate={(area) => { }}
            openRichTextModal={(id, content, title) => toggleModal('richText', { isOpen: true, id, content, title })}
            updateAreaOptional={(id, val) => setEstimateAreas(prev => prev.map(a => a.id === id ? { ...a, isOptional: val } : a))}
            setEstimateAreas={setEstimateAreas}
            updateAreaRow={updateAreaRow}
            deleteAreaRow={deleteAreaRow}
            handleOpenBreakdown={handleOpenBreakdown}
            updateAreaNote={(id, note) => setEstimateAreas(prev => prev.map(a => a.id === id ? { ...a, note } : a))}
            handleDeleteMiscItemBlock={handleDeleteMiscItemBlock}
            updateMiscLineItem={updateMiscLineItem}
            openAddItemModal={(id) => toggleModal('addItem', { isOpen: true, areaId: id })}
            setIsLineItemModalOpen={() => toggleModal('lineItemType', { isOpen: true })}
            setActiveAreaForConfig={setActiveAreaForConfig}
            
            notes={notes}
            setNotes={setNotes}
            
            calculatedPaintMaterials={calculatedData.paintSummaryList}
            sundries={sundries}
            materialsTotal={calculatedData.totalPaintCost + sundriesTotal}
            handleSundryChange={handleSundryChange}
            handleMaterialDelete={(id) => setSundries(prev => prev.filter(s => s.id !== id))}
            setIsSundryModalOpen={() => toggleModal('sundrySelect', { isOpen: true })}
            
            grandTotalData={calculatedData.laborBreakdown}
            grandTotalSum={{ app: 0, prep: 0, total: calculatedData.totalLaborHours }}
            
            financials={financials}
            setFinancials={setFinancials}
            pricingMethod={pricingMethod}
            setPricingMethod={setPricingMethod}
            finalize={finalize}
            setFinalize={setFinalize}
            baseTotals={{ hours: calculatedData.totalLaborHours }}
            baseMiscTotal={miscTotal}
            paintCost={calculatedData.totalPaintCost}
            sundriesCost={sundriesTotal}
            termsTemplates={termsTemplates}
            
            onToggleMiscOverhead={(exclude) => setFinancials(prev => ({...prev, includeMiscExpense: !exclude}))}
            excludeMiscOverhead={!financials.includeMiscExpense}

            onViewInvoice={linkedInvoice ? () => onViewInvoice && onViewInvoice(linkedInvoice.id) : undefined}
            onViewWorkOrder={linkedWorkOrder ? () => onViewWorkOrder && onViewWorkOrder(linkedWorkOrder.id) : undefined}
            onCreateInvoice={isInvoiceMode ? undefined : onCreateInvoice}
            onMarkApproved={onAcceptEstimate ? () => onAcceptEstimate(prepareEstimateData()) : undefined}
        />

        {/* --- MODALS --- */}
        <RichTextEditorModal
            isOpen={modals.richText.isOpen}
            onClose={() => toggleModal('richText', { isOpen: false, id: '', content: '' })}
            initialValue={modals.richText.content}
            title={modals.richText.title || t('views.EstimateFormView.editNotes')}
            onSave={(val) => {
                const id = modals.richText.id;
                if (estimateAreas.some(a => a.id === id)) {
                    setEstimateAreas(prev => prev.map(a => a.id === id ? { ...a, note: val } : a));
                } else if (lineItems[id]) {
                    updateMiscLineItem(id, 'details', val);
                }
            }}
        />

        <BreakdownModal
            isOpen={modals.breakdown.isOpen}
            onClose={() => toggleModal('breakdown', { isOpen: false, data: null })}
            data={modals.breakdown.data}
            settings={settings}
            estimateAreas={estimateAreas}
            rates={rates}
        />

        <PaintBreakdownModal
            isOpen={paintBreakdownData.isOpen}
            onClose={() => setPaintBreakdownData(prev => ({ ...prev, isOpen: false }))}
            {...paintBreakdownData}
            isExterior={isExteriorMode}
        />

        <SaveSuccessModal 
            isOpen={modals.saveSuccess.isOpen} 
            onClose={() => toggleModal('saveSuccess', { isOpen: false })} 
            onGoToDashboard={onBack}
        />

        <SendEstimateModal 
            isOpen={modals.sendEstimate.isOpen} 
            onClose={() => toggleModal('sendEstimate', { isOpen: false })} 
            onSend={handleSendEstimate}
            onPreview={() => setCurrentViewMode('client')}
            customerEmail={customer.email}
            projectName={projectName}
            hasViewedPreview={hasViewedPreview}
        />

        <AddItemModal 
            isOpen={modals.addItem.isOpen} 
            onClose={() => toggleModal('addItem', { isOpen: false, areaId: '' })} 
            rates={rates} 
            categories={settings.productionRateCategories}
            onSelect={handleAddItemToArea} 
        />

        <LineItemTypeModal 
            isOpen={modals.lineItemType.isOpen} 
            onClose={() => toggleModal('lineItemType', { isOpen: false })} 
            onSelect={(type) => {
                toggleModal('lineItemType', { isOpen: false });
                if (type === 'area') {
                    toggleModal('areaTemplate', { isOpen: true });
                } else {
                    toggleModal('lineItemTemplate', { isOpen: true, type });
                }
            }} 
        />

        <LineItemTemplateModal
            isOpen={modals.lineItemTemplate.isOpen}
            onClose={() => toggleModal('lineItemTemplate', { isOpen: false, type: null })}
            type={modals.lineItemTemplate.type}
            onSelect={handleAddLineItem}
        />

        <AreaTemplateModal
            isOpen={modals.areaTemplate.isOpen}
            onClose={() => toggleModal('areaTemplate', { isOpen: false })}
            templates={areaTemplates}
            rates={rates}
            onSelect={handleAddArea}
        />

        <TableColumnsSettingsModal
            isOpen={modals.columns.isOpen}
            onClose={() => toggleModal('columns', { isOpen: false })}
            columns={settings.extraColumns}
            onUpdateColumns={(cols) => onUpdateSettings({ ...settings, extraColumns: cols })}
        />

        <ManageColorModal
            isOpen={modals.manageColor.isOpen}
            onClose={() => toggleModal('manageColor', { isOpen: false, colorId: null })}
            onSave={handleUpdateColor}
            onDelete={removePaintRow}
            onUnassignSurface={(aId, rId) => updateAreaRow(aId, rId, 'colorNum', '')}
            initialColor={modals.manageColor.colorId ? paintColors.find(c => c.id === modals.manageColor.colorId) : undefined}
            materials={materials}
            estimateAreas={estimateAreas}
            settings={settings}
        />

        <ProductSelectorModal
            isOpen={modals.productSelect.isOpen}
            onClose={() => toggleModal('productSelect', { isOpen: false, colorId: null })}
            materials={materials}
            onSelect={(mat) => {
                if (modals.productSelect.colorId) {
                    updatePaintRow(modals.productSelect.colorId, 'productId', mat.id);
                    if (mat.sheen) updatePaintRow(modals.productSelect.colorId, 'finish', mat.sheen);
                }
                toggleModal('productSelect', { isOpen: false, colorId: null });
            }}
        />

        <SheenSelectorModal
            isOpen={modals.sheenSelect.isOpen}
            onClose={() => toggleModal('sheenSelect', { isOpen: false, colorId: null })}
            materials={materials}
            onSelect={(mat) => {
                if (modals.sheenSelect.colorId) {
                    updatePaintRow(modals.sheenSelect.colorId, 'finish', mat.sheen || '');
                }
                toggleModal('sheenSelect', { isOpen: false, colorId: null });
            }}
        />

        <SundrySelectionModal
            isOpen={modals.sundrySelect.isOpen}
            onClose={() => toggleModal('sundrySelect', { isOpen: false })}
            materials={materials}
            existingSundryIds={sundries.map(s => s.materialId)}
            onSelect={handleAddSundry}
            onCreateNew={() => {
                toggleModal('sundrySelect', { isOpen: false });
                toggleModal('addMaterial', { isOpen: true });
            }}
        />

        <AddMaterialModal 
            isOpen={modals.addMaterial.isOpen} 
            onClose={() => toggleModal('addMaterial', { isOpen: false })} 
            onSave={(newMat) => {
                setMaterials(prev => [...prev, newMat]);
                handleAddSundry(newMat);
            }}
            mode="general"
        />

        <SalesmanSelectionModal
            isOpen={modals.salesman.isOpen}
            onClose={() => toggleModal('salesman', { isOpen: false })}
            onSelect={(s) => {
                setSalesman(s);
                toggleModal('salesman', { isOpen: false });
            }}
        />

        <EditClientModal
            isOpen={modals.editClient.isOpen}
            onClose={() => toggleModal('editClient', { isOpen: false })}
            customer={customer}
            onSave={setCustomer}
            onSelectExisting={() => toggleModal('clientSelect', { isOpen: true })}
        />

        <ClientSelectionModal 
            isOpen={modals.clientSelect.isOpen} 
            onClose={() => toggleModal('clientSelect', { isOpen: false })} 
            onSelect={(c) => {
                const isClient = (c as any).properties !== undefined;
                
                let firstName = '';
                let lastName = '';
                let city = '';
                let state = '';
                let zip = '';

                if (isClient) {
                    const client = c as Client;
                    firstName = client.firstName || client.name.split(' ')[0];
                    lastName = client.lastName || client.name.split(' ').slice(1).join(' ');
                    if (client.properties && client.properties.length > 0) {
                        city = client.properties[0].city;
                        state = client.properties[0].state;
                        zip = client.properties[0].zip;
                    }
                } else {
                    const lead = c as Lead;
                    firstName = lead.firstName;
                    lastName = lead.lastName;
                    city = lead.city;
                    state = lead.state;
                    zip = lead.zip;
                }

                setCustomer({
                    id: c.id,
                    firstName,
                    lastName,
                    email: c.email,
                    phone: c.phone,
                    billingAddress: c.address,
                    city,
                    state,
                    zip
                });
                toggleModal('clientSelect', { isOpen: false });
            }}
        />

        <EditJobSiteModal
            isOpen={modals.editJobSite.isOpen}
            onClose={() => toggleModal('editJobSite', { isOpen: false })}
            jobAddress={jobAddress}
            billingAddress={{
                address: customer.billingAddress,
                city: customer.city,
                state: customer.state,
                zip: customer.zip
            }}
            onSave={setJobAddress}
            onSelectExisting={() => toggleModal('propertySelect', { isOpen: true })}
        />

        <PropertySelectionModal 
            isOpen={modals.propertySelect.isOpen} 
            onClose={() => toggleModal('propertySelect', { isOpen: false })} 
            properties={[]} 
            onSelect={(p) => {
                setJobAddress({
                    address: p.address,
                    city: p.city,
                    state: p.state,
                    zip: p.zip,
                    accessCode: p.accessCode
                });
                toggleModal('propertySelect', { isOpen: false });
            }}
        />

        <EditEstimateDatesModal
            isOpen={modals.editDates.isOpen}
            onClose={() => toggleModal('editDates', { isOpen: false })}
            dates={dates}
            onSave={setDates}
        />

        {toast && (
            <Toast key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />
        )}
    </>
  );
};
