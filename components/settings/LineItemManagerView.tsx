
import React, { useState, useMemo } from 'react';
import { Plus, FileText, TrendingUp } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput } from '../UI';
import { LineItemTemplate, GlobalSettings } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface LineItemManagerViewProps {
  templates: LineItemTemplate[];
  onAdd: () => void;
  onEdit: (t: LineItemTemplate) => void;
  onDelete: (id: string) => void;
  settings?: GlobalSettings;
}

export const LineItemManagerView = ({ templates, onAdd, onEdit, onDelete, settings }: LineItemManagerViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'priced' | 'descriptive'>('all');

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [templates, searchTerm, filterType]);

  const profitMarkup = settings?.financialModel?.miscExpenseProfit || 0;
  const applyProfit = settings?.financialModel?.applyProfitToMisc || false;

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.LineItemManagerView.lineItems')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.LineItemManagerView.subtitle')}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> 
          <Plus className="w-5 h-5 mr-2" /> {t('settings.LineItemManagerView.addTemplate')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.LineItemManagerView.searchPlaceholder')} className="md:max-w-md w-full" />
        <div className="flex p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl w-full md:w-auto">
           <button 
             onClick={() => setFilterType('all')}
             className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${filterType === 'all' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
           >
             {t('settings.LineItemManagerView.filterAll')}
           </button>
           <button
             onClick={() => setFilterType('priced')}
             className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${filterType === 'priced' ? 'bg-gray-100 dark:bg-gray-700 text-primary-700 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
           >
             {t('settings.LineItemManagerView.filterPriced')}
           </button>
           <button
             onClick={() => setFilterType('descriptive')}
             className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${filterType === 'descriptive' ? 'bg-gray-100 dark:bg-gray-700 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
           >
             {t('settings.LineItemManagerView.filterDescriptive')}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="p-6 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative group bg-white dark:bg-gray-800">
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <KebabMenu onEdit={() => onEdit(template)} onDelete={() => onDelete(template.id)} />
            </div>

            {template.type === 'descriptive' ? (
              // Descriptive Layout
              <div>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{template.name}</h3>
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-4">
                  {template.description}
                </div>
              </div>
            ) : (
              // Priced Layout
              <div>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{template.name}</h3>
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 pb-8 border-b border-gray-100 dark:border-gray-700 line-clamp-2">
                  {template.description}
                </p>
                
                {/* Profit Info - If enabled and type is flat */}
                {(applyProfit && template.operationType !== 'percent') && (
                    <div className="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800 dark:text-green-300 text-xs font-bold uppercase tracking-wider">
                            <TrendingUp className="w-4 h-4" /> {t('settings.LineItemManagerView.profitAdded', { profitMarkup })}
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-green-700 dark:text-green-400 font-medium">{t('settings.LineItemManagerView.basePrice', { amount: (template.defaultPrice || 0).toFixed(2) })}</div>
                            <div className="text-xs text-green-700 dark:text-green-400 font-medium">{t('settings.LineItemManagerView.profitAmount', { amount: ((template.defaultPrice || 0) * (profitMarkup / 100)).toFixed(2) })}</div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">{template.operationType === 'percent' ? t('settings.LineItemManagerView.operationPercent') : t('settings.LineItemManagerView.operationUnitPrice')}</span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {template.operationType === 'percent' ? `${template.defaultPrice}%` : `$${template.defaultPrice || 0}`}
                          </span>
                       </div>
                   </div>
                   <div className="text-right sm:text-left">
                      <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-0.5">{t('settings.LineItemManagerView.totalClientPrice')}</div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white leading-none">
                          {template.operationType === 'percent' 
                            ? `${template.defaultPrice}%` 
                            : `$${(applyProfit 
                                ? (template.defaultPrice || 0) * (1 + profitMarkup/100) 
                                : (template.defaultPrice || 0)).toFixed(2)}`}
                      </div>
                   </div>
                </div>
              </div>
            )}
          </Card>
        ))}
        
        {filteredTemplates.length === 0 && (
           <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                 <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.LineItemManagerView.emptyHeading')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">{t('settings.LineItemManagerView.emptySubtext')}</p>
           </div>
        )}
      </div>
    </div>
  );
};
