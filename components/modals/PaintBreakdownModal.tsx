
import React from 'react';
import { Droplets, ShoppingCart, DollarSign } from 'lucide-react';
import { Modal } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface BreakdownItem {
  areaName: string;
  itemName: string;
  quantity: number;
  unit: string;
  coats: number;
  gallons: number;
}

interface ContainerRecommendation {
    label: string;
    count: number;
    cost: number;
    price: number;
}

interface PaintBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  colorName: string;
  colorCode: string;
  productName: string;
  items: BreakdownItem[];
  totalGallons: number;
  isExterior?: boolean;
  recommendation?: {
      containers: ContainerRecommendation[];
      totalCost: number;
  };
}

export const PaintBreakdownModal = ({ 
  isOpen, 
  onClose, 
  colorName, 
  colorCode, 
  productName, 
  items, 
  totalGallons,
  isExterior = false,
  recommendation
}: PaintBreakdownModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.PaintBreakdownModal.title')}>
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-xs font-bold flex items-center justify-center shadow-sm text-gray-700 dark:text-gray-300">
                        {colorCode}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{colorName || t('modals.PaintBreakdownModal.unassignedColor')}</h3>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">{productName || t('modals.PaintBreakdownModal.noProductSelected')}</div>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-blue-400 dark:text-blue-500 uppercase tracking-wider">{t('modals.PaintBreakdownModal.totalEst')}</span>
                <span className="text-3xl font-black text-blue-900 dark:text-blue-200 leading-none">{totalGallons.toFixed(2)} <span className="text-base font-bold text-blue-600 dark:text-blue-400">{t('modals.PaintBreakdownModal.gal')}</span></span>
            </div>
        </div>

        {/* Breakdown List */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                    <tr>
                        <th className="px-4 py-3">{t('modals.PaintBreakdownModal.area')}</th>
                        <th className="px-4 py-3">{t('modals.PaintBreakdownModal.surface')}</th>
                        <th className="px-4 py-3 text-center">{isExterior ? t('modals.PaintBreakdownModal.totalQty') : t('modals.PaintBreakdownModal.qty')}</th>
                        {!isExterior && <th className="px-4 py-3 text-center">{t('modals.PaintBreakdownModal.coats')}</th>}
                        <th className="px-4 py-3 text-right">{t('modals.PaintBreakdownModal.gallons')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{item.areaName}</td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.itemName}</td>
                            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                                {item.quantity} <span className="text-xs text-gray-400 dark:text-gray-500">{item.unit}</span>
                            </td>
                            {!isExterior && <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{item.coats}</td>}
                            <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                                {item.gallons.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={isExterior ? 4 : 5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 italic">
                                {t('modals.PaintBreakdownModal.noSurfaces')}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        {/* Recommended Purchase Section */}
        {recommendation && recommendation.containers.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">{t('modals.PaintBreakdownModal.recommendedPurchase')}</h4>
                </div>
                
                <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-3">
                        {recommendation.containers.map((cont, i) => (
                            <div key={i} className="flex items-center bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2 shadow-sm">
                                <div className="font-black text-lg text-green-700 dark:text-green-300 mr-2">{cont.count}x</div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{cont.label}</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">${cont.price.toFixed(2)}{t('modals.PaintBreakdownModal.perEach')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 pl-4 border-l border-green-200 dark:border-green-800">
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">{t('modals.PaintBreakdownModal.estCost')}</div>
                            <div className="text-2xl font-black text-gray-900 dark:text-white">${recommendation.totalCost.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
            {t('modals.PaintBreakdownModal.calculationsNote')}
        </p>
      </div>
    </Modal>
  );
};
