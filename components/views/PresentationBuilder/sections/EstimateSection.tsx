
import React, { useMemo } from 'react';
import { UserCircle, MapPin, Calendar, Clock, Droplets, Check } from 'lucide-react';
import { ContractorLogo } from '../components/ContractorLogo';
import { EstimateRow, EstimateArea, PaintColorEntry, Material, DifficultyTier, ProductionRate } from '../../../../types';
import { calculateMaterial } from '../../../../services/calcEngine';
import { Badge } from '../../../UI';
import { DEFAULT_SETTINGS } from '../../../../constants'; // Import default settings for fallback
import { useTranslation } from '@/i18n/LanguageContext';

const calculateRowTotal = (
    row: EstimateRow, 
    rates: ProductionRate[], 
    settings: any, 
    tierSelections: any, 
    pricingMethod: string, 
    paintColors: PaintColorEntry[], 
    materials: Material[]
) => {
    const rate = rates.find((r: ProductionRate) => r.id === row.productionRateId);
    if (!rate) return 0;
    
    // Safety check for settings
    const safeSettings = settings || DEFAULT_SETTINGS;

    const hMult = safeSettings.heightTiers?.find((t: DifficultyTier) => t.id === tierSelections?.heightId)?.multiplier || 1.0;
    const aMult = safeSettings.accessTiers?.find((t: DifficultyTier) => t.id === tierSelections?.accessId)?.multiplier || 1.0;
    
    const hourlyRate = pricingMethod === 'labor' ? safeSettings.defaultLaborRate * (1 + safeSettings.laborMargin) : safeSettings.defaultLaborRate;
    const laborHours = (row.hours || 0) * hMult * aMult;
    
    let material: Material | null = null;
    if (row.colorNum) {
         const paintEntry = paintColors?.find((pc: PaintColorEntry) => pc.colorCode === row.colorNum);
         if (paintEntry?.productId) material = materials?.find((m: Material) => m.id === paintEntry.productId) || null;
    }
    const { materialCost } = calculateMaterial(row.amount, material, row.coats, safeSettings.wasteEnabled ? safeSettings.wastePercentage : 0);
    return (laborHours * hourlyRate) + materialCost;
};

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

