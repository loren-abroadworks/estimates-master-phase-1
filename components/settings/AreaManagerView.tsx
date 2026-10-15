
import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput, Select } from '../UI';
import { GlobalSettings, ProductionRate, AreaTemplate } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface AreaManagerViewProps {
  settings: GlobalSettings;
  rates: ProductionRate[];
  onAdd: () => void;
  onEdit: (a: AreaTemplate) => void;
  onDelete: (id: string) => void;
}

export const AreaManagerView = ({ settings, rates, onAdd, onEdit, onDelete }: AreaManagerViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'estimateType'>('name');

  const filteredAreas = useMemo(() => {
    let filtered = settings.areaTemplates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'estimateType') {
      filtered.sort((a, b) => {
        const scopeA = settings.scopes.find(s => s.id === a.scopeId)?.name || '';
        const scopeB = settings.scopes.find(s => s.id === b.scopeId)?.name || '';
        return scopeA.localeCompare(scopeB);
      });
    }
    return filtered;
  }, [settings.areaTemplates, settings.scopes, searchTerm, sortBy]);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.AreaManagerView.areaTemplates')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.AreaManagerView.subtitle')}</p>
          </div>
          <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> <Plus className="w-5 h-5 mr-2" /> {t('settings.AreaManagerView.addTemplate')} </Button>
       </div>
       
       <div className="flex flex-col md:flex-row gap-4 mb-8">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.AreaManagerView.searchPlaceholder')} className="md:max-w-md w-full" />
          <div className="w-full md:w-48 relative">
            <Select
                value={sortBy}
                onChange={(v) => setSortBy(v as 'name' | 'estimateType')}
                options={[
                { label: t('settings.AreaManagerView.sortByName'), value: 'name' },
                { label: t('settings.AreaManagerView.sortByEstimateType'), value: 'estimateType' }
                ]}
                className="px-5 py-3.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl text-lg font-medium focus:ring-4 focus:ring-primary-400/20 focus:border-primary-400 outline-none appearance-none transition-all cursor-pointer shadow-sm w-full"
            />
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredAreas.map((area) => (
             <Card key={area.id} className="p-6 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white dark:bg-gray-800">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-heading">{area.name}</h3>
                      <span className="text-sm text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{settings.scopes.find((s) => s.id === area.scopeId)?.name || t('settings.AreaManagerView.general')}</span>
                   </div>
                   <KebabMenu onEdit={() => onEdit(area)} onDelete={() => onDelete(area.id)} />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                   {area.defaultRateIds.map((rid: string) => { const rate = rates.find((r) => r.id === rid); return rate ? <span key={rid} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg text-sm font-bold border border-gray-200 dark:border-gray-600">{rate.name}</span> : null; })}
                   {area.defaultRateIds.length === 0 && <span className="text-gray-400 dark:text-gray-500 text-sm italic">{t('settings.AreaManagerView.noDefaultSurfaces')}</span>}
                </div>
             </Card>
          ))}
          {filteredAreas.length === 0 && (
             <div className="col-span-full text-center py-12 text-gray-400 dark:text-gray-500">{t('settings.AreaManagerView.noTemplatesFound')}</div>
          )}
       </div>
    </div>
  );
};
