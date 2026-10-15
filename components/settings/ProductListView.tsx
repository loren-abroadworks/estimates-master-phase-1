
import React, { useState, useMemo } from 'react';
import { Plus, Star } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput, Select } from '../UI';
import { Material } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface ProductListViewProps {
  title: string;
  subtitle: string;
  materials: Material[];
  filterFn: (m: Material) => boolean;
  onAdd: () => void;
  onEdit: (m: Material) => void;
  onDelete: (id: string) => void;
  onToggleDefault: (m: Material) => void;
  showBrandCode?: boolean;
}

export const ProductListView = ({ title, subtitle, materials, filterFn, onAdd, onEdit, onDelete, onToggleDefault, showBrandCode = true }: ProductListViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'favorites' | 'recently-used'>('name');

  const filteredMaterials = useMemo(() => {
    let filtered = materials.filter(filterFn).filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (m.brand && m.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.code && m.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'price') {
      filtered.sort((a, b) => (a.containers[0]?.price || 0) - (b.containers[0]?.price || 0));
    } else if (sortBy === 'favorites') {
      filtered = filtered.filter(m => m.isDefault).sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recently-used') {
      filtered.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    }
    return filtered;
  }, [materials, filterFn, searchTerm, sortBy]);

  return (
   <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{title}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{subtitle}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> <Plus className="w-5 h-5 mr-2" /> {t('settings.ProductListView.addItem')} </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.ProductListView.searchPlaceholder')} className="md:max-w-md w-full" />
          <div className="w-full md:w-48 relative">
            <Select
                value={sortBy}
                onChange={(v) => setSortBy(v as 'name' | 'price' | 'favorites' | 'recently-used')}
                options={[
                { label: t('settings.ProductListView.sortByName'), value: 'name' },
                { label: t('settings.ProductListView.sortByPrice'), value: 'price' },
                { label: t('settings.ProductListView.favorites'), value: 'favorites' },
                { label: t('settings.ProductListView.recentlyUsed'), value: 'recently-used' }
                ]}
                className="px-5 py-3.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-lg font-medium focus:ring-4 focus:ring-primary-400/20 focus:border-primary-400 outline-none appearance-none transition-all cursor-pointer shadow-sm w-full"
            />
          </div>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
         {filteredMaterials.map((mat) => (
            <Card key={mat.id} className="flex flex-col p-5 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative h-full group bg-white dark:bg-gray-800">
               
               <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1 min-w-0">
                     {showBrandCode && mat.brand && (
                        <div className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 truncate">
                           {mat.brand}
                        </div>
                     )}
                     <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight font-heading break-words">{mat.name}</h3>
                     {mat.code && (
                        <div className="inline-block mt-1 px-2 py-0.5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded text-[10px] font-bold text-gray-400 dark:text-gray-500">
                           #{mat.code}
                        </div>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0 -mr-2">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onToggleDefault(mat); }}
                        className={`p-2 rounded-xl transition-all ${mat.isDefault ? 'text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        title={mat.isDefault ? t('settings.ProductListView.removeFromDefault') : t('settings.ProductListView.addToDefault')}
                     >
                        <Star className={`w-5 h-5 ${mat.isDefault ? 'fill-current' : ''}`} />
                     </button>
                     <KebabMenu onEdit={() => onEdit(mat)} onDelete={() => onDelete(mat.id)} />
                  </div>
               </div>
               
               <div className="mt-auto space-y-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                     {mat.sheen && (
                         <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-800">
                            {mat.sheen}
                         </span>
                     )}
                     {mat.coveragePerGallon > 0 && (
                         <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold border border-green-100 dark:border-green-800">
                            {t('settings.ProductListView.coveragePerGallon', { n: mat.coveragePerGallon })}
                         </span>
                     )}
                     {!mat.sheen && !(mat.coveragePerGallon > 0) && (
                         <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold border border-gray-100 dark:border-gray-600">
                            {mat.category}
                         </span>
                     )}
                  </div>
               </div>
            </Card>
         ))}
         {filteredMaterials.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 dark:text-gray-500">{t('settings.ProductListView.noItemsFound')}</div>
         )}
      </div>
   </div>
  );
};
