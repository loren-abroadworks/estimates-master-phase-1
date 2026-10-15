
import React, { useState, useMemo } from 'react';
import { SearchInput, Modal, Badge } from '../UI';
import { Material } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  onSelect: (material: Material) => void;
}

export const ProductSelectorModal = ({ isOpen, onClose, materials, onSelect }: ProductSelectorModalProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'brand' | 'favorites'>('name');

  const paintProducts = useMemo(() => materials.filter(m => ['Paint', 'Primer', 'Stain'].includes(m.category)), [materials]);

  const filteredPaintProducts = useMemo(() => {
    let base = paintProducts;
    let filtered = base.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    if (sortBy === 'name') { filtered.sort((a, b) => a.name.localeCompare(b.name)); } 
    else if (sortBy === 'brand') { filtered.sort((a, b) => (a.brand || '').localeCompare(b.brand || '')); } 
    else if (sortBy === 'favorites') { filtered = filtered.filter(p => p.isDefault).sort((a, b) => a.name.localeCompare(b.name)); } 
    
    return filtered;
  }, [paintProducts, searchTerm, sortBy]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.ProductSelectorModal.selectProduct')}>
      <div className="space-y-5">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('modals.ProductSelectorModal.searchPlaceholder')} className="md:max-w-full" />
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pt-2">
          {filteredPaintProducts.map(p => (
            <button 
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-between items-center group bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{p.name}</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{p.brand}</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{p.category}</span>
                </div>
              </div>
              {/* Removed Price and Sheen Badge as requested */}
            </button>
          ))}
          {filteredPaintProducts.length === 0 && <div className="text-center py-12 text-gray-400 dark:text-gray-500 font-medium">{t('modals.ProductSelectorModal.noProductsFound')}</div>}
        </div>
      </div>
    </Modal>
  );
};
