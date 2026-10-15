
import React, { useState } from 'react';
import { CheckSquare, Upload, Calculator, Info, Eye, EyeOff, TrendingUp, Send } from 'lucide-react';
import { GlobalSettings } from '../../../../types';
import { InputGroup, Select, TextArea, Button, Toggle } from '../../../UI';
import { Typography } from '../../../../theme/designSystem';
import { useTranslation } from '@/i18n/LanguageContext';

interface FinalizeProps {
  settings: GlobalSettings;
  financials: {
    selectedAccessTierId: string;
    selectedHeightTierId: string;
    taxId: string;
    baseGrandTotal: number;
    burdenRate?: number;
    opexRate?: number;
    baseTaxAmount?: number;
    discountId?: string;
    baseDiscountAmount?: number;
  };
  setFinancials: React.Dispatch<React.SetStateAction<any>>;
  pricingMethod: 'hourly' | 'labor';
  setPricingMethod: (method: 'hourly' | 'labor') => void;
  finalize: { deposit: string; terms: string; };
  setFinalize: React.Dispatch<React.SetStateAction<{ deposit: string; terms: string; }>>;
  baseTotals: { hours: number; };
  baseMiscTotal: number;
  materialsTotal?: number; // Kept for interface compatibility
  paintCost?: number;
  sundriesCost?: number;
  // New props
  onToggleMiscOverhead?: (exclude: boolean) => void;
  excludeMiscOverhead?: boolean;
  onSend?: () => void;
  // Profit Override
  scopeProfitMargin?: number;
  isTemplate?: boolean;
}

