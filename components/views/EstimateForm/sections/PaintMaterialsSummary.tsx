
import React from 'react';
import { Package, Trash2, Plus, DollarSign } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface PaintMaterialsSummaryProps {
  calculatedPaintMaterials: any[];
  sundries: any[];
  materialsTotal: number;
  handleSundryChange: (id: string, field: 'count' | 'unitPrice', value: number) => void;
  handleMaterialDelete: (id: string) => void;
  setIsSundryModalOpen: (val: boolean) => void;
}

export const PaintMaterialsSummary: React.FC<PaintMaterialsSummaryProps> = ({
  calculatedPaintMaterials,
  sundries,
  materialsTotal,
  handleSundryChange,
  handleMaterialDelete,
  setIsSundryModalOpen
}) => {
  const { t } = useTranslation();
  const paintTotal = calculatedPaintMaterials.reduce((acc, item) => acc + item.total, 0);
  const sundriesTotal = sundries.reduce((acc, item) => acc + item.total, 0);

  return (
    <section id="paint-materials-summary-section" className="border-b border-gray-100 dark:border-gray-700 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center border border-primary-100 dark:border-primary-800">
          <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.PaintMaterialsSummary.paintAndMaterials')}</h3>
      </div>
      
      {/* 1. Paint Products Section */}
      <div className="mb-10">
        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 px-1">{t('views.EstimateForm.sections.PaintMaterialsSummary.paintProductsCalculated')}</h4>
        {calculatedPaintMaterials.length > 0 ? (
          <>
          {/* Desktop View */}
          <div className="hidden lg:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3">{t('views.EstimateForm.sections.PaintMaterialsSummary.product')}</th>
                  <th className="px-6 py-3">{t('views.EstimateForm.sections.PaintMaterialsSummary.brand')}</th>
                  <th className="px-6 py-3">{t('views.EstimateForm.sections.PaintMaterialsSummary.sheen')}</th>
                  <th className="px-6 py-3">{t('views.EstimateForm.sections.PaintMaterialsSummary.color')}</th>
                  <th className="px-6 py-3">{t('views.EstimateForm.sections.PaintMaterialsSummary.container')}</th>
                  <th className="px-6 py-3 text-center">{t('views.EstimateForm.sections.PaintMaterialsSummary.qty')}</th>
                  <th className="px-6 py-3 text-center">{t('views.EstimateForm.sections.PaintMaterialsSummary.unitPrice')}</th>
                  <th className="px-6 py-3 text-right">{t('views.EstimateForm.sections.PaintMaterialsSummary.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {calculatedPaintMaterials.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors bg-blue-50/10 dark:bg-blue-900/10">
                    <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">{item.productName}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{item.brand}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{item.sheen}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{item.colorName}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">#{item.colorCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{item.containerLabel}</td>
                    <td className="px-6 py-3 text-center font-bold text-gray-900 dark:text-white">{item.count}</td>
                    <td className="px-6 py-3 text-center text-gray-600 dark:text-gray-300">${item.unitPrice.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={7} className="px-6 py-3 text-right font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest">{t('views.EstimateForm.sections.PaintMaterialsSummary.totalPaint')}</td>
                  <td className="px-6 py-3 text-right font-black text-gray-900 dark:text-white text-lg">${paintTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          {/* Mobile View */}
          <div className="lg:hidden space-y-4">
            {calculatedPaintMaterials.map(item => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm bg-blue-50/10 dark:bg-blue-900/10">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                       <h5 className="font-bold text-gray-900 dark:text-white text-lg">{item.productName}</h5>
                       <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{item.brand} • {item.sheen}</div>
                    </div>
                    <div className="text-right">
                       <div className="font-bold text-gray-900 dark:text-white text-lg">${item.total.toFixed(2)}</div>
                    </div>
                 </div>
                 
                 <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-gray-500 dark:text-gray-400 font-medium">{t('views.EstimateForm.sections.PaintMaterialsSummary.color')}</span>
                       <span className="text-gray-900 dark:text-white font-bold">{item.colorName} <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(#{item.colorCode})</span></span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-gray-500 dark:text-gray-400 font-medium">{t('views.EstimateForm.sections.PaintMaterialsSummary.container')}</span>
                       <span className="text-gray-900 dark:text-white">{item.containerLabel}</span>
                    </div>
                 </div>

                 <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                       {item.count} x ${item.unitPrice.toFixed(2)}
                    </div>
                 </div>
              </div>
            ))}
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-100 dark:border-blue-800 flex justify-between items-center">
                <span className="font-bold text-blue-800 dark:text-blue-300 uppercase text-xs tracking-widest">{t('views.EstimateForm.sections.PaintMaterialsSummary.totalPaint')}</span>
                <span className="font-black text-blue-900 dark:text-blue-200 text-lg">${paintTotal.toFixed(2)}</span>
            </div>
          </div>
          </>
        ) : (
          <div className="p-6 border border-gray-200 dark:border-gray-700 border-dashed rounded-xl text-center text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/50">
            {t('views.EstimateForm.sections.PaintMaterialsSummary.noPaintProducts')}
          </div>
        )}
      </div>
      
      {/* 2. Sundries Section */}
      <div className="mb-8">
        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 px-1">{t('views.EstimateForm.sections.PaintMaterialsSummary.materialsAndSupplies')}</h4>
        
        {/* Desktop Table */}
        <div className="hidden lg:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3 w-[50%]">{t('views.EstimateForm.sections.PaintMaterialsSummary.itemName')}</th>
                <th className="px-6 py-3 text-center w-32">{t('views.EstimateForm.sections.PaintMaterialsSummary.qty')}</th>
                <th className="px-6 py-3 text-center w-32">{t('views.EstimateForm.sections.PaintMaterialsSummary.unitPrice')}</th>
                <th className="px-6 py-3 text-right w-32">{t('views.EstimateForm.sections.PaintMaterialsSummary.total')}</th>
                <th className="px-6 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sundries.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                  <td className="px-6 py-3 text-center">
                    <input type="number" className="w-20 text-center border border-gray-400 dark:border-gray-500 rounded-lg py-2 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 outline-none transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold" value={item.count || ''} onChange={(e) => handleSundryChange(item.id, 'count', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-gray-400 dark:text-gray-500 text-sm font-bold">$</span>
                      <input type="number" step="0.01" className="w-24 text-center border border-gray-400 dark:border-gray-500 rounded-lg py-2 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 outline-none transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-bold" value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={(e) => handleSundryChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-black text-gray-900 dark:text-white text-base">${item.total.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => handleMaterialDelete(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-right font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest">{t('views.EstimateForm.sections.PaintMaterialsSummary.totalMaterials')}</td>
                <td className="px-6 py-4 text-right font-black text-gray-900 dark:text-white text-lg">${sundriesTotal.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
           {sundries.map(item => (
             <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm relative">
                 <div className="flex justify-between items-start mb-4 pr-8">
                    <h5 className="font-bold text-gray-900 dark:text-white text-base">{item.name}</h5>
                    <button onClick={() => handleMaterialDelete(item.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                       <Trash2 className="w-5 h-5" />
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.EstimateForm.sections.PaintMaterialsSummary.quantity')}</label>
                        <input type="number" className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded-lg outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-gray-800 transition-all font-bold text-base text-center text-gray-900 dark:text-white" value={item.count || ''} onChange={(e) => handleSundryChange(item.id, 'count', parseFloat(e.target.value) || 0)} />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.EstimateForm.sections.PaintMaterialsSummary.unitPrice')}</label>
                        <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-bold">$</span>
                           <input type="number" step="0.01" className="w-full pl-6 pr-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded-lg outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-gray-800 transition-all font-bold text-base text-center text-gray-900 dark:text-white" value={item.unitPrice === 0 ? '' : item.unitPrice} onChange={(e) => handleSundryChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} />
                        </div>
                     </div>
                 </div>
                 
                 <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.EstimateForm.sections.PaintMaterialsSummary.totalCost')}</span>
                    <span className="font-black text-gray-900 dark:text-white text-xl">${item.total.toFixed(2)}</span>
                 </div>
             </div>
           ))}
           
           <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
              <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest">{t('views.EstimateForm.sections.PaintMaterialsSummary.totalMaterials')}</span>
              <span className="font-black text-gray-900 dark:text-white text-lg">${sundriesTotal.toFixed(2)}</span>
           </div>
        </div>

        <div className="mt-4 text-center">
          <button onClick={() => setIsSundryModalOpen(true)} className="text-base font-bold text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-2 w-full py-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
            {t('views.EstimateForm.sections.PaintMaterialsSummary.addMaterialSupply')} <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 3. Combined Total Section - Re-styled to fit in */}
      <div className="flex justify-end mt-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 flex flex-col md:flex-row items-center gap-6 md:gap-12 min-w-[300px] justify-between">
              <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('views.EstimateForm.sections.PaintMaterialsSummary.paintMaterialsCombined')}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{t('views.EstimateForm.sections.PaintMaterialsSummary.includesWaste')}</span>
              </div>
              <div className="font-black text-gray-900 dark:text-white text-3xl tracking-tight">
                  ${materialsTotal.toFixed(2)}
              </div>
          </div>
      </div>
    </section>
  );
};