export const EstimateSection = ({ 
    toolbar, 
    data,
    id,
    viewDevice
}: { 
    toolbar?: React.ReactNode, 
    data: any,
    id?: string,
    viewDevice?: 'desktop' | 'mobile'
}) => {
    const { 
        customer, jobAddress, projectInfo, salesman, layout, areas, 
        paintColors, materials, settings, rates, tierSelections, 
        pricingMethod, financials 
    } = data;

    const isMobile = viewDevice === 'mobile';
    const safeSettings = settings || DEFAULT_SETTINGS;

    const financials_calcs = useMemo(() => {
        const subtotal = financials?.baseSubtotal || 0;
        const discount = safeSettings.projectDiscounts?.find((d: any) => d.id === financials?.discountId);
        let discVal = 0;
        if (discount) discVal = discount.type === 'flat' ? discount.value : subtotal * discount.value;
        const taxable = subtotal - discVal;
        const taxRegion = safeSettings.taxRegions?.find((r: any) => r.id === financials?.taxId) || safeSettings.taxRates?.find((r: any) => r.id === financials?.taxId);
        let taxVal = 0;
        if (taxRegion && 'rate' in taxRegion) taxVal = taxable * (taxRegion.rate as number);
        else if (taxRegion && 'salesTaxRate' in taxRegion) taxVal = taxable * (taxRegion.salesTaxRate);
        return { subtotal, discVal, taxVal, total: taxable + taxVal };
    }, [financials, safeSettings]);

    const colorSchedule = useMemo(() => {
        return (paintColors || []).filter((p: PaintColorEntry) => p.colorCode).map((p: PaintColorEntry) => {
            const usedSurfaces = new Set<string>();
            (areas || []).forEach((area: EstimateArea) => {
                area.rows.forEach((row: EstimateRow) => {
                    if (row.colorNum === p.colorCode) {
                        usedSurfaces.add(`${area.name} - ${row.item}`);
                    }
                });
            });
            const material = materials?.find((m: Material) => m.id === p.productId);
            return {
                ...p,
                locationNames: Array.from(usedSurfaces).sort(),
                productName: material?.name,
                brandName: material?.brand,
                sheenName: material?.sheen || p.finish
            };
        }).filter((p: any) => p.locationNames.length > 0 || p.colorName);
    }, [paintColors, areas, materials]);

    const { t } = useTranslation();

    if (!projectInfo) return null;

    return (
        <div id={id || "estimate"} className={`relative group bg-white pb-12 relative z-20 ${isMobile ? 'pt-8' : 'pt-24'} print:shadow-none print:w-full print:max-w-none`}>
            {toolbar}
            <div className={`${isMobile ? 'mx-4' : 'max-w-[8.5in] mx-auto'} bg-white shadow-2xl rounded-2xl mb-12 border border-gray-100 overflow-hidden`}>
                <div className={`${isMobile ? 'p-6' : 'p-12'} pb-8 text-center`}>
                    <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl md:text-5xl'} font-extrabold text-gray-900 font-heading tracking-tight mb-1`}>{t('views.PresentationBuilder.sections.EstimateSection.proposal')}</h2>
                    <p className="text-gray-400 font-medium text-xs md:text-lg">{t('views.PresentationBuilder.sections.EstimateSection.detailedProposalScope')}</p>
                </div>

                <div className={`${isMobile ? 'p-6' : 'px-12 pb-12'} flex flex-col md:flex-row justify-between items-center gap-8 relative text-center md:text-left`}>
                    <div className="flex flex-row gap-4 md:gap-5 items-center justify-center md:justify-start text-left">
                        <ContractorLogo size={isMobile ? "md" : "lg"} />
                        <div className="flex flex-col items-start ml-2">
                            <div className="text-[10px] md:text-sm font-medium text-gray-500 space-y-0.5">
                                <p>123 Painter's Lane, Color City, NY</p>
                                <p className="text-gray-400">license #12345678</p>
                            </div>
                        </div>
                    </div>
                    {salesman && (
                        <div className="flex flex-col items-center md:items-end flex-shrink-0 w-full md:w-auto">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{t('views.PresentationBuilder.sections.EstimateSection.estimator')}</div>
                            <div className="w-full sm:w-auto flex items-center justify-center md:justify-end gap-3 p-2 pr-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100 overflow-hidden shadow-sm shrink-0">
                                    {salesman.photo ? <img src={salesman.photo} className="w-full h-full object-cover" alt={salesman.name} /> : <UserCircle className="w-full h-full text-gray-300" />}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-gray-900">{salesman.name}</div>
                                    <div className="text-[10px] text-gray-500">{salesman.phone}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 md:px-12"><div className="h-px bg-gray-100 w-full"></div></div>
                
                <div className={`${isMobile ? 'p-6' : 'p-12'} space-y-8`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <h4 className="font-bold text-gray-400 text-[10px] uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">{t('views.PresentationBuilder.sections.EstimateSection.client')}</h4>
                            <div className="font-bold text-gray-900 text-lg mb-1">{customer?.firstName} {customer?.lastName}</div>
                            <div className="text-gray-600 text-sm">{customer?.billingAddress}</div>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-400 text-[10px] uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">{t('views.PresentationBuilder.sections.EstimateSection.jobSite')}</h4>
                            <div className="font-bold text-gray-900 text-sm md:text-base">{jobAddress?.address || t('views.PresentationBuilder.sections.EstimateSection.sameAsBilling')}</div>
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-400 text-[10px] uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">{t('views.PresentationBuilder.sections.EstimateSection.details')}</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">{t('views.PresentationBuilder.sections.EstimateSection.date')}</span>
                                    <span className="font-bold text-gray-700">{formatDisplayDate(projectInfo.date)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">{t('views.PresentationBuilder.sections.EstimateSection.project')}</span>
                                    <span className="font-bold text-gray-700">{projectInfo.number}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-gray-900 font-heading mb-6 border-b-2 border-primary-600 inline-block pb-1">{t('views.PresentationBuilder.sections.EstimateSection.projectScope')}</h3>
                        <div className="space-y-8">
                            {(layout || []).map((areaId: string) => {
                                const area = areas.find((a: any) => a.id === areaId);
                                if (!area) return null;
                                const areaTotal = area.rows.reduce((sum: number, row: EstimateRow) => sum + (row.isOptional ? 0 : calculateRowTotal(row, rates || [], safeSettings, tierSelections, pricingMethod, paintColors || [], materials || [])), 0);
                                
                                return (
                                    <div key={areaId} className="group/area">
                                        <div className="flex items-baseline justify-between gap-3 mb-4 border-b border-gray-100 pb-2">
                                            <h4 className="text-lg font-bold text-gray-800">{area.name}</h4>
                                            <div className="font-black text-gray-900">${areaTotal.toFixed(2)}</div>
                                        </div>
                                        
                                        {!isMobile ? (
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-gray-400 border-b border-gray-50 text-[10px] font-black uppercase tracking-wider">
                                                        <th className="pb-3 pl-2">{t('views.PresentationBuilder.sections.EstimateSection.surfaceItem')}</th>
                                                        <th className="pb-3 text-right pr-4">{t('views.PresentationBuilder.sections.EstimateSection.quantity')}</th>
                                                        <th className="pb-3 text-center px-2">{t('views.PresentationBuilder.sections.EstimateSection.coats')}</th>
                                                        <th className="pb-3 text-right pr-4">{t('views.PresentationBuilder.sections.EstimateSection.amount')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {area.rows.map((row: EstimateRow) => (
                                                        <tr key={row.id} className="hover:bg-gray-50/50">
                                                            <td className="py-3 pl-2 font-medium text-gray-700">{row.item}</td>
                                                            <td className="py-3 text-right text-gray-500 pr-4">{row.amount} {row.unit}</td>
                                                            <td className="py-3 text-center text-gray-900 px-2 font-bold">{row.coats}</td>
                                                            <td className="py-3 text-right font-black text-gray-900 pr-4">${calculateRowTotal(row, rates || [], safeSettings, tierSelections, pricingMethod, paintColors || [], materials || []).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="space-y-4">
                                                {area.rows.map((row: EstimateRow) => {
                                                    const rowPrice = calculateRowTotal(row, rates || [], safeSettings, tierSelections, pricingMethod, paintColors || [], materials || []);
                                                    const paintRow = paintColors?.find((p: PaintColorEntry) => p.colorCode === row.colorNum);
                                                    const product = paintRow?.productId ? materials?.find((m: Material) => m.id === paintRow.productId) : null;

                                                    return (
                                                        <div key={row.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                                                            <div className="flex justify-between items-start">
                                                                <div className="font-bold text-gray-900 text-base leading-tight flex-1 mr-2">{row.item}</div>
                                                                <div className="font-black text-gray-900 text-base">${rowPrice.toFixed(2)}</div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-gray-100">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('views.PresentationBuilder.sections.EstimateSection.quantity')}</span>
                                                                    <span className="text-xs font-bold text-gray-700">{row.amount} {row.unit}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('views.PresentationBuilder.sections.EstimateSection.coats')}</span>
                                                                    <span className="text-xs font-bold text-gray-700">{row.coats}</span>
                                                                </div>
                                                                {product && (
                                                                    <div className="flex flex-col flex-1 min-w-[120px]">
                                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('views.PresentationBuilder.sections.EstimateSection.product')}</span>
                                                                        <span className="text-xs font-bold text-gray-700 truncate">{product.name} ({row.colorNum})</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {colorSchedule.length > 0 && (
                        <div className="pt-4">
                            <h3 className="text-lg font-bold text-gray-900 font-heading mb-4 border-b-2 border-primary-600 inline-block pb-1">{t('views.PresentationBuilder.sections.EstimateSection.jobPalette')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {colorSchedule.map((p: any) => (
                                    <div key={p.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-700 shadow-sm shrink-0">
                                            {p.colorCode}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-gray-900 truncate text-sm">{p.colorName || t('views.PresentationBuilder.sections.EstimateSection.unassigned')}</div>
                                            <div className="text-[10px] text-gray-400 font-bold uppercase truncate">{p.productName} • {p.sheenName}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 border-t border-gray-200 p-8 md:p-12 mt-auto">
                    <div className="flex justify-end mb-8">
                        <div className={`${isMobile ? 'w-full' : 'w-1/2'} space-y-3`}>
                            <div className="flex justify-between text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                <span>{t('views.PresentationBuilder.sections.EstimateSection.subtotal')}</span>
                                <span className="text-gray-700">${financials_calcs.subtotal.toFixed(2)}</span>
                            </div>
                            {financials_calcs.discVal > 0 && (
                                <div className="flex justify-between text-green-600 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <span>{t('views.PresentationBuilder.sections.EstimateSection.discount')}</span>
                                    <span>-${financials_calcs.discVal.toFixed(2)}</span>
                                </div>
                            )}
                            {financials_calcs.taxVal > 0 && (
                                <div className="flex justify-between text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <span>{t('views.PresentationBuilder.sections.EstimateSection.tax')}</span>
                                    <span className="text-gray-700">${financials_calcs.taxVal.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end pt-4 border-t border-gray-200">
                                <span className="font-black text-gray-900 text-[10px] uppercase tracking-[0.3em] pb-1">{t('views.PresentationBuilder.sections.EstimateSection.grandTotal')}</span>
                                <span className="font-black text-primary-600 text-4xl tracking-tighter">${financials_calcs.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