export const Finalize: React.FC<FinalizeProps> = ({
  settings,
  financials,
  setFinancials,
  pricingMethod,
  setPricingMethod,
  finalize,
  setFinalize,
  baseTotals,
  baseMiscTotal,
  paintCost = 0,
  sundriesCost = 0,
  onToggleMiscOverhead,
  excludeMiscOverhead = false,
  onSend,
  scopeProfitMargin,
  isTemplate = false
}) => {
  const { t } = useTranslation();
  const [showProfit, setShowProfit] = useState(false);
  const taxRateEntry = settings.taxRates.find(t => t.id === financials.taxId);
  
  // OpEx specific values (defaulting if not passed)
  const burdenRate = financials.burdenRate || 0;
  const opexRate = financials.opexRate || 0.70;

  // Safe Totals
  const safeBaseGrandTotal = financials.baseGrandTotal || 0;
  const safeTaxAmount = financials.baseTaxAmount || 0;
  const safeDiscountAmount = financials.baseDiscountAmount || 0;

  // Round inputs for display consistency
  const displayHours = parseFloat(baseTotals.hours.toFixed(2));
  const displayLaborRate = parseFloat(settings.defaultLaborRate.toFixed(2));
  const displayBurdenRate = parseFloat(burdenRate.toFixed(2));

  // Hourly specific calc for display (Revenue from Labor)
  const hourlyLaborTotal = displayHours * displayLaborRate;

  // True Burdened Cost Calculation (regardless of pricing method selected)
  // This is used to derive Actual Profit if margin is not explicitly forced
  const trueLaborCost = displayHours * displayBurdenRate;

  // Derived Pre-Tax/Pre-Discount Subtotal (The result of the logic block)
  const logicSubtotal = safeBaseGrandTotal - safeTaxAmount + safeDiscountAmount;

  // Profit Calculation Logic
  let estimatedProfit = 0;
  let marginPercent = 0;
  let totalProjectCost = trueLaborCost + paintCost + sundriesCost + baseMiscTotal;

  if (pricingMethod === 'hourly' && scopeProfitMargin !== undefined && scopeProfitMargin > 0) {
      // "Simple" Margin Calculation based on Estimate Type Target
      estimatedProfit = logicSubtotal * (scopeProfitMargin / 100);
      marginPercent = scopeProfitMargin;
      // Reverse engineer "Implied Cost" for consistency in display if needed
      totalProjectCost = logicSubtotal - estimatedProfit;
  } else {
      // Standard "Actual" Profit Calculation (Revenue - Costs)
      estimatedProfit = logicSubtotal - totalProjectCost;
      marginPercent = logicSubtotal > 0 ? ((estimatedProfit / logicSubtotal) * 100) : 0;
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 pt-10">
        <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center border border-primary-100 dark:border-primary-800"><CheckSquare className="w-6 h-6 text-primary-600 dark:text-primary-400" /></div>
                <h3 className={Typography.h2}>{t('views.EstimateForm.sections.Finalize.finalizeEstimate')}</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 px-6 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white font-bold text-base">{t('views.EstimateForm.sections.Finalize.pricingCalculationModel')}</span>
                <div className="flex bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm w-full sm:w-auto">
                    <button onClick={() => setPricingMethod('hourly')} className={`flex-1 sm:flex-none py-2 px-4 rounded-md text-xs font-bold transition-all ${pricingMethod === 'hourly' ? 'bg-gray-900 dark:bg-gray-700 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{t('views.EstimateForm.sections.Finalize.hourlyRate')}</button>
                    <button onClick={() => setPricingMethod('labor')} className={`flex-1 sm:flex-none py-2 px-4 rounded-md text-xs font-bold transition-all ${pricingMethod === 'labor' ? 'bg-gray-900 dark:bg-gray-700 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{t('views.EstimateForm.sections.Finalize.opexRate')}</button>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className={Typography.label}>{t('views.EstimateForm.sections.Finalize.depositPaymentSchedule')}</label>
                    <TextArea placeholder={t('views.EstimateForm.sections.Finalize.outlinePaymentTerms')} value={finalize.deposit} onChange={(v) => setFinalize({...finalize, deposit: v})} rows={4} className="bg-white dark:bg-gray-900 resize-none" />
                </div>
                <div>
                    <label className={Typography.label}>{t('views.EstimateForm.sections.Finalize.termsAndConditions')}</label>
                    <TextArea placeholder={t('views.EstimateForm.sections.Finalize.enterLegalTerms')} rows={4} value={finalize.terms} onChange={(v) => setFinalize({...finalize, terms: v})} className="bg-white dark:bg-gray-900 resize-none" />
                </div>
            </div>

            <div>
                <label className={Typography.label}>{t('views.EstimateForm.sections.Finalize.fileAttachments')}</label>
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 bg-gray-50/30 dark:bg-gray-800/30 flex flex-col items-center justify-center text-center hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/10 dark:hover:bg-primary-900/10 transition-all cursor-pointer group">
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center text-primary-500 mb-3 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"><Upload className="w-6 h-6" /></div>
                    <p className="text-gray-900 dark:text-white font-bold text-base mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{t('views.EstimateForm.sections.Finalize.clickToUpload')} <span className="text-gray-400 dark:text-gray-500 font-normal">{t('views.EstimateForm.sections.Finalize.orDragAndDrop')}</span></p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('views.EstimateForm.sections.Finalize.fileTypes')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <InputGroup label={t('views.EstimateForm.sections.Finalize.accessTierDifficulty')}>
                    <Select value={financials.selectedAccessTierId} onChange={(v) => setFinancials({...financials, selectedAccessTierId: v})} options={[{ label: t('views.EstimateForm.sections.Finalize.selectAccessTier'), value: '' }, ...settings.accessTiers.map(tier => ({ label: `${tier.name} (x${tier.multiplier})`, value: tier.id }))]} />
                </InputGroup>
                <InputGroup label={t('views.EstimateForm.sections.Finalize.heightTierDifficulty')}>
                    <Select value={financials.selectedHeightTierId} onChange={(v) => setFinancials({...financials, selectedHeightTierId: v})} options={[{ label: t('views.EstimateForm.sections.Finalize.selectHeightTier'), value: '' }, ...settings.heightTiers.map(tier => ({ label: `${tier.name} (x${tier.multiplier})`, value: tier.id }))]} />
                </InputGroup>
                <InputGroup label={t('views.EstimateForm.sections.Finalize.applicableTaxRate')}>
                    <Select value={financials.taxId} onChange={(v) => setFinancials({...financials, taxId: v})} options={[{label: t('views.EstimateForm.sections.Finalize.noTax'), value: 'tax-0'}, ...settings.taxRates.filter(t => t.id !== 'tax-0').map(t => ({label: t.name, value: t.id}))]} />
                </InputGroup>
                <InputGroup label={t('views.EstimateForm.sections.Finalize.projectDiscount')}>
                    <Select
                        value={financials.discountId || ''}
                        onChange={(v) => setFinancials({...financials, discountId: v})}
                        options={[
                            {label: t('views.EstimateForm.sections.Finalize.noDiscount'), value: ''},
                            ...settings.projectDiscounts.map(d => ({
                                label: `${d.name} (${d.type === 'flat' ? `$${d.value}` : `${d.value * 100}%`})`,
                                value: d.id
                            }))
                        ]}
                    />
                </InputGroup>
            </div>
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 lg:sticky lg:top-28 transition-all">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.Finalize.summary')}</h3>
                    <div className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {pricingMethod === 'hourly' ? t('views.EstimateForm.sections.Finalize.hourlyModel') : t('views.EstimateForm.sections.Finalize.opexModel')}
                    </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">{t('views.EstimateForm.sections.Finalize.reviewFinalBaseBid')}</p>
                
                {/* Logic Breakdown (Styled as List) */}
                <div className="space-y-3 mb-6">
                    {pricingMethod === 'hourly' ? (
                        <>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.laborHoursRate', { hours: baseTotals.hours.toFixed(2), rate: settings.defaultLaborRate })}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${hourlyLaborTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.plusPaintCost')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${paintCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.plusMaterialsSupplies')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${sundriesCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.plusMiscLineItems')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${baseMiscTotal.toFixed(2)}</span>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                            <div className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg -mx-2">
                                <span className="font-bold text-gray-700 dark:text-gray-300">{t('views.EstimateForm.sections.Finalize.subtotal')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${logicSubtotal.toFixed(2)}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Costs */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.laborHoursRate', { hours: baseTotals.hours.toFixed(2), rate: burdenRate.toFixed(2) })}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${(displayHours * displayBurdenRate).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.plusPaintCost')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${paintCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.plusMaterialsSupplies')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${sundriesCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{t('views.EstimateForm.sections.Finalize.plusMiscLineItems')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${baseMiscTotal.toFixed(2)}</span>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-700 my-2"></div>

                            {/* Divisor Logic */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-primary-700 dark:text-primary-400 font-medium">{t('views.EstimateForm.sections.Finalize.divOpexRate')}</span>
                                <span className="font-bold text-primary-700 dark:text-primary-400">{opexRate.toFixed(2)} ({Math.round(opexRate*100)}%)</span>
                            </div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mb-2">
                                {t('views.EstimateForm.sections.Finalize.divisorFormula')}{!excludeMiscOverhead ? t('views.EstimateForm.sections.Finalize.divisorMiscSuffix') : ''}
                            </div>

                            {onToggleMiscOverhead && (
                                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{t('views.EstimateForm.sections.Finalize.includeMiscExpense')}</span>
                                    <div className="scale-75 origin-right">
                                        <Toggle checked={!excludeMiscOverhead} onChange={(val) => onToggleMiscOverhead && onToggleMiscOverhead(!val)} />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg -mx-2 border border-gray-100 dark:border-gray-700">
                                <span className="font-bold text-gray-700 dark:text-gray-300">{t('views.EstimateForm.sections.Finalize.subtotal')}</span>
                                <span className="font-bold text-gray-900 dark:text-white">${logicSubtotal.toFixed(2)}</span>
                            </div>
                        </>
                    )}

                    {/* Estimated Profit Breakdown with Toggle */}
                    <div className="mt-3">
                        {!showProfit ? (
                            <button 
                                onClick={() => setShowProfit(true)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors border border-green-200 dark:border-green-800"
                            >
                                <Eye className="w-3.5 h-3.5" /> {t('views.EstimateForm.sections.Finalize.showProfitAnalysis')}
                            </button>
                        ) : (
                            <div className="bg-green-50/50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-bold text-green-800 dark:text-green-300 text-sm flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> {t('views.EstimateForm.sections.Finalize.estProfit')}
                                        {(pricingMethod === 'hourly' && scopeProfitMargin) && (
                                            <span className="text-[9px] bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded ml-1">{t('views.EstimateForm.sections.Finalize.targetBadge')}</span>
                                        )}
                                    </span>
                                    <button onClick={() => setShowProfit(false)} className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 bg-green-100 dark:bg-green-800 p-1 rounded-md">
                                        <EyeOff className="w-3 h-3" />
                                    </button>
                                </div>
                                
                                <div className="text-3xl font-black text-green-700 dark:text-green-400 mb-4 tracking-tight">
                                    ${estimatedProfit.toFixed(2)}
                                </div>

                                <div className="space-y-2 text-xs text-green-900/70 dark:text-green-300/70 border-t border-green-200/50 dark:border-green-700/50 pt-3">
                                    <div className="flex justify-between">
                                        <span>{t('views.EstimateForm.sections.Finalize.estRevenue')}</span>
                                        <span className="font-medium text-green-900 dark:text-green-200">${logicSubtotal.toFixed(2)}</span>
                                    </div>
                                    {/* Only show cost breakdown if NOT using simple margin override, or recalculate implied cost */}
                                    {(!scopeProfitMargin || pricingMethod === 'labor') && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>{t('views.EstimateForm.sections.Finalize.laborCostBurdened')}</span>
                                                <span>-${trueLaborCost.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t('views.EstimateForm.sections.Finalize.materials')}</span>
                                                <span>-${(paintCost + sundriesCost).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t('views.EstimateForm.sections.Finalize.misc')}</span>
                                                <span>-${baseMiscTotal.toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between pt-2 border-t border-green-200/50 dark:border-green-700/50 font-bold text-green-900 dark:text-green-200 mt-2">
                                        <span>{t('views.EstimateForm.sections.Finalize.netMargin')}</span>
                                        <span>{marginPercent.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Adjustments */}
                <div className="space-y-3 mb-6">
                    {financials.discountId && (
                        <div className="flex justify-between items-center text-sm text-red-600 dark:text-red-400">
                            <span className="font-medium">{t('views.EstimateForm.sections.Finalize.discountApplied')}</span>
                            <span className="font-bold">-${safeDiscountAmount.toFixed(2)}</span>
                        </div>
                    )}

                    {safeTaxAmount > 0 && (
                         <div className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">{t('views.EstimateForm.sections.Finalize.taxWithName', { name: taxRateEntry?.name })}</span>
                            <span className="font-bold text-gray-900 dark:text-white">+${safeTaxAmount.toFixed(2)}</span>
                        </div>
                    )}
                </div>
                
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-6"></div>
                
                <div className="mb-8">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 block">{t('views.EstimateForm.sections.Finalize.baseBidTotal')}</span>
                    <span className="text-5xl font-black text-primary-600 dark:text-primary-400 tracking-tighter">${safeBaseGrandTotal.toFixed(2)}</span>
                </div>
                
                {!isTemplate && (
                    <div className="space-y-3">
                        <Button onClick={onSend} className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 text-lg rounded-xl shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2" size="lg">
                            <Send className="w-5 h-5" /> {t('views.EstimateForm.sections.Finalize.sendEstimate')}
                        </Button>
                        <Button variant="secondary" className="w-full py-4 text-base bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-200 dark:hover:border-gray-500 rounded-xl active:scale-[0.98] transition-all" size="lg">
                            {t('views.EstimateForm.sections.Finalize.saveAsDraft')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    </section>
  );
};
