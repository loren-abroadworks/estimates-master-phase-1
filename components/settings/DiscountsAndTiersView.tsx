
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, Button, Badge, KebabMenu } from '../UI';
import { GlobalSettings } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface DiscountsAndTiersViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onAddConfigItem: (type: 'discount' | 'height' | 'access') => void;
  onEditConfigItem: (type: 'discount' | 'height' | 'access', item: any) => void;
  onDeleteConfigItem: (type: 'discount' | 'height' | 'access', id: string) => void;
}

export const DiscountsAndTiersView = ({
  settings,
  onAddConfigItem,
  onEditConfigItem,
  onDeleteConfigItem
}: DiscountsAndTiersViewProps) => {
  const { t } = useTranslation();

  return (
  <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
    <div className="mb-8 md:mb-10">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight font-heading">{t('settings.DiscountsAndTiersView.pageTitle')}</h2>
      <p className="text-gray-500 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.DiscountsAndTiersView.pageSubtitle')}</p>
    </div>
    
    <div className="grid grid-cols-1 gap-8 md:gap-10">
      {/* Project Discounts */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 shadow-lg border-0">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 md:pb-6 gap-4">
            <h3 className="font-bold text-gray-800 text-xl md:text-2xl font-heading">{t('settings.DiscountsAndTiersView.projectDiscounts')}</h3>
            <Button size="sm" variant="secondary" onClick={() => onAddConfigItem('discount')} className="flex items-center w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4 mr-2" /> {t('settings.DiscountsAndTiersView.addDiscount')}
            </Button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {settings.projectDiscounts.map((disc) => (
             <div 
               key={disc.id} 
               className={`flex items-center justify-between p-5 rounded-2xl border transition-all bg-white border-gray-200 hover:border-gray-300 shadow-sm`}
             >
                <div className="flex items-center gap-4">
                   <div>
                      <h4 className="font-bold text-gray-900 text-lg">{disc.name}</h4>
                      <p className="text-sm text-gray-500">
                        {disc.type === 'flat' ? t('settings.DiscountsAndTiersView.discountFlat', { value: disc.value.toFixed(2) }) : t('settings.DiscountsAndTiersView.discountPercent', { value: (disc.value * 100).toFixed(2) })}
                      </p>
                   </div>
                </div>
                <KebabMenu 
                   onEdit={() => onEditConfigItem('discount', disc)}
                   onDelete={() => onDeleteConfigItem('discount', disc.id)}
                />
             </div>
           ))}
         </div>
      </Card>
      
      {/* Tiers */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 shadow-lg border-0">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 md:pb-6">
             <h3 className="font-bold text-gray-800 text-xl md:text-2xl font-heading">{t('settings.DiscountsAndTiersView.difficultyMultipliers')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
             <div>
                <div className="flex justify-between items-center mb-4">
                   <h4 className="font-bold text-gray-700 text-lg">{t('settings.DiscountsAndTiersView.heightTiers')}</h4>
                   <Button size="sm" variant="ghost" onClick={() => onAddConfigItem('height')} className="flex items-center">{t('settings.DiscountsAndTiersView.addButton')}</Button>
                </div>
                <div className="space-y-3">
                   {settings.heightTiers.map((tier) => (
                      <div key={tier.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-gray-900">{tier.name}</span>
                           <Badge color="blue">x{tier.multiplier}</Badge>
                         </div>
                         <KebabMenu 
                            onEdit={() => onEditConfigItem('height', tier)}
                            onDelete={() => onDeleteConfigItem('height', tier.id)}
                         />
                      </div>
                   ))}
                </div>
             </div>
             <div>
                <div className="flex justify-between items-center mb-4">
                   <h4 className="font-bold text-gray-700 text-lg">{t('settings.DiscountsAndTiersView.accessTiers')}</h4>
                   <Button size="sm" variant="ghost" onClick={() => onAddConfigItem('access')} className="flex items-center">{t('settings.DiscountsAndTiersView.addButton')}</Button>
                </div>
                 <div className="space-y-3">
                   {settings.accessTiers.map((tier) => (
                      <div key={tier.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-gray-900">{tier.name}</span>
                           <Badge color="amber">x{tier.multiplier}</Badge>
                         </div>
                         <KebabMenu 
                            onEdit={() => onEditConfigItem('access', tier)}
                            onDelete={() => onDeleteConfigItem('access', tier.id)}
                         />
                      </div>
                   ))}
                </div>
             </div>
          </div>
      </Card>
    </div>
  </div>
  );
};
