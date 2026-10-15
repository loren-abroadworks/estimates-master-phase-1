
import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, ArrowDown, Settings, MessageSquare, Check, Printer, EyeOff, Eye, Home, Shield, Box, Palette, ArrowUp, Star, Paintbrush, Users, UserCircle, ArrowRight, File, CheckSquare, Square, PlusCircle
} from 'lucide-react';
import {
  EstimateRow, EstimateArea, MiscLineItem, ClientViewVisibility, ProductionRate, DifficultyTier, Material, PaintColorEntry, ExtraColumn, Attachment
} from '../../types';
import { calculateMaterial } from '../../services/calcEngine';
import { Badge, KebabMenu, Modal, Button } from '../UI';
import { AcceptEstimateModal } from '../modals/AcceptEstimateModal';
import GlobalVisibilityModal from '../modals/GlobalVisibilityModal';
import { FilePreviewModal } from '../modals/FilePreviewModal';
import { PORTFOLIO_ITEMS, REVIEWS, SERVICES } from '../../data/mockData';
import { useTranslation } from '@/i18n/LanguageContext';
import { ClientPackagePicker } from './ClientPackagePicker';
import { PackagePricingTable } from './PackagePricingTable';

// --- CONTRACTOR BRANDING COMPONENT ---
// This simulates the user's logo being used on the client-facing document
const ContractorLogo = ({ size = "md", invert = false }: { size?: "sm" | "md" | "lg", invert?: boolean }) => {
    const { t } = useTranslation();
    const sizeClasses = {
        sm: "h-8",
        md: "h-10",
        lg: "h-14"
    };

    return (
        <div className={`flex items-center gap-3 select-none ${sizeClasses[size]}`}>
            <div className={`aspect-square h-full rounded-lg flex items-center justify-center shadow-sm ${invert ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'}`}>
                <Paintbrush className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-7 h-7'}`} />
            </div>
            <div className={`flex flex-col justify-center ${invert ? 'text-white' : 'text-gray-900'}`}>
                <span className={`font-black uppercase tracking-tight leading-none ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'}`}>{t('views.ClientEstimatePreview.brandName')}</span>
                <span className={`font-bold uppercase tracking-widest leading-none ${invert ? 'text-gray-300' : 'text-primary-600'} ${size === 'lg' ? 'text-xs' : 'text-[0.5rem]'}`}>{t('views.ClientEstimatePreview.brandTagline')}</span>
            </div>
        </div>
    );
};

