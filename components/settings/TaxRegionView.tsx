
import React, { useState, useMemo } from 'react';
import { Plus, MapPin, Map } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput, Badge } from '../UI';
import { TaxRegion } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface TaxRegionViewProps {
  taxRegions: TaxRegion[];
  onAdd: () => void;
  onEdit: (t: TaxRegion) => void;
  onDelete: (id: string) => void;
}

export const TaxRegionView = ({ taxRegions, onAdd, onEdit, onDelete }: TaxRegionViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRegions = useMemo(() => {
    return taxRegions.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.zipCodes.some(z => z.includes(searchTerm))
    );
  }, [taxRegions, searchTerm]);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.TaxRegionView.taxRegions')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.TaxRegionView.subtitle')}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> 
          <Plus className="w-5 h-5 mr-2" /> {t('settings.TaxRegionView.addRegion')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.TaxRegionView.searchPlaceholder')} className="md:max-w-md w-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        {filteredRegions.map(region => (
          <Card key={region.id} className="p-5 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative group flex flex-col h-full bg-white dark:bg-gray-800">
            <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
              <KebabMenu onEdit={() => onEdit(region)} onDelete={() => onDelete(region.id)} />
            </div>

            <div className="flex flex-col gap-1 mb-6 pr-10">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading leading-tight break-words">{region.name}</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{t('settings.TaxRegionView.zipCodesCount', { count: region.zipCodes.length })}</span>
            </div>

            <div className="flex flex-row gap-0 mb-6 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden divide-x divide-gray-200 dark:divide-gray-700">
                <div className="flex-1 p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 truncate">{t('settings.TaxRegionView.salesTax')}</div>
                    <div className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white truncate">{(region.salesTaxRate * 100).toFixed(3)}%</div>
                </div>
                <div className="flex-1 p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 truncate">{t('settings.TaxRegionView.serviceTax')}</div>
                    <div className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white truncate">{(region.serviceTaxRate * 100).toFixed(3)}%</div>
                </div>
            </div>

            <div className="mt-auto">
                <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Map className="w-3 h-3" /> {t('settings.TaxRegionView.coveredZipCodes')}
                </div>
                <div className="flex flex-wrap gap-1.5 md:gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                    {region.zipCodes.slice(0, 8).map(zip => (
                        <span key={zip} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                            {zip}
                        </span>
                    ))}
                    {region.zipCodes.length > 8 && (
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md text-xs font-bold">
                            +{region.zipCodes.length - 8}
                        </span>
                    )}
                    {region.zipCodes.length === 0 && (
                        <span className="text-gray-400 dark:text-gray-500 text-xs italic">{t('settings.TaxRegionView.noZipCodesDefined')}</span>
                    )}
                </div>
            </div>
          </Card>
        ))}
        
        {filteredRegions.length === 0 && (
           <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                 <Map className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.TaxRegionView.noTaxRegionsFound')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">{t('settings.TaxRegionView.emptyStateHelp')}</p>
           </div>
        )}
      </div>
    </div>
  );
};
