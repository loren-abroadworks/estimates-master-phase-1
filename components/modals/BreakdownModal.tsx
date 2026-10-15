
import React, { useMemo } from 'react';
import { EstimateRow, ProductionRate, GlobalSettings, EstimateArea } from '../../types';
import { Modal } from '../UI';
import { calculateLabor, calculateExteriorProductionHours } from '../../services/calcEngine';
import { useTranslation } from '@/i18n/LanguageContext';

export const BreakdownModal = ({ 
  isOpen, 
  onClose, 
  data,
  settings,
  estimateAreas,
  rates
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  data: { row: EstimateRow, areaName: string, rate: ProductionRate } | null,
  settings: GlobalSettings,
  estimateAreas?: EstimateArea[],
  rates?: ProductionRate[]
}) => {
  const { t } = useTranslation();

  if (!isOpen || !data) return null;

  // Use snapshot as fallback, but prefer live data if available
  let { row, rate, areaName } = data;

  // 1. Resolve Live Row from estimateAreas
  if (estimateAreas) {
      for (const area of estimateAreas) {
          const foundRow = area.rows.find(r => r.id === row.id);
          if (foundRow) {
              row = foundRow;
              // Update area name just in case it was renamed
              areaName = area.name;
              break;
          }
      }
  }

  // 2. Resolve Live Rate from rates list
  if (rates) {
      const foundRate = rates.find(r => r.id === row.productionRateId);
      if (foundRate) {
          rate = foundRate;
      }
  }

  // Determine if Exterior Mode based on visible columns (similar to EstimateFormView)
  const isExterior = settings.extraColumns.some(c => c.id === 'col-coat1' && c.visible);

  // Dynamic Calculation of Hours (Fixes "Not right at start" issue)
  const calculatedHours = useMemo(() => {
      if (isExterior) {
          return calculateExteriorProductionHours(row, rate, settings);
      } else {
          // Interior
          const { totalLaborHours } = calculateLabor(row.amount, rate, row.coats, 1, 1, 0, 0, false);
          // Add extra hours from custom columns (e.g. Prep, Caulk hours inputs)
          const extraHours = settings.extraColumns.reduce((sum, col) => {
              if (col.type === 'hours') {
                  // Exclude Exterior Coat Quantity columns
                  if (['col-coat1', 'col-coat2', 'col-coat3'].includes(col.id)) return sum;
                  return sum + (Number(row.customValues[col.id]) || 0);
              }
              return sum;
          }, 0);
          return totalLaborHours + extraHours;
      }
  }, [row, rate, settings, isExterior]);

  // Total Quantity Calculation
  const totalQuantity = useMemo(() => {
      if (isExterior) {
          const c1 = Number(row.customValues['col-coat1']) || 0;
          const c2 = Number(row.customValues['col-coat2']) || 0;
          const c3 = Number(row.customValues['col-coat3']) || 0;
          return c1 + c2 + c3;
      }
      return row.amount * row.coats;
  }, [row, isExterior]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={row.item}>
        <div className="space-y-6">
            {/* Context Banner */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                <div className="w-full">
                     <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('modals.BreakdownModal.areaContext')}</div>
                     <div className="font-bold text-gray-900 dark:text-white">{areaName}</div>
                </div>
                <div className="text-right w-full">
                     <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('modals.BreakdownModal.rateCategory')}</div>
                     <div className="font-medium text-gray-700 dark:text-gray-300">{rate.category}</div>
                </div>
            </div>

            {/* Measurements */}
            <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">{t('modals.BreakdownModal.measurements')}</h4>
                <div className="flex justify-between items-end">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">{t('modals.BreakdownModal.totalQuantityCoats', { coats: row.coats })}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-lg">{totalQuantity.toFixed(2)} <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{row.unit}</span></span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {isExterior ? t('modals.BreakdownModal.sumOfAllCoatQuantities') : t('modals.BreakdownModal.baseAmountFormula', { amount: row.amount, unit: row.unit, coats: row.coats })}
                </div>
            </div>

            {/* Production Rate */}
            <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">{t('modals.BreakdownModal.productionRates')}</h4>
                 <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">{t('modals.BreakdownModal.rateName')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-right">{rate.name}</span>
                </div>
                <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">{t('modals.BreakdownModal.firstCoatOutput')}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{rate.baseRate} {rate.unit}/hr</span>
                    </div>
                    {(row.coats > 1 || isExterior) && (
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{t('modals.BreakdownModal.secondCoatOutput')}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{rate.rate2ndCoat || rate.baseRate} {rate.unit}/hr</span>
                        </div>
                    )}
                    {(row.coats > 2 || (isExterior && Number(row.customValues['col-coat3']) > 0)) && (
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{t('modals.BreakdownModal.thirdCoatOutput')}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{rate.rate3rdCoat || rate.rate2ndCoat || rate.baseRate} {rate.unit}/hr</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Paint Labor */}
             <div>
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">{t('modals.BreakdownModal.paintLabor')}</h4>
                
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex justify-between items-center text-blue-900 dark:text-blue-200 shadow-sm">
                    <span className="font-bold text-lg">{t('modals.BreakdownModal.totalPaintLabor')}</span>
                    <span className="font-extrabold text-2xl">{t('modals.BreakdownModal.hoursValue', { hours: calculatedHours.toFixed(2) })}</span>
                </div>
                <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">{t('modals.BreakdownModal.includesPrepMiscHours')}</div>
            </div>
        </div>
    </Modal>
  );
};