export const ClientEstimatePreview = ({
    data,
    onBack,
    onUpdateVisibility,
    onReorder,
    onGlobalVisibility,
    onAcceptEstimate,
    previewPackages,
    selectedPackageId,
    onSelectPackage,
}: {
    data: any,
    onBack: () => void,
    onUpdateVisibility: (type: 'area' | 'row' | 'misc' | 'sundry', id: string, key: keyof ClientViewVisibility, value: boolean) => void,
    onReorder: (id: string, direction: 'up' | 'down') => void,
    onGlobalVisibility: (key: 'prices' | 'quantities' | 'coats', val: boolean) => void,
    onAcceptEstimate?: (packageId?: string) => void,
    previewPackages?: { id: string; name: string; isRecommended: boolean; total: number; data: any }[],
    selectedPackageId?: string | null,
    onSelectPackage?: (id: string) => void,
}) => {
  const { t } = useTranslation();
  const hasPicker = !!previewPackages && previewPackages.length > 1;
  const initialViewedId = (selectedPackageId && previewPackages?.some(p => p.id === selectedPackageId))
    ? selectedPackageId
    : (previewPackages?.find(p => p.isRecommended)?.id ?? previewPackages?.[0]?.id ?? null);
  const [viewedPackageId, setViewedPackageId] = useState<string | null>(initialViewedId);
  const viewData = previewPackages?.find(p => p.id === viewedPackageId)?.data ?? data;
  const { customer, jobAddress, projectInfo, salesman, layout, areas, lineItems, notes, finalize, financials, paintColors, materials, sundries, settings, rates, tierSelections, pricingMethod, formTitle, packageDescription } = viewData;
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isOptionalItemsModalOpen, setIsOptionalItemsModalOpen] = useState(false);
  const [isPackageSelectModalOpen, setIsPackageSelectModalOpen] = useState(false);
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  
  // State for optional item selection
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<Set<string>>(new Set());

  // Optional-item ids differ per package, so clear selections when the viewed package changes.
  useEffect(() => {
    setSelectedOptionalIds(new Set());
  }, [viewedPackageId]);

  const handleSelectPackage = (id: string) => {
    setViewedPackageId(id);
    onSelectPackage?.(id);
  };

  // Helper to toggle optional items
  const toggleOption = (id: string) => {
      const next = new Set(selectedOptionalIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedOptionalIds(next);
  };

  // Safe Access to Financials
  const safeBaseGrandTotal = financials?.baseGrandTotal || 0;
  const safeBaseSubtotal = financials?.baseSubtotal || 0;
  // Note: We will recalculate totals dynamically based on Selections

  // Calculate markup for misc items if enabled
  const miscMarkup = settings.financialModel?.applyProfitToMisc 
      ? (1 + (settings.financialModel.miscExpenseProfit || 0) / 100) 
      : 1;

  // Attachments State
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  
  // Mock Attachments for Client Preview
  const attachments: Attachment[] = [
      { id: 'a1', type: 'image', name: 'Site_Plan_Markup.jpg', date: 'Oct 24, 2023', size: '1.2 MB', url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=300&auto=format&fit=crop' },
      { id: 'a2', type: 'file', name: 'HOA_Color_Guidelines.pdf', date: 'Oct 20, 2023', size: '4.5 MB', url: 'https://pdfobject.com/pdf/sample.pdf' },
  ];

  const updateOverride = (type: 'area' | 'row' | 'misc' | 'sundry', id: string, key: keyof ClientViewVisibility) => {
    let currentVal = false;
    if (type === 'area') currentVal = areas.find((a: EstimateArea) => a.id === id)?.visibility?.[key] ?? (key !== 'isHidden');
    if (type === 'row') {
        const row = areas.flatMap((a: EstimateArea) => a.rows).find((r: EstimateRow) => r.id === id);
        currentVal = row?.visibility?.[key] ?? (key !== 'isHidden');
    }
    if (type === 'misc') currentVal = lineItems[id]?.visibility?.[key] ?? (key !== 'isHidden');
    onUpdateVisibility(type, id, key, !currentVal);
  };

  const getAreaConfig = (area: EstimateArea) => {
    const o = area.visibility || {};
    const d = settings.estimateDefaults || {};
    return {
        showAreaLabel: o.showAreaLabel ?? d.showAreaLabel ?? true,
        showAreaPrice: o.showAreaPrice ?? d.showAreaPrice ?? true,
        showColLabels: o.showColLabels ?? d.showColLabels ?? true,
        showColQuantities: o.showColQuantities ?? d.showColQuantities ?? true,
        showColCoats: o.showColCoats ?? d.showColCoats ?? true,
        showColPrices: o.showColPrices ?? d.showColPrices ?? true,
        showColProducts: o.showColProducts ?? d.showColProducts ?? true,
        isHidden: o.isHidden ?? false
    };
  };

  const getRowConfig = (row: EstimateRow) => {
    const o = row.visibility || {};
    const d = settings.estimateDefaults || {};
    return {
        showLabel: o.showLabel ?? d.showLabel ?? true,
        showQuantity: o.showQuantity ?? d.showQuantity ?? true,
        showCoats: o.showCoats ?? d.showCoats ?? true,
        showPrice: o.showPrice ?? d.showPrice ?? true,
        isHidden: o.isHidden ?? false
    };
  };

  const getMiscConfig = (item: MiscLineItem) => {
      const o = item.visibility || {};
      const d = settings.estimateDefaults || {};
      return {
          showLabel: o.showLabel ?? d.showLabel ?? true,
          showQuantity: o.showQuantity ?? d.showQuantity ?? true,
          showPrice: o.showPrice ?? d.showPrice ?? true,
          isHidden: o.isHidden ?? false
      };
  };

  const getSundryConfig = (item: any) => {
      const o = item.visibility || {};
      const d = settings.estimateDefaults || {};
      return {
          showLabel: o.showLabel ?? d.showLabel ?? true,
          showQuantity: o.showQuantity ?? d.showQuantity ?? true,
          showPrice: o.showPrice ?? d.showPrice ?? true,
          isHidden: o.isHidden ?? false
      };
  };

  const handlePrint = () => { window.print(); };

  // Calculate Single Row Cost (Reusable)
  const calculateRowTotal = (row: EstimateRow) => {
    const rate = rates.find((r: ProductionRate) => r.id === row.productionRateId);
    if (!rate) return 0;

    const heightTier = settings.heightTiers.find((t: DifficultyTier) => t.id === tierSelections.heightId);
    const accessTier = settings.accessTiers.find((t: DifficultyTier) => t.id === tierSelections.accessId);
    const hMult = heightTier ? heightTier.multiplier : 1.0;
    const aMult = accessTier ? accessTier.multiplier : 1.0;
    
    const useLaborMargin = pricingMethod === 'labor';
    const baseHourly = rate.laborRate > 0 ? rate.laborRate : settings.defaultLaborRate;
    const hourlyRate = useLaborMargin ? baseHourly * (1 + settings.laborMargin) : baseHourly;

    const laborHours = (row.hours || 0) * hMult * aMult;
    
    // Add extra hours from columns
    const extraHours = settings.extraColumns
        .filter((c: ExtraColumn) => c.type === 'hours')
        .reduce((sum: number, col: ExtraColumn) => sum + (Number(row.customValues[col.id]) || 0), 0);
        
    const totalHours = laborHours + extraHours;
    const laborCost = totalHours * hourlyRate;

    let material: Material | null = null;
    if (row.colorNum) {
         const paintEntry = paintColors.find((pc: PaintColorEntry) => pc.colorCode === row.colorNum);
         if (paintEntry?.productId) {
             material = materials.find((m: Material) => m.id === paintEntry.productId) || null;
         }
    }
    
    const { materialCost } = calculateMaterial(row.amount, material, row.coats, settings.wasteEnabled ? settings.wastePercentage : 0);
    return laborCost + materialCost;
  };

  // --- Compile Optional Items ---
  const optionalItems = useMemo(() => {
    const items: { id: string, title: string, cost: number, type: 'area' | 'row' | 'misc' }[] = [];
    
    areas.forEach((area: EstimateArea) => {
        if (area.isOptional) {
            const areaTotal = area.rows.reduce((sum, r) => sum + calculateRowTotal(r), 0);
            items.push({ id: area.id, title: area.name, cost: areaTotal, type: 'area' });
        } else {
            area.rows.forEach(row => {
                if (row.isOptional) {
                    items.push({ id: row.id, title: row.item, cost: calculateRowTotal(row), type: 'row' });
                }
            });
        }
    });
    
    Object.values(lineItems as Record<string, MiscLineItem>).forEach(item => {
        if (item.isOptional) {
            items.push({ id: item.id, title: item.description || item.itemType, cost: item.total * miscMarkup, type: 'misc' });
        }
    });
    
    return items;
  }, [areas, lineItems, rates, settings, miscMarkup]);

  // Does a given package's scope carry any optional add-ons? (Optional items differ per package.)
  const packageHasOptionals = (pkgData: any): boolean => {
      if (!pkgData) return false;
      const hasAreaOrRow = (pkgData.areas || []).some((a: any) => a.isOptional || (a.rows || []).some((r: any) => r.isOptional));
      const hasMisc = Object.values(pkgData.lineItems || {}).some((it: any) => it.isOptional);
      return hasAreaOrRow || hasMisc;
  };

  const handleAcceptInitiated = () => {
      // With multiple packages, the client picks a package first; add-ons come after.
      if (hasPicker) {
          setPendingPackageId(viewedPackageId);
          setIsPackageSelectModalOpen(true);
      } else if (optionalItems.length > 0) {
          setIsOptionalItemsModalOpen(true);
      } else {
          setIsAcceptModalOpen(true);
      }
  };

  // After the client confirms a package, review that package's add-ons (if any), then sign.
  const confirmPackageSelection = () => {
      const chosenId = pendingPackageId ?? viewedPackageId;
      if (chosenId) handleSelectPackage(chosenId);
      setIsPackageSelectModalOpen(false);
      const chosenData = previewPackages?.find(p => p.id === chosenId)?.data;
      if (packageHasOptionals(chosenData)) {
          setIsOptionalItemsModalOpen(true);
      } else {
          setIsAcceptModalOpen(true);
      }
  };

  // --- Financial Recalculation Logic ---
  const { displaySubtotal, displayTax, displayTotal, displayDiscount } = useMemo(() => {
      // 1. Calculate Optionals Total
      let optionsTotal = 0;
      
      // Areas
      areas.forEach((area: EstimateArea) => {
          if (area.isOptional) {
              // Whole area is optional
              if (selectedOptionalIds.has(area.id)) {
                  // Sum all rows
                  area.rows.forEach(row => {
                      optionsTotal += calculateRowTotal(row);
                  });
              }
          } else {
              // Area is required, check for optional rows
              area.rows.forEach(row => {
                  if (row.isOptional && selectedOptionalIds.has(row.id)) {
                      optionsTotal += calculateRowTotal(row);
                  }
              });
          }
      });

      // Misc Items
      Object.values(lineItems as Record<string, MiscLineItem>).forEach((item) => {
          if (item.isOptional && selectedOptionalIds.has(item.id)) {
              optionsTotal += (item.total * miscMarkup);
          }
      });

      // 2. New Subtotal
      const newSubtotal = safeBaseSubtotal + optionsTotal;

      // 3. New Discount
      const discount = settings.projectDiscounts.find(d => d.id === financials?.discountId);
      let newDiscount = 0;
      if (discount) {
          newDiscount = discount.type === 'flat' ? discount.value : newSubtotal * discount.value;
      }

      // 4. New Tax
      const taxable = newSubtotal - newDiscount;
      const taxRegion = settings.taxRegions.find(r => r.id === financials?.taxId) || settings.taxRates.find(r => r.id === financials?.taxId);
      let newTax = 0;
      if (taxRegion && 'rate' in taxRegion) {
          newTax = taxable * (taxRegion.rate as number);
      } else if (taxRegion && 'salesTaxRate' in taxRegion) {
          newTax = taxable * (taxRegion.salesTaxRate); 
      }

      // 5. New Grand Total
      const newTotal = taxable + newTax;

      return {
          displaySubtotal: newSubtotal,
          displayDiscount: newDiscount,
          displayTax: newTax,
          displayTotal: newTotal
      };
  }, [selectedOptionalIds, safeBaseSubtotal, areas, lineItems, settings, financials, miscMarkup, rates]);


  const colorSchedule = useMemo(() => {
    // Map colors to surfaces (Area Name - Item Name)
    const schedule = paintColors.filter((p: PaintColorEntry) => p.colorCode).map((p: PaintColorEntry) => {
        const usedSurfaces = new Set<string>();
        areas.forEach((area: EstimateArea) => {
            if (area.isOptional && !selectedOptionalIds.has(area.id)) return;
            area.rows.forEach((row: EstimateRow) => {
                if (row.isOptional && !selectedOptionalIds.has(row.id)) return;
                if (row.colorNum === p.colorCode) {
                    usedSurfaces.add(`${area.name} - ${row.item}`);
                }
            });
        });
        
        const material = materials.find((m: Material) => m.id === p.productId);
        
        return {
            ...p,
            locationNames: Array.from(usedSurfaces).sort(),
            productName: material?.name,
            brandName: material?.brand,
            sheenName: material?.sheen || p.finish
        };
    }).filter((p: any) => p.locationNames.length > 0); 
    
    // Sort by Color Code
    schedule.sort((a: any, b: any) => {
        const numA = parseInt(a.colorCode) || 999;
        const numB = parseInt(b.colorCode) || 999;
        return numA - numB;
    });

    return schedule;
  }, [paintColors, areas, materials, selectedOptionalIds]);

  // Calculate Sundries Total (Available but unused in view)
  const sundriesTotal = useMemo(() => {
      if (!sundries) return 0;
      return sundries.reduce((acc: number, item: any) => {
          const sundryConfig = getSundryConfig(item);
          if (sundryConfig.isHidden && !showHiddenItems) return acc;
          return acc + (item.total || 0);
      }, 0);
  }, [sundries, showHiddenItems]);

  const formatDisplayDate = (isoString: string) => {
      if (!isoString) return '-';
      try {
          return new Date(isoString).toLocaleDateString(undefined, { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
          });
      } catch (e) {
          return isoString;
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white relative pb-64 md:pb-32 font-sans text-gray-900">

      <FilePreviewModal file={viewingAttachment} onClose={() => setViewingAttachment(null)} />

      <AcceptEstimateModal
          isOpen={isAcceptModalOpen}
          onClose={() => setIsAcceptModalOpen(false)}
          total={displayTotal}
          terms={finalize.deposit}
          defaultPackageId={viewedPackageId}
          onAccept={(packageId) => {
              if (packageId) handleSelectPackage(packageId);
              if (onAcceptEstimate) onAcceptEstimate(packageId ?? viewedPackageId ?? undefined);
              setIsAcceptModalOpen(false);
          }}
          onEdit={() => { setIsAcceptModalOpen(false); onBack(); }}
      />
      
      <GlobalVisibilityModal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
        onUpdate={onGlobalVisibility}
      />

      {hasPicker && (
        <Modal isOpen={isPackageSelectModalOpen} onClose={() => setIsPackageSelectModalOpen(false)} title={t('views.ClientEstimatePreview.confirmPackageTitle')} maxWidth="max-w-5xl">
          <div className="space-y-6 pb-2">
            <PackagePricingTable
              packages={previewPackages!.map(p => ({ id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.total, description: p.data?.packageDescription }))}
              selectedId={pendingPackageId}
              onSelect={setPendingPackageId}
            />
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <Button
                onClick={confirmPackageSelection}
                disabled={!pendingPackageId}
                className="px-8 shadow-lg shadow-primary-500/30"
              >
                {t('views.ClientEstimatePreview.continue')} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={isOptionalItemsModalOpen} onClose={() => setIsOptionalItemsModalOpen(false)} title={t('views.ClientEstimatePreview.reviewOptionalAddons')}>
          <div className="space-y-6 pb-4">
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex gap-3 text-amber-800">
                  <div className="mt-0.5"><PlusCircle className="w-5 h-5 text-amber-500" /></div>
                  <div className="text-sm">
                      <strong className="block mb-1">{t('views.ClientEstimatePreview.makeYourSelections')}</strong>
                      {t('views.ClientEstimatePreview.reviewOptionalItemsPrompt')}
                  </div>
              </div>
              
              <div className="space-y-3">
                  {optionalItems.map(item => {
                      const isSelected = selectedOptionalIds.has(item.id);
                      return (
                          <div 
                              key={item.id} 
                              onClick={() => toggleOption(item.id)}
                              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                  isSelected 
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                          >
                              <div className="flex items-center gap-3">
                                  <div className={`flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300'}`}>
                                      {isSelected && <Check className="w-4 h-4" />}
                                  </div>
                                  <div>
                                      <div className={`font-bold ${isSelected ? 'text-primary-900 dark:text-white' : 'text-gray-900 dark:text-gray-300'}`}>
                                          {item.title}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5 text-left">
                                          {t('views.ClientEstimatePreview.optionalType', { type: item.type.charAt(0).toUpperCase() + item.type.slice(1) })}
                                      </div>
                                  </div>
                              </div>
                              <div className={`font-bold text-lg ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                                  +${item.cost.toFixed(2)}
                              </div>
                          </div>
                      );
                  })}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm">
                      <span className="text-gray-500">{t('views.ClientEstimatePreview.updatedTotal')}</span>
                      <strong className="text-xl text-gray-900 ml-2">${displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <Button
                      onClick={() => {
                          setIsOptionalItemsModalOpen(false);
                          setIsAcceptModalOpen(true);
                      }}
                      className="px-8 shadow-lg shadow-primary-500/30"
                  >
                      {t('views.ClientEstimatePreview.continueToSign')} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
              </div>
          </div>
      </Modal>

       {/* --- Unified Mobile Action Bar (Non-Obtrusive) --- */}
       {!isAcceptModalOpen && !isOptionalItemsModalOpen && !isPackageSelectModalOpen && !isGlobalSettingsOpen && !viewingAttachment && (
       <div className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden print:hidden bg-white/80 backdrop-blur-md border-t border-gray-200 pb-safe-area shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-around items-center p-3 gap-2">
               <button onClick={onBack} className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-gray-900 active:scale-95 transition-all">
                  <ArrowLeft className="w-5 h-5" />
                  <span className="text-[10px] font-bold">{t('views.ClientEstimatePreview.back')}</span>
               </button>

               <button onClick={() => setIsGlobalSettingsOpen(true)} className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-gray-900 active:scale-95 transition-all">
                  <Settings className="w-5 h-5" />
                  <span className="text-[10px] font-bold">{t('views.ClientEstimatePreview.view')}</span>
               </button>

               <button onClick={handlePrint} className="flex flex-col items-center gap-1 p-2 text-gray-500 hover:text-gray-900 active:scale-95 transition-all">
                  <Printer className="w-5 h-5" />
                  <span className="text-[10px] font-bold">{t('views.ClientEstimatePreview.print')}</span>
               </button>

               <div className="h-8 w-px bg-gray-200 mx-2"></div>

               <button onClick={handleAcceptInitiated} className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-bold rounded-full shadow-lg shadow-primary-500/20 active:scale-95 transition-all">
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">{t('views.ClientEstimatePreview.accept')}</span>
               </button>
          </div>
      </div>
      )}

      {/* --- Desktop Vertical Action Stack (Right Side) --- */}
      {!isAcceptModalOpen && !isOptionalItemsModalOpen && !isPackageSelectModalOpen && !isGlobalSettingsOpen && !viewingAttachment && (
      <div className="hidden lg:flex fixed bottom-12 right-12 z-[60] print:hidden flex-col items-end gap-3 pointer-events-none">
        
        {/* Secondary Actions */}
        <div className="flex flex-col gap-3 pointer-events-auto">
            <button
                onClick={onBack}
                className="w-12 h-12 bg-white text-gray-600 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-105 flex items-center justify-center transition-all group relative"
                title={t('views.ClientEstimatePreview.backToEdit')}
            >
                <ArrowLeft className="w-5 h-5" />
                <span className="absolute right-14 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('views.ClientEstimatePreview.backToEdit')}</span>
            </button>

            <button
                onClick={() => setIsGlobalSettingsOpen(true)}
                className="w-12 h-12 bg-white text-gray-600 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-105 flex items-center justify-center transition-all group relative"
                title={t('views.ClientEstimatePreview.viewSettings')}
            >
                <Settings className="w-5 h-5" />
                <span className="absolute right-14 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('views.ClientEstimatePreview.viewSettings')}</span>
            </button>

            <button
                onClick={() => setShowHiddenItems(!showHiddenItems)}
                className={`w-12 h-12 rounded-full shadow-lg border hover:scale-105 flex items-center justify-center transition-all group relative ${showHiddenItems ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
                title={t('views.ClientEstimatePreview.toggleHiddenItems')}
            >
                {showHiddenItems ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <span className="absolute right-14 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {showHiddenItems ? t('views.ClientEstimatePreview.hideHiddenItems') : t('views.ClientEstimatePreview.showHiddenItems')}
                </span>
            </button>

            <button
                onClick={handlePrint}
                className="w-12 h-12 bg-white text-gray-600 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-105 flex items-center justify-center transition-all group relative"
                title={t('views.ClientEstimatePreview.printPdf')}
            >
                <Printer className="w-5 h-5" />
                <span className="absolute right-14 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('views.ClientEstimatePreview.printSlashPdf')}</span>
            </button>
        </div>

        {/* Primary Action */}
        <div className="mt-4 pointer-events-auto">
             <button
                onClick={handleAcceptInitiated}
                className="flex items-center gap-3 px-8 py-4 bg-primary-600 text-white font-bold rounded-full shadow-xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-105 transition-all text-lg"
             >
                <Check className="w-6 h-6" />
                {t('views.ClientEstimatePreview.acceptEstimate')}
             </button>
        </div>
      </div>
      )}

      {/* --- Sticky Package Switcher: bar above the action bar (below xl) --- */}
      {hasPicker && !isAcceptModalOpen && !isOptionalItemsModalOpen && !isPackageSelectModalOpen && !isGlobalSettingsOpen && !viewingAttachment && (
        <div className="xl:hidden fixed bottom-[84px] left-0 right-0 z-[60] print:hidden bg-white/85 backdrop-blur-md border-t border-gray-200 px-4 py-2 overflow-x-auto">
          <ClientPackagePicker
            packages={previewPackages!.map(p => ({ id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.total }))}
            selectedId={viewedPackageId}
            onSelect={handleSelectPackage}
            showPrice={false}
          />
        </div>
      )}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 print:hidden">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <ContractorLogo />
              </div>
              <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-gray-500 uppercase tracking-wide">
                  <a href="#estimate" className="hover:text-primary-600 transition-colors">{t('views.ClientEstimatePreview.navEstimate')}</a>
                  <a href="#services" className="hover:text-primary-600 transition-colors">{t('views.ClientEstimatePreview.navServices')}</a>
                  <a href="#portfolio" className="hover:text-primary-600 transition-colors">{t('views.ClientEstimatePreview.navPortfolio')}</a>
                  <a href="#reviews" className="hover:text-primary-600 transition-colors">{t('views.ClientEstimatePreview.navReviews')}</a>
                  <a href="#about" className="hover:text-primary-600 transition-colors">{t('views.ClientEstimatePreview.navAbout')}</a>
              </nav>
          </div>
      </header>
      
      <div className="bg-gray-900 text-white pt-24 pb-20 px-6 print:hidden relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
              <Badge color="primary" className="mb-4">{t('views.ClientEstimatePreview.projectProposal')}</Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold font-heading mb-6 tracking-tight">
                  {t('views.ClientEstimatePreview.heroGreeting', { firstName: customer.firstName })}<br/>
                  {t('views.ClientEstimatePreview.heroEstimateReady')}
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
                  {t('views.ClientEstimatePreview.heroSubtext', { projectName: projectInfo.name })}
              </p>
              <div className="flex justify-center gap-4">
                    <button onClick={() => document.getElementById('estimate')?.scrollIntoView({behavior: 'smooth'})} className="px-8 py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all flex items-center gap-2">
                      {t('views.ClientEstimatePreview.viewEstimate')} <ArrowDown className="w-5 h-5" />
                    </button>
              </div>
          </div>
      </div>

      <div className="relative max-w-7xl mx-auto">

      {/* Package switcher: sticky within the estimate section (xl+ has room in the margin). */}
      {hasPicker && (
        <div className="hidden xl:block absolute top-0 right-0 h-full print:hidden">
          <div className="sticky top-24 w-40 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('packagePicker.label')}</div>
            <ClientPackagePicker
              packages={previewPackages!.map(p => ({ id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.total }))}
              selectedId={viewedPackageId}
              onSelect={handleSelectPackage}
              orientation="vertical"
              showPrice={false}
            />
          </div>
        </div>
      )}

      <div id="estimate" className="max-w-[8.5in] mx-auto bg-white min-h-[11in] shadow-2xl my-8 relative z-20 mb-24 print:shadow-none print:my-0 print:w-full print:max-w-none">

        {/* UPDATED HEADER: Centered on Mobile/Tablet */}
        <div className="p-8 md:p-12 pb-8 md:pb-8 relative">
            <div className="text-center mb-8 md:mb-10">
                <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 font-heading tracking-tight mb-2">{formTitle || t('views.ClientEstimatePreview.estimateFallback')}</h2>
                <p className="text-gray-400 font-medium text-sm md:text-lg">{t('views.ClientEstimatePreview.detailedProposal')}</p>
                {packageDescription && (
                    <p className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto mt-4 leading-relaxed">{packageDescription}</p>
                )}
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-center gap-8 relative text-center lg:text-left">
                {/* Company Info - Centered on Mobile/Tablet */}
                <div className="flex flex-row gap-4 md:gap-5 items-center justify-center lg:justify-start text-left">
                    <ContractorLogo size="lg" />
                    <div className="flex flex-col items-start ml-2">
                        <div className="text-xs md:text-sm font-medium text-gray-500 space-y-0.5">
                            <p>{t('views.ClientEstimatePreview.companyAddress')}</p>
                            <p className="text-gray-400">{t('views.ClientEstimatePreview.companyLicense')}</p>
                        </div>
                    </div>
                </div>

                {/* Estimator Info - Centered on Mobile/Tablet */}
                <div className="flex flex-col items-center lg:items-end flex-shrink-0 w-full lg:w-auto">
                    <div className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 w-full text-center lg:text-right">{t('views.ClientEstimatePreview.estimator')}</div>
                    {salesman ? (
                        <>
                        <div className="w-full sm:w-auto flex items-center justify-center lg:justify-end gap-3 md:gap-4 pl-3 md:pl-5 pr-3 md:pr-4 py-2 rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm md:text-base font-bold text-gray-900">{salesman.name}</div>
                                <div className="text-xs md:text-sm text-gray-500 font-medium">{salesman.phone}</div>
                            </div>
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 border border-gray-100 p-0.5 overflow-hidden shadow-sm flex-shrink-0">
                                {salesman.photo ? (
                                <img src={salesman.photo} alt={salesman.name} className="w-full h-full object-cover rounded-full" />
                                ) : ( <UserCircle className="w-full h-full text-gray-300" /> )}
                            </div>
                            <div className="text-left sm:hidden flex-1">
                                <div className="text-base font-bold text-gray-900">{salesman.name}</div>
                                <div className="text-xs text-gray-500 font-medium">{salesman.phone}</div>
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] md:text-xs text-gray-400 font-medium hidden lg:block">{salesman.email}</div>
                        </>
                    ) : (
                        <div className="text-sm text-gray-400 font-medium italic">{t('views.ClientEstimatePreview.notAssigned')}</div>
                    )}
                </div>
            </div>
        </div>

        <div className="px-8 md:px-12"><div className="h-px bg-gray-100 w-full"></div></div>
        
        {/* --- CUSTOMER INFO SECTION --- */}
        <div className="p-4 md:p-12 pb-0">
             <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-8 md:gap-12 border-b border-gray-200 pb-8 md:pb-12">
                 <div className="col-span-1">
                      <h4 className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">{t('views.ClientEstimatePreview.client')}</h4>
                      <div className="space-y-1">
                         <div className="font-bold text-gray-900 text-xl mb-1">{customer.firstName} {customer.lastName}</div>
                         <div className="text-gray-600 leading-relaxed text-sm">
                             {customer.billingAddress || t('views.ClientEstimatePreview.noBillingAddress')}
                             {(customer.city || customer.state || customer.zip) && (<div>{customer.city}, {customer.state} {customer.zip}</div>)}
                         </div>
                         <div className="text-gray-500 text-sm pt-2">
                              {customer.email && <div>{customer.email}</div>}
                              {customer.phone && <div>{customer.phone}</div>}
                         </div>
                      </div>
                 </div>
                 <div className="col-span-1">
                      <h4 className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">{t('views.ClientEstimatePreview.jobSite')}</h4>
                      <div className="space-y-1">
                         <div className="font-bold text-gray-900 text-xl mb-1">{jobAddress.address || t('views.ClientEstimatePreview.sameAsBilling')}</div>
                         <div className="text-gray-600 leading-relaxed text-sm">
                              {jobAddress.city ? `${jobAddress.city}, ${jobAddress.state} ${jobAddress.zip}` : ''}
                         </div>
                      </div>
                 </div>
                 <div className="col-span-2 lg:col-span-1">
                      <h4 className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">{t('views.ClientEstimatePreview.dates')}</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                             <div className="text-xs font-semibold text-gray-400 uppercase mb-1">{t('views.ClientEstimatePreview.estimateDate')}</div>
                             <div className="font-bold text-gray-900 text-base">{formatDisplayDate(projectInfo.date)}</div>
                         </div>
                         <div>
                             <div className="text-xs font-semibold text-gray-400 uppercase mb-1">{t('views.ClientEstimatePreview.validUntil')}</div>
                             <div className="font-bold text-gray-900 text-base">{formatDisplayDate(projectInfo.validUntil)}</div>
                         </div>
                      </div>
                 </div>
             </div>
             <div className="mt-8 mb-6">
                <h3 className="text-2xl font-bold text-gray-900 font-heading">{projectInfo.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('views.ClientEstimatePreview.estNumber')}</span>
                    <span className="font-mono text-sm font-bold text-gray-600">{projectInfo.number}</span>
                </div>
            </div>
        </div>
        
        {/* Reduced horizontal padding on mobile for Scope of Work per request */}
        <div className="px-0 md:px-12 pt-0 pb-8">
            <h3 className="text-lg font-bold text-gray-900 font-heading mb-6 border-b-2 border-primary-600 inline-block pb-1 ml-4 md:ml-0">{t('views.ClientEstimatePreview.scopeOfWork')}</h3>
            <div className="space-y-8">
                {[...layout].sort((aId: string, bId: string) => {
                    const aArea = areas.find((a: any) => a.id === aId);
                    const bArea = areas.find((a: any) => a.id === bId);
                    const aMisc = lineItems[aId];
                    const bMisc = lineItems[bId];
                    const isAOptional = aArea?.isOptional || aMisc?.isOptional;
                    const isBOptional = bArea?.isOptional || bMisc?.isOptional;
                    
                    if (isAOptional && !isBOptional) return 1;
                    if (!isAOptional && isBOptional) return -1;
                    return 0;
                }).map((id: string) => {
                    const area = areas.find((a: any) => a.id === id);
                    const misc = lineItems[id];
                    if (area) {
                        const areaConfig = getAreaConfig(area);
                        if (areaConfig.isHidden && !showHiddenItems) return null;
                        const isOptional = area.isOptional;
                        
                        // Calculate total dynamically considering selections
                        const isAreaSelected = isOptional ? selectedOptionalIds.has(area.id) : true;
                        
                        const areaTotal = area.rows.reduce((sum: number, EstimateRow: any) => {
                           if (EstimateRow.isOptional) {
                               // If row is optional, check if selected
                               if (!selectedOptionalIds.has(EstimateRow.id)) return sum;
                           }
                           return sum + calculateRowTotal(EstimateRow);
                        }, 0);

                        return (
                            <div key={id} className={`mb-6 break-inside-avoid relative group/area ${isOptional ? 'bg-amber-50/20 rounded-xl p-2 -m-2' : ''} ${areaConfig.isHidden ? 'opacity-60 grayscale border-2 border-dashed border-red-200 p-4 rounded-xl print:hidden' : ''}`}>
                                {areaConfig.isHidden && <div className="absolute top-2 right-12 bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded shadow-sm">{t('views.ClientEstimatePreview.hiddenFromClient')}</div>}
                                
                                <div className="flex items-baseline justify-between gap-3 mb-3 border-b border-gray-100 pb-1 px-4 md:px-0">
                                    <div className="flex items-center gap-3 relative">
                                        {/* Optional Checkbox for Area */}
                                        {isOptional && (
                                            <button 
                                                onClick={() => toggleOption(area.id)} 
                                                className={`flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all ${isAreaSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 hover:border-primary-400'}`}
                                            >
                                                {isAreaSelected && <Check className="w-4 h-4" />}
                                            </button>
                                        )}
                                        
                                        {areaConfig.showAreaLabel && (<h4 className={`text-lg font-bold ${isOptional ? 'text-amber-800' : 'text-gray-800'}`}>{area.name} {isOptional && <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">{t('views.ClientEstimatePreview.optionalAddOn')}</span>}</h4>)}
                                        
                                        <div className="opacity-0 group-hover/area:opacity-100 transition-opacity absolute -right-8 top-0">
                                            <KebabMenu items={[
                                                { label: t('views.ClientEstimatePreview.menuMoveUp'), onClick: () => onReorder(area.id, 'up'), icon: ArrowUp },
                                                { label: t('views.ClientEstimatePreview.menuMoveDown'), onClick: () => onReorder(area.id, 'down'), icon: ArrowDown },
                                                { label: areaConfig.showAreaLabel ? t('views.ClientEstimatePreview.menuHideLabel') : t('views.ClientEstimatePreview.menuShowLabel'), onClick: () => updateOverride('area', area.id, 'showAreaLabel'), icon: areaConfig.showAreaLabel ? EyeOff : Eye },
                                                { label: areaConfig.showAreaPrice ? t('views.ClientEstimatePreview.menuHidePrice') : t('views.ClientEstimatePreview.menuShowPrice'), onClick: () => updateOverride('area', area.id, 'showAreaPrice'), icon: areaConfig.showAreaPrice ? EyeOff : Eye },
                                                { label: areaConfig.showColLabels ? t('views.ClientEstimatePreview.menuHideItemCol') : t('views.ClientEstimatePreview.menuShowItemCol'), onClick: () => updateOverride('area', area.id, 'showColLabels'), icon: areaConfig.showColLabels ? EyeOff : Eye },
                                                { label: areaConfig.showColQuantities ? t('views.ClientEstimatePreview.menuHideQtyCol') : t('views.ClientEstimatePreview.menuShowQtyCol'), onClick: () => updateOverride('area', area.id, 'showColQuantities'), icon: areaConfig.showColQuantities ? EyeOff : Eye },
                                                { label: areaConfig.showColCoats ? t('views.ClientEstimatePreview.menuHideCoatsCol') : t('views.ClientEstimatePreview.menuShowCoatsCol'), onClick: () => updateOverride('area', area.id, 'showColCoats'), icon: areaConfig.showColCoats ? EyeOff : Eye },
                                                { label: areaConfig.showColProducts ? t('views.ClientEstimatePreview.menuHideColorCol') : t('views.ClientEstimatePreview.menuShowColorCol'), onClick: () => updateOverride('area', area.id, 'showColProducts'), icon: areaConfig.showColProducts ? EyeOff : Eye },
                                                { label: areaConfig.showColPrices ? t('views.ClientEstimatePreview.menuHidePriceCol') : t('views.ClientEstimatePreview.menuShowPriceCol'), onClick: () => updateOverride('area', area.id, 'showColPrices'), icon: areaConfig.showColPrices ? EyeOff : Eye },
                                                { label: areaConfig.isHidden ? t('views.ClientEstimatePreview.menuRestoreToView') : t('views.ClientEstimatePreview.menuHideFromClient'), onClick: () => updateOverride('area', area.id, 'isHidden'), icon: areaConfig.isHidden ? Eye : EyeOff, className: areaConfig.isHidden ? 'text-green-600' : 'text-red-600' },
                                            ]} />
                                        </div>
                                    </div>
                                    
                                    {areaConfig.showAreaPrice && (
                                        <div className={`font-bold text-lg ${!isAreaSelected && isOptional ? 'text-gray-400' : 'text-gray-900'}`}>
                                            ${areaTotal.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                                
                                <div className={isOptional && !isAreaSelected ? 'opacity-50 grayscale transition-all' : 'transition-all'}>
                                    <table className="w-full text-sm print:table table-fixed">
                                        <thead>
                                            <tr className="text-left text-gray-400 border-b border-gray-50">
                                                {/* Adjusted widths and padding for mobile fit */}
                                                {areaConfig.showColLabels && <th className="font-semibold pb-2 md:pb-3 pl-4 md:pl-4 w-3/12 md:w-5/12 text-xs md:text-sm">{t('views.ClientEstimatePreview.colItem')}</th>}
                                                {areaConfig.showColQuantities && <th className="font-semibold pb-2 md:pb-3 w-2/12 text-right pr-2 md:pr-4 text-xs md:text-sm">{t('views.ClientEstimatePreview.colQty')}</th>}
                                                {areaConfig.showColCoats && <th className="font-semibold pb-2 md:pb-3 w-2/12 md:w-1/12 text-center px-1 md:px-2 text-xs md:text-sm">{t('views.ClientEstimatePreview.colCoats')}</th>}
                                                {areaConfig.showColProducts && <th className="font-semibold pb-2 md:pb-3 pl-2 md:pl-4 w-3/12 md:w-3/12 text-xs md:text-sm">{t('views.ClientEstimatePreview.colProduct')}</th>}
                                                {areaConfig.showColPrices && <th className="font-semibold pb-2 md:pb-3 text-right pr-4 md:pr-4 w-2/12 md:w-2/12 text-xs md:text-sm">{t('views.ClientEstimatePreview.colPrice')}</th>}
                                                <th className="w-0 md:w-4"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {[...area.rows].sort((a: EstimateRow, b: EstimateRow) => {
                                                if (a.isOptional && !b.isOptional) return 1;
                                                if (!a.isOptional && b.isOptional) return -1;
                                                return 0;
                                            }).map((row: EstimateRow) => {
                                                const rowConfig = getRowConfig(row);
                                                if (rowConfig.isHidden && !showHiddenItems) return null;
                                                
                                                // Optional Row Selection
                                                const isRowSelected = row.isOptional ? selectedOptionalIds.has(row.id) : true;
                                                const paintRow = paintColors.find((p: PaintColorEntry) => p.colorCode === row.colorNum);
                                                const product = paintRow?.productId ? materials.find((m: Material) => m.id === paintRow.productId) : null;
                                                const rowPrice = calculateRowTotal(row);
                                                
                                                return (
                                                <tr key={row.id} className={`${row.isOptional ? 'bg-amber-50/30' : ''} relative group/row hover:bg-gray-50/50 ${rowConfig.isHidden ? 'opacity-50 bg-red-50/30 print:hidden' : ''}`}>
                                                    {areaConfig.showColLabels && (
                                                        <td className="py-2 md:py-3 pl-4 md:pl-4 align-top">
                                                            <div className="flex items-center gap-3">
                                                                {/* Optional Row Checkbox */}
                                                                {row.isOptional && !isOptional && (
                                                                    <button 
                                                                        onClick={() => toggleOption(row.id)} 
                                                                        className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border transition-all ${isRowSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 hover:border-primary-400'}`}
                                                                    >
                                                                        {isRowSelected && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                )}
                                                                {rowConfig.showLabel ? (
                                                                    <div className={`break-words whitespace-normal leading-tight ${!isRowSelected ? 'text-gray-400' : 'text-gray-700'}`}>
                                                                        {row.item}{row.isOptional && <span className="text-xs text-amber-600 font-bold ml-1 inline-block">{t('views.ClientEstimatePreview.optionalInline')}</span>}
                                                                    </div>
                                                                ) : <span className="text-gray-300">-</span>}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {areaConfig.showColQuantities && (
                                                        <td className="py-2 md:py-3 align-top text-right pr-2 md:pr-4">
                                                            {rowConfig.showQuantity ? (
                                                                <div className={`flex flex-col items-end leading-tight ${!isRowSelected ? 'opacity-50' : ''}`}>
                                                                    <span className="text-gray-700 font-medium">{row.amount}</span>
                                                                    <span className="text-[9px] md:text-[10px] text-gray-400 uppercase font-bold">{row.unit}</span>
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                    )}
                                                    {areaConfig.showColCoats && (<td className={`py-2 md:py-3 align-top text-center px-1 md:px-2 whitespace-nowrap text-gray-900 font-medium ${!isRowSelected ? 'opacity-50' : ''}`}>{rowConfig.showCoats ? row.coats : '-'}</td>)}
                                                    {areaConfig.showColProducts && (
                                                        <td className={`py-2 md:py-3 align-top pl-2 pr-2 md:pl-4 md:pr-0 break-words whitespace-normal ${!isRowSelected ? 'opacity-50' : ''}`}>
                                                            {product ? (
                                                                <div className="leading-tight">
                                                                    <div className="font-semibold text-gray-900 text-xs">{product.name}</div>
                                                                    <div className="text-[10px] text-gray-500 mt-0.5">{product.sheen} • #{paintRow?.colorCode}</div>
                                                                </div>
                                                            ) : (<span className="text-gray-400">-</span>)}
                                                        </td>
                                                    )}
                                                    {areaConfig.showColPrices && (<td className={`py-2 md:py-3 align-top text-right pr-4 md:pr-4 font-medium whitespace-nowrap ${!isRowSelected ? 'text-gray-400' : 'text-gray-900'}`}>{rowConfig.showPrice ? `$${rowPrice.toFixed(2)}` : '-'}</td>)}
                                                    <td className="py-2 md:py-3 align-top w-0 md:w-4 relative p-0">
                                                        <div className="opacity-0 group-hover/row:opacity-100 transition-opacity absolute right-0 md:-right-6 top-1">
                                                            <KebabMenu items={[
                                                                { label: rowConfig.showLabel ? t('views.ClientEstimatePreview.menuHideLabel') : t('views.ClientEstimatePreview.menuShowLabel'), onClick: () => updateOverride('row', row.id, 'showLabel'), icon: rowConfig.showLabel ? EyeOff : Eye },
                                                                { label: rowConfig.showPrice ? t('views.ClientEstimatePreview.menuHidePrice') : t('views.ClientEstimatePreview.menuShowPrice'), onClick: () => updateOverride('row', row.id, 'showPrice'), icon: rowConfig.showPrice ? EyeOff : Eye },
                                                                { label: rowConfig.showQuantity ? t('views.ClientEstimatePreview.menuHideQty') : t('views.ClientEstimatePreview.menuShowQty'), onClick: () => updateOverride('row', row.id, 'showQuantity'), icon: rowConfig.showQuantity ? EyeOff : Eye },
                                                                { label: rowConfig.showCoats ? t('views.ClientEstimatePreview.menuHideCoats') : t('views.ClientEstimatePreview.menuShowCoats'), onClick: () => updateOverride('row', row.id, 'showCoats'), icon: rowConfig.showCoats ? EyeOff : Eye },
                                                                { label: rowConfig.isHidden ? t('views.ClientEstimatePreview.menuRestoreToView') : t('views.ClientEstimatePreview.menuHideFromClient'), onClick: () => updateOverride('row', row.id, 'isHidden'), icon: rowConfig.isHidden ? Eye : EyeOff, className: rowConfig.isHidden ? 'text-green-600' : 'text-red-600' },
                                                            ]} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>

                                    {area.note && (
                                        <div className="mt-4 text-sm text-gray-600 italic bg-gray-50 p-4 rounded-lg border border-gray-100 relative group/note mx-4 md:mx-0">
                                            <span className="font-bold text-gray-400 text-xs uppercase tracking-wider block mb-1 not-italic">{t('views.ClientEstimatePreview.note')}</span>
                                            <div dangerouslySetInnerHTML={{ __html: area.note }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    } else if (misc) {
                        const miscConfig = getMiscConfig(misc);
                        if (miscConfig.isHidden && !showHiddenItems) return null;
                        
                        const isMiscSelected = misc.isOptional ? selectedOptionalIds.has(misc.id) : true;
                        
                        // Apply Markup to Display
                        const miscItemTotal = misc.total * miscMarkup;

                        return (
                            <div key={id} className={`mb-8 break-inside-avoid relative group/misc ${miscConfig.isHidden ? 'opacity-40 grayscale print:hidden border-2 border-dashed border-red-200 p-4 rounded-xl' : ''}`}>
                                {miscConfig.isHidden && <div className="absolute top-2 right-12 bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded shadow-sm">{t('views.ClientEstimatePreview.hiddenFromClient')}</div>}
                                <div className="absolute -right-8 top-0 z-10 opacity-0 group-hover/misc:opacity-100 transition-opacity">
                                     <KebabMenu items={[
                                         { label: t('views.ClientEstimatePreview.menuMoveUp'), onClick: () => onReorder(misc.id, 'up'), icon: ArrowUp },
                                         { label: t('views.ClientEstimatePreview.menuMoveDown'), onClick: () => onReorder(misc.id, 'down'), icon: ArrowDown },
                                         { label: miscConfig.showLabel ? t('views.ClientEstimatePreview.menuHideLabel') : t('views.ClientEstimatePreview.menuShowLabel'), onClick: () => updateOverride('misc', misc.id, 'showLabel'), icon: miscConfig.showLabel ? EyeOff : Eye },
                                         { label: miscConfig.showPrice ? t('views.ClientEstimatePreview.menuHidePrice') : t('views.ClientEstimatePreview.menuShowPrice'), onClick: () => updateOverride('misc', misc.id, 'showPrice'), icon: miscConfig.showPrice ? EyeOff : Eye },
                                         { label: miscConfig.showQuantity ? t('views.ClientEstimatePreview.menuHideQty') : t('views.ClientEstimatePreview.menuShowQty'), onClick: () => updateOverride('misc', misc.id, 'showQuantity'), icon: miscConfig.showQuantity ? EyeOff : Eye },
                                         { label: miscConfig.isHidden ? t('views.ClientEstimatePreview.menuRestoreToView') : t('views.ClientEstimatePreview.menuHideFromClient'), onClick: () => updateOverride('misc', misc.id, 'isHidden'), icon: miscConfig.isHidden ? Eye : EyeOff, className: miscConfig.isHidden ? 'text-green-600' : 'text-red-600' },
                                     ]} />
                                </div>
                                <div className="flex items-baseline justify-between mb-2 border-b border-gray-100 pb-1 px-4 md:px-0">
                                     <div className="flex items-center gap-3">
                                        {/* Optional Checkbox for Misc */}
                                        {misc.isOptional && (
                                            <button 
                                                onClick={() => toggleOption(misc.id)} 
                                                className={`flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all ${isMiscSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300 hover:border-primary-400'}`}
                                            >
                                                {isMiscSelected && <Check className="w-4 h-4" />}
                                            </button>
                                        )}
                                        
                                        {miscConfig.showLabel && <h4 className={`text-lg font-bold ${misc.isOptional ? 'text-amber-800' : 'text-gray-800'}`}>{misc.description} {misc.isOptional && <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">{t('views.ClientEstimatePreview.optional')}</span>}</h4>}
                                     </div>
                                     {(misc.itemType === 'priced' && miscConfig.showPrice) && (
                                         <div className={`font-bold text-lg ${!isMiscSelected ? 'text-gray-400' : 'text-gray-900'}`}>
                                             ${miscItemTotal.toFixed(2)}
                                         </div>
                                     )}
                                </div>
                                <div className={`text-gray-600 text-sm whitespace-pre-wrap leading-relaxed pl-6 md:pl-2 ${!isMiscSelected ? 'opacity-50' : ''}`} dangerouslySetInnerHTML={{ __html: misc.details || t('views.ClientEstimatePreview.noDetailsProvided') }} />
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        </div>

        {colorSchedule.length > 0 && (
            <div className="px-4 md:px-12 pt-8 pb-8 break-inside-avoid">
                <h3 className="text-lg font-bold text-gray-900 font-heading mb-6 border-b-2 border-primary-600 inline-block pb-1">{t('views.ClientEstimatePreview.paintColors')}</h3>

                {/* Desktop Table View */}
                <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20 text-center">{t('views.ClientEstimatePreview.colorNumber')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('views.ClientEstimatePreview.colorName')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('views.ClientEstimatePreview.productFinish')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('views.ClientEstimatePreview.surfaces')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {colorSchedule.map((p: any) => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 text-center">
                                        <div className="inline-block py-1 px-3 bg-gray-100 border border-gray-200 rounded text-sm font-bold text-gray-700">
                                            {p.colorCode}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="font-bold text-gray-900">{p.colorName || t('views.ClientEstimatePreview.unassigned')}</div>
                                    </td>
                                    <td className="px-6 py-3">
                                        {p.productName ? (
                                            <div>
                                                <div className="font-semibold text-gray-800">{p.productName}</div>
                                                <div className="text-xs text-gray-500">{p.brandName} • {p.sheenName}</div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {p.locationNames.map((loc: string, idx: number) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                    {loc}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                    {colorSchedule.map((p: any) => (
                        <div key={p.id} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center">{p.colorCode}</div>
                                        <h4 className="font-bold text-gray-900">{p.colorName || t('views.ClientEstimatePreview.unassigned')}</h4>
                                    </div>
                                    <div className="text-xs text-gray-500">{p.brandName || t('views.ClientEstimatePreview.noBrand')} • {p.sheenName || t('views.ClientEstimatePreview.noSheen')}</div>
                                </div>
                            </div>
                            
                            {p.productName && (
                                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded">
                                    {p.productName}
                                </div>
                            )}

                            <div>
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('views.ClientEstimatePreview.assignedSurfaces')}</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {p.locationNames && p.locationNames.length > 0 ? (
                                        p.locationNames.map((loc: string, idx: number) => (
                                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold">
                                                {loc}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">{t('views.ClientEstimatePreview.none')}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {notes.customer && (
            <div className="px-4 md:px-12 pb-8 break-inside-avoid">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('views.ClientEstimatePreview.notes')}</h3>
                <div className="text-gray-600 text-sm italic bg-gray-50 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap">{notes.customer}</div>
            </div>
        )}

        {/* --- PROJECT FILES / ATTACHMENTS SECTION --- */}
        {attachments.length > 0 && (
            <div className="px-4 md:px-12 pb-8 break-inside-avoid">
                <h3 className="text-lg font-bold text-gray-900 font-heading mb-6 border-b-2 border-primary-600 inline-block pb-1">{t('views.ClientEstimatePreview.projectFiles')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {attachments.map((file) => (
                        <div key={file.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md transition-all cursor-pointer" onClick={() => setViewingAttachment(file)}>
                            {file.type === 'image' ? (
                                <div className="aspect-square bg-gray-100 relative">
                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                </div>
                            ) : (
                                <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center p-3 text-center relative hover:bg-gray-100 transition-colors">
                                    <File className="w-10 h-10 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-gray-700 line-clamp-2 leading-tight break-all">{file.name}</span>
                                    <span className="text-[10px] text-gray-400 mt-1 font-medium">{file.size}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="bg-gray-50 border-t border-gray-200 p-6 md:p-12 break-inside-avoid">
             <div className="flex justify-end">
                 <div className="w-full md:w-1/2 lg:w-1/3 space-y-3">
                        <div className="flex justify-between text-gray-600 text-sm"><span className="font-medium">{t('views.ClientEstimatePreview.subtotal')}</span><span className="font-bold text-gray-900">${displaySubtotal.toFixed(2)}</span></div>
                        {displayDiscount > 0 && (<div className="flex justify-between text-green-600 text-sm"><span className="font-medium">{t('views.ClientEstimatePreview.discount')}</span><span className="font-bold">-${displayDiscount.toFixed(2)}</span></div>)}
                        {displayTax > 0 && <div className="flex justify-between text-gray-600 text-sm"><span className="font-medium">{t('views.ClientEstimatePreview.tax')}</span><span className="font-bold text-gray-900">${displayTax.toFixed(2)}</span></div>}
                        <div className="h-px bg-gray-200 my-4"></div>
                     <div className="flex justify-between items-end"><span className="font-bold text-gray-900 text-lg">{t('views.ClientEstimatePreview.total')}</span>
                     <span className="font-extrabold text-primary-600 text-3xl">${displayTotal.toFixed(2)}</span></div>
                 </div>
             </div>
             <div className="mt-12 grid grid-cols-2 gap-12 pt-8 border-t border-gray-200">
                 <div><h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('views.ClientEstimatePreview.termsAndConditions')}</h4><p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{finalize.terms || t('views.ClientEstimatePreview.standardTerms')}</p></div>
                 <div><h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-12">{t('views.ClientEstimatePreview.acceptance')}</h4><div className="border-b border-gray-300 mb-2"></div><div className="flex justify-between text-xs text-gray-400 uppercase"><span>{t('views.ClientEstimatePreview.signature')}</span><span>{t('views.ClientEstimatePreview.date')}</span></div></div>
             </div>
        </div>
      </div>
      </div>

      {/* --- Package Options: SaaS-style pricing comparison just below the estimate document --- */}
      {hasPicker && (
        <section id="packages" className="max-w-6xl mx-auto px-6 pt-4 pb-8 mb-16 print:hidden">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold font-heading mb-3 tracking-tight">{t('packageComparison.chooseHeading')}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">{t('packageComparison.chooseSub')}</p>
          </div>
          <PackagePricingTable
            packages={previewPackages!.map(p => ({ id: p.id, name: p.name, isRecommended: p.isRecommended, total: p.total, description: p.data?.packageDescription }))}
            selectedId={viewedPackageId}
            onSelect={handleSelectPackage}
          />
        </section>
      )}

      <div className="max-w-7xl mx-auto px-6 space-y-32 print:hidden mb-24">
          <section id="services">
                <div className="text-center mb-16"><h2 className="text-3xl font-extrabold font-heading mb-4">{t('views.ClientEstimatePreview.ourExpertise')}</h2><p className="text-gray-500 max-w-2xl mx-auto">{t('views.ClientEstimatePreview.ourExpertiseDesc')}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {SERVICES.map((s, i) => (
                      <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 mb-6"><s.icon className="w-7 h-7" /></div>
                            <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                            <p className="text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    ))}
                </div>
          </section>
          <section id="portfolio">
              <div className="flex justify-between items-end mb-12"><div><h2 className="text-3xl font-extrabold font-heading mb-4">{t('views.ClientEstimatePreview.recentProjects')}</h2><p className="text-gray-500">{t('views.ClientEstimatePreview.recentProjectsDesc')}</p></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {PORTFOLIO_ITEMS.map((item) => (
                      <div key={item.id} className="group rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-lg hover:shadow-xl transition-all h-full flex flex-col">
                          <div className="aspect-video overflow-hidden relative w-full"><img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /><div className="absolute top-4 left-4"><Badge color="primary" className="shadow-sm backdrop-blur-md bg-white/90 text-gray-900 border-none px-3 py-1">{item.category}</Badge></div></div>
                          <div className="p-8 flex-1 flex flex-col"><h4 className="text-2xl font-bold text-gray-900 mb-3 font-heading">{item.title}</h4><p className="text-gray-500 leading-relaxed mb-6 flex-1">{t('views.ClientEstimatePreview.portfolioItemDesc', { category: item.category.toLowerCase() })}</p><div className="pt-6 border-t border-gray-100"><span className="inline-flex items-center gap-2 text-primary-700 font-bold text-sm group-hover:gap-3 transition-all cursor-pointer">{t('views.ClientEstimatePreview.viewProjectDetails')} <ArrowRight className="w-4 h-4" /></span></div></div>
                      </div>
                  ))}
              </div>
          </section>
          <section id="reviews" className="bg-gray-900 rounded-3xl p-12 md:p-20 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10"><MessageSquare className="w-64 h-64 text-white" /></div>
                <div className="relative z-10"><h2 className="text-3xl font-extrabold font-heading mb-12 text-center">{t('views.ClientEstimatePreview.clientTestimonials')}</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {REVIEWS.map((r) => (
                          <div key={r.id} className="bg-gray-800 p-8 rounded-2xl border border-gray-700"><div className="flex gap-1 text-amber-400 mb-6">{[...Array(r.rating)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}</div><p className="text-gray-300 text-lg leading-relaxed mb-6">"{r.text}"</p><div><div className="font-bold text-white">{r.author}</div><div className="text-sm text-gray-500">{r.role}</div></div></div>
                      ))}
                </div></div>
          </section>
          <section id="about" className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="order-2 lg:order-1"><div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600 mb-8"><Users className="w-8 h-8" /></div><h2 className="text-4xl font-extrabold font-heading mb-6">{t('views.ClientEstimatePreview.aboutHeading')}</h2><div className="space-y-6 text-gray-600 text-lg leading-relaxed"><p>{t('views.ClientEstimatePreview.aboutPara1')}</p><p>{t('views.ClientEstimatePreview.aboutPara2')}</p><div className="grid grid-cols-2 gap-6 pt-4"><div><div className="text-3xl font-extrabold text-gray-900 mb-1">{t('views.ClientEstimatePreview.statYears')}</div><div className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t('views.ClientEstimatePreview.statYearsLabel')}</div></div><div><div className="text-3xl font-extrabold text-gray-900 mb-1">{t('views.ClientEstimatePreview.statProjects')}</div><div className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t('views.ClientEstimatePreview.statProjectsLabel')}</div></div></div></div></div>
                <div className="order-1 lg:order-2 relative"><div className="aspect-square rounded-3xl overflow-hidden shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500"><img src="https://images.unsplash.com/photo-1595815771614-ade9d652a65d?q=80&w=2070&auto=format&fit=crop" alt={t('views.ClientEstimatePreview.ourTeamAlt')} className="w-full h-full object-cover" /></div><div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-2xl shadow-xl border border-gray-100 max-w-xs"><div className="flex items-center gap-4"><div className="bg-green-100 p-3 rounded-full text-green-600"><Shield className="w-6 h-6" /></div><div><div className="font-bold text-gray-900">{t('views.ClientEstimatePreview.fullyLicensed')}</div><div className="text-xs text-gray-500">{t('views.ClientEstimatePreview.licenseNumber')}</div></div></div></div></div>
          </section>
      </div>

      <footer className="bg-white border-t border-gray-200 py-16 print:hidden">
          <div className="max-w-7xl mx-auto px-6 text-center">
            {/* Expanded Logo in Footer */}
            <div className="flex justify-center mb-6">
                 <ContractorLogo />
            </div>
            <p className="text-gray-400 mb-8">{t('views.ClientEstimatePreview.footerTagline')}</p>
            <div className="flex justify-center gap-8 text-gray-400 mb-12"><span className="hover:text-primary-600 cursor-pointer transition-colors">{t('views.ClientEstimatePreview.footerInstagram')}</span><span className="hover:text-primary-600 cursor-pointer transition-colors">{t('views.ClientEstimatePreview.footerFacebook')}</span><span className="hover:text-primary-600 cursor-pointer transition-colors">{t('views.ClientEstimatePreview.footerHouzz')}</span></div><p className="text-gray-400 text-sm">{t('views.ClientEstimatePreview.footerCopyright')}</p></div>
      </footer>
    </div>
  );
};