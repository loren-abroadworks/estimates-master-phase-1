
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, Button, KebabMenu } from '../UI';
import { GlobalSettings } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface DiscountsViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onAddConfigItem: (type: 'discount') => void;
  onEditConfigItem: (type: 'discount', item: any) => void;
  onDeleteConfigItem: (type: 'discount', id: string) => void;
}

export const DiscountsView = ({
  settings,
  onAddConfigItem,
  onEditConfigItem,
  onDeleteConfigItem
}: DiscountsViewProps) => {
  const { t } = useTranslation();

  return (
  <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
    <div className="mb-8 md:mb-10">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.DiscountsView.projectDiscounts')}</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.DiscountsView.subtitle')}</p>
    </div>
    
    <div className="grid grid-cols-1 gap-8 md:gap-10">
      {/* Project Discounts */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 shadow-lg border-0 bg-white dark:bg-gray-800">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-gray-700 pb-4 md:pb-6 gap-4">
            <h3 className="font-bold text-gray-800 dark:text-white text-xl md:text-2xl font-heading">{t('settings.DiscountsView.discountList')}</h3>
            <Button size="sm" variant="secondary" onClick={() => onAddConfigItem('discount')} className="flex items-center w-full sm:w-auto justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600">
              <Plus className="w-4 h-4 mr-2" /> {t('settings.DiscountsView.addDiscount')}
            </Button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {settings.projectDiscounts.map((disc) => (
             <div 
               key={disc.id} 
               className={`flex items-center justify-between p-5 rounded-2xl border transition-all bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm`}
             >
                <div className="flex items-center gap-4">
                   <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">{disc.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {disc.type === 'flat' ? t('settings.DiscountsView.flatValue', { value: disc.value.toFixed(2) }) : t('settings.DiscountsView.percentOff', { value: (disc.value * 100).toFixed(2) })}
                      </p>
                   </div>
                </div>
                <KebabMenu 
                   onEdit={() => onEditConfigItem('discount', disc)}
                   onDelete={() => onDeleteConfigItem('discount', disc.id)}
                />
             </div>
           ))}
           {settings.projectDiscounts.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 dark:text-gray-500 italic">{t('settings.DiscountsView.noDiscounts')}</div>
           )}
         </div>
      </Card>
    </div>
  </div>
  );
};
