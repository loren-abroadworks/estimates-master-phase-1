
import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { SearchInput, Modal } from '../UI';
import { ProductionRate, ProductionRateCategory } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: ProductionRate[];
  categories: ProductionRateCategory[];
  onSelect: (rate: ProductionRate) => void;
}

export const AddItemModal = ({ isOpen, onClose, rates, categories, onSelect }: AddItemModalProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const ratesByCategory = useMemo(() => {
    const groups: {[key: string]: ProductionRate[]} = {};
    categories.forEach(cat => { groups[cat.name] = []; });
    rates.forEach(rate => { const cat = rate.category || 'Uncategorized'; if (!groups[cat]) groups[cat] = []; groups[cat].push(rate); });
    return groups;
  }, [rates, categories]);

  const filteredRatesByCategory = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const groups: {[key: string]: ProductionRate[]} = {};
    Object.entries(ratesByCategory).forEach(([cat, catRates]: [string, ProductionRate[]]) => {
      const filtered = catRates.filter(r => 
        r.name.toLowerCase().includes(term) || 
        cat.toLowerCase().includes(term)
      );
      if (filtered.length > 0) {
        groups[cat] = filtered;
      }
    });
    return groups;
  }, [ratesByCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.AddItemModal.title')}>
      <div className="space-y-6">
        <SearchInput 
          value={searchTerm} 
          onChange={setSearchTerm} 
          placeholder={t('modals.AddItemModal.searchPlaceholder')}
          className="mb-4"
        />
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {Object.entries(filteredRatesByCategory).map(([cat, catRates]: [string, ProductionRate[]]) => (
            <div key={cat} className="mb-8 last:mb-0">
              <h4 className="font-extrabold text-gray-900 dark:text-white text-lg mb-4 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(133,216,71,0.5)]" /> 
                {cat}
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {catRates.map(rate => (
                  <button 
                    key={rate.id} 
                    onClick={() => onSelect(rate)} 
                    className="w-full text-left p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all flex justify-between items-center group"
                  >
                    <div className="flex flex-col">
                      <span className="text-gray-900 dark:text-white font-bold text-base group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{rate.name}</span>
                      <span className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 font-medium">{rate.baseRate} {rate.unit}{t('modals.AddItemModal.perHr')}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-400 dark:text-gray-300 text-xs font-extrabold group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 group-hover:border-primary-200 dark:group-hover:border-primary-800 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-all">
                      {t('modals.AddItemModal.addButton')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(filteredRatesByCategory).length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300 dark:text-gray-500" />
              </div>
              <p className="text-gray-400 dark:text-gray-500 font-bold">{t('modals.AddItemModal.noResults')}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
