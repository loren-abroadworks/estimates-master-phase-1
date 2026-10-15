
import React, { useState, useMemo } from 'react';
import { SearchInput, Modal } from '../UI';
import { Material } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface SheenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  onSelect: (material: Material) => void;
}

export const SheenSelectorModal = ({ isOpen, onClose, materials, onSelect }: SheenSelectorModalProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  
  const paintProducts = useMemo(() => materials.filter(m => ['Paint', 'Primer', 'Stain'].includes(m.category)), [materials]);

  const filteredPaintProducts = useMemo(() => {
    let filtered = paintProducts.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (p.sheen && p.sheen.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    // Sort by Sheen first, then Product Name for easier selection
    filtered.sort((a, b) => {
        const sheenA = a.sheen || '';
        const sheenB = b.sheen || '';
        const sheenCompare = sheenA.localeCompare(sheenB);
        if (sheenCompare !== 0) return sheenCompare;
        return a.name.localeCompare(b.name);
    });
    
    return filtered;
  }, [paintProducts, searchTerm]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.SheenSelectorModal.selectSheen')}>
      <div className="space-y-5">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('modals.SheenSelectorModal.searchPlaceholder')} className="md:max-w-full" />
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pt-2">
          {filteredPaintProducts.map(p => (
            <button 
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-between items-center group bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                {/* Main Title: Sheen */}
                <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                    {p.sheen || t('modals.SheenSelectorModal.standardFinish')}
                </span>
                {/* Subtitle: Brand • Category */}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{p.brand}</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-gray-500 dark:text-gray-400">{p.category}</span>
                </div>
              </div>
              
              {/* Right Side: Price per Gallon */}
              <div className="text-right">
                 <div className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
                    ${p.containers[0]?.price.toFixed(2)}
                 </div>
                 <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">{t('modals.SheenSelectorModal.perGallon')}</div>
              </div>
            </button>
          ))}
          {filteredPaintProducts.length === 0 && <div className="text-center py-12 text-gray-400 dark:text-gray-500 font-medium">{t('modals.SheenSelectorModal.noProductsFound')}</div>}
        </div>
      </div>
    </Modal>
  );
};
