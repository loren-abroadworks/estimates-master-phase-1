
import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface LaborSummaryProps {
  grandTotalData: any[];
  grandTotalSum: { app: number; prep: number; total: number; };
}

export const LaborSummary: React.FC<LaborSummaryProps> = ({ grandTotalData, grandTotalSum }) => {
  const { t } = useTranslation();
  return (
    <div id="labor-summary-section" className="mt-10 border-b border-gray-100 dark:border-gray-700 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center border border-primary-100 dark:border-primary-800">
          <Clock className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.LaborSummary.laborSummary')}</h3>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden lg:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.colArea')}</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.colItem')}</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.colQty')}</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.colCoats')}</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.colPaintColor')}</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.colHours')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {grandTotalData.filter(i => !i.isOptional).map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-6 py-3 text-base font-bold text-gray-900 dark:text-white">{item.areaName}</td>
                <td className="px-6 py-3 text-base text-gray-700 dark:text-gray-300">{item.surface}</td>
                <td className="px-6 py-3 text-center text-base text-gray-600 dark:text-gray-400">{item.amount.toFixed(0)} <span className="text-xs text-gray-400 dark:text-gray-500">{item.unit}</span></td>
                <td className="px-6 py-3 text-center text-base text-gray-600 dark:text-gray-400">{item.coats}</td>
                <td className="px-6 py-3 text-base text-gray-600 dark:text-gray-400">
                  {item.colorName !== 'Unassigned' ? (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white">{item.colorName}</span>
                      {item.code && <span className="text-xs text-gray-400 dark:text-gray-500">{item.code}</span>}
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">--</span>
                  )}
                </td>
                <td className="px-6 py-3 text-center font-bold text-gray-900 dark:text-white text-base">{item.totalHours.toFixed(2)}</td>
              </tr>
            ))}
            {grandTotalData.filter(i => !i.isOptional).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 text-base">{t('views.EstimateForm.sections.LaborSummary.noLaborItems')}</td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <tr>
              <td colSpan={5} className="px-6 py-4 text-right font-bold text-gray-600 dark:text-gray-400 text-sm uppercase tracking-wider">{t('views.EstimateForm.sections.LaborSummary.totalHours')}</td>
              <td className="px-6 py-4 text-center font-extrabold text-primary-600 dark:text-primary-400 text-xl">{grandTotalSum.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {grandTotalData.filter(i => !i.isOptional).map((item, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm relative overflow-hidden">
            {/* Header - Area and Item */}
            <div className="flex justify-between items-start mb-3 border-b border-gray-50 dark:border-gray-700 pb-3">
                <div>
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{item.areaName}</div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg">{item.surface}</div>
                </div>
                 <div className="flex flex-col items-end">
                    <span className="font-black text-gray-900 dark:text-white text-xl">{item.totalHours.toFixed(2)} <span className="text-sm text-gray-400 dark:text-gray-500 font-bold">{t('views.EstimateForm.sections.LaborSummary.hrsAbbr')}</span></span>
                 </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                   <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.EstimateForm.sections.LaborSummary.quantity')}</label>
                   <div className="font-medium text-gray-700 dark:text-gray-300">{item.amount.toFixed(0)} <span className="text-xs text-gray-400 dark:text-gray-500 font-bold">{item.unit}</span></div>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.EstimateForm.sections.LaborSummary.colCoats')}</label>
                   <div className="font-medium text-gray-700 dark:text-gray-300">{item.coats}</div>
                </div>
                <div className="col-span-2">
                   <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.EstimateForm.sections.LaborSummary.paintColor')}</label>
                   {item.colorName !== 'Unassigned' ? (
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary-200 dark:bg-primary-800"></div>
                        <span className="font-medium text-gray-900 dark:text-white">{item.colorName}</span>
                        {item.code && <span className="text-xs text-gray-400 dark:text-gray-500 font-bold bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-600">{item.code}</span>}
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">{t('views.EstimateForm.sections.LaborSummary.noColorAssigned')}</span>
                  )}
                </div>
            </div>
          </div>
        ))}
        
        {grandTotalData.filter(i => !i.isOptional).length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                {t('views.EstimateForm.sections.LaborSummary.noLaborItems')}
            </div>
        )}

        {/* Mobile Total Footer */}
         <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex justify-between items-center mt-4">
            <span className="font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-widest">{t('views.EstimateForm.sections.LaborSummary.totalHours')}</span>
            <span className="font-black text-primary-600 dark:text-primary-400 text-xl">{grandTotalSum.total.toFixed(2)}</span>
         </div>
      </div>
    </div>
  );
};
