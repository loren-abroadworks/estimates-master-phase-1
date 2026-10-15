
import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput, Select } from '../UI';
import { GlobalSettings, ProductionRate, ConfiguredScope } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface ProductionRateViewProps {
  rates: ProductionRate[];
  scopes: ConfiguredScope[];
  settings: GlobalSettings;
  onAdd: (category?: string) => void;
  onEdit: (r: ProductionRate) => void;
  onDelete: (id: string) => void;
  onAddCategory: () => void;
  onEditCategory: (catName: string) => void;
  onDeleteCategory: (cat: string) => void;
}

export const ProductionRateView = ({ 
  rates, 
  scopes, 
  settings, 
  onAdd, 
  onEdit, 
  onDelete,
  onAddCategory,
  onEditCategory,
  onDeleteCategory
}: ProductionRateViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'unit' | 'category'>('name');


  const ratesByCategory = useMemo(() => {
    const groups: {[key: string]: ProductionRate[]} = {};
    settings.productionRateCategories.forEach(cat => {
      groups[cat.name] = [];
    });
    
    let filteredRates = rates.filter(r => 
       r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       (r.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortBy === 'name') {
      filteredRates.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'unit') {
      filteredRates.sort((a, b) => a.unit.localeCompare(b.unit));
    } else if (sortBy === 'category') {
      filteredRates.sort((a, b) => a.category.localeCompare(b.category));
    }

    filteredRates.forEach((rate: ProductionRate) => {
      const cat = rate.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(rate);
    });
    return groups;
  }, [rates, settings.productionRateCategories, searchTerm, sortBy]);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.ProductionRateView.surfaceRates')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.ProductionRateView.subtitle')}</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
           <Button onClick={onAddCategory} variant="secondary" className="flex items-center flex-1 md:flex-none justify-center bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"> <Plus className="w-5 h-5 mr-2" /> {t('settings.ProductionRateView.addGroup')} </Button>
           <Button onClick={() => onAdd()} className="shadow-lg shadow-primary-500/20 flex items-center flex-1 md:flex-none justify-center"> <Plus className="w-5 h-5 mr-2" /> {t('settings.ProductionRateView.addSurfaceRate')} </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.ProductionRateView.searchPlaceholder')} className="md:max-w-md w-full" />
        <div className="w-full md:w-48 relative">
            <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as 'name' | 'unit' | 'category')}
            options={[
                { label: t('settings.ProductionRateView.sortByName'), value: 'name' },
                { label: t('settings.ProductionRateView.sortByUnit'), value: 'unit' },
                { label: t('settings.ProductionRateView.sortByCategory'), value: 'category' }
            ]}
            className="px-5 py-3.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-lg font-medium focus:ring-4 focus:ring-primary-400/20 focus:border-primary-400 outline-none appearance-none transition-all cursor-pointer shadow-sm w-full"
            />
        </div>
      </div>

      <div className="space-y-10">
        {Object.entries(ratesByCategory).map(([category, items]: [string, ProductionRate[]]) => {
           const categoryObj = settings.productionRateCategories.find(c => c.name === category);

           if (searchTerm && items.length === 0) return null;

           return (
           <Card key={category} className="border-0 shadow-lg overflow-hidden bg-white dark:bg-gray-800">
              <div className="px-6 md:px-8 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                 <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{category}</h3>
                    {categoryObj && categoryObj.scopeIds.length > 0 && (
                      <div className="flex gap-2 mt-1">
                        {categoryObj.scopeIds.map(sid => {
                          const scope = scopes.find(s => s.id === sid);
                          return scope ? <span key={sid} className="text-xs text-gray-500 dark:text-gray-400 font-medium">{scope.name}</span> : null;
                        })}
                      </div>
                    )}
                 </div>
                 <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onAdd(category)}
                      className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 shadow-sm text-xs text-gray-700 dark:text-gray-200"
                    >
                      <Plus className="w-3 h-3 mr-1" /> {t('settings.ProductionRateView.addItem')}
                    </Button>
                    <KebabMenu
                      items={[
                        { label: t('settings.ProductionRateView.editGroup'), icon: Edit2, onClick: () => onEditCategory(category) },
                        { label: t('settings.ProductionRateView.deleteGroup'), icon: Trash2, onClick: () => onDeleteCategory(category), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' }
                      ]}
                    />
                 </div>
              </div>
              
              {/* Desktop Table - Hidden on Tablet (lg:block instead of md:block) */}
              <div className="hidden lg:block overflow-x-auto">
                 <table className="w-full min-w-[800px]">
                    <thead>
                       <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                          <th className="px-8 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">{t('settings.ProductionRateView.colItemName')}</th>
                          <th className="px-8 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.ProductionRateView.colUnit')}</th>
                          <th className="px-8 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.ProductionRateView.colBaseRate')}</th>
                          <th className="px-8 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.ProductionRateView.colActions')}</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                       {(items as ProductionRate[]).map((rate) => (
                          <tr key={rate.id} onClick={() => onEdit(rate)} className="hover:bg-primary-50/10 dark:hover:bg-primary-900/10 transition-colors group cursor-pointer">
                             <td className="px-8 py-5">
                                <span className="text-lg font-bold text-gray-900 dark:text-white">{rate.name}</span>
                             </td>
                             <td className="px-8 py-5">
                                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">{rate.unit}</span>
                             </td>
                             <td className="px-8 py-5">
                                <div className="text-lg font-medium text-gray-900 dark:text-white">{rate.baseRate} <span className="text-gray-400 dark:text-gray-500 text-base">{t('settings.ProductionRateView.perHour')}</span></div>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <div onClick={e => e.stopPropagation()} className="flex justify-end">
                                    <KebabMenu
                                        items={[
                                            { label: t('settings.ProductionRateView.edit'), icon: Edit2, onClick: () => onEdit(rate) },
                                            { label: t('settings.ProductionRateView.delete'), icon: Trash2, onClick: () => onDelete(rate.id), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' }
                                        ]}
                                    />
                                </div>
                             </td>
                          </tr>
                       ))}
                       {items.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-8 py-8 text-center text-gray-400 dark:text-gray-500 italic">{t('settings.ProductionRateView.emptyGroup')}</td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>

              {/* Mobile/Tablet Card Layout - Visible on Tablet (lg:hidden instead of md:hidden) */}
              <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700">
                 {(items as ProductionRate[]).map((rate) => (
                    <div key={rate.id} onClick={() => onEdit(rate)} className="p-5 flex flex-col gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{rate.name}</h4>
                                <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-bold border border-gray-200 dark:border-gray-600">{rate.unit}</span>
                            </div>
                            <div onClick={e => e.stopPropagation()}>
                                <KebabMenu
                                    items={[
                                        { label: t('settings.ProductionRateView.edit'), icon: Edit2, onClick: () => onEdit(rate) },
                                        { label: t('settings.ProductionRateView.delete'), icon: Trash2, onClick: () => onDelete(rate.id), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' }
                                    ]}
                                />
                            </div>
                        </div>
                        <div className="mt-2">
                            <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('settings.ProductionRateView.baseRate')}</div>
                            <div className="text-base font-bold text-gray-900 dark:text-white">{rate.baseRate} <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">{t('settings.ProductionRateView.perHour')}</span></div>
                        </div>
                    </div>
                 ))}
                 {items.length === 0 && (
                    <div className="p-8 text-center text-gray-400 dark:text-gray-500 italic">{t('settings.ProductionRateView.emptyGroup')}</div>
                 )}
              </div>
           </Card>
        )})}
        {searchTerm && Object.values(ratesByCategory).every((items: ProductionRate[]) => items.length === 0) && (
             <div className="text-center py-12 text-gray-400 dark:text-gray-500">{t('settings.ProductionRateView.noSearchResults', { searchTerm })}</div>
        )}
      </div>
    </div>
  );
};
