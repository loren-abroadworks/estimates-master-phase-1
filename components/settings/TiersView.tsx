
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, Button, Badge, KebabMenu } from '../UI';
import { GlobalSettings } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface TiersViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onAddConfigItem: (type: 'height' | 'access') => void;
  onEditConfigItem: (type: 'height' | 'access', item: any) => void;
  onDeleteConfigItem: (type: 'height' | 'access', id: string) => void;
}

export const TiersView = ({ 
  settings, 
  onAddConfigItem,
  onEditConfigItem,
  onDeleteConfigItem
}: TiersViewProps) => {
  const { t } = useTranslation();

  return (
  <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
    <div className="mb-8 md:mb-10">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.TiersView.difficultyMultipliers')}</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.TiersView.configureMultipliersDesc')}</p>
    </div>
    
    <div className="grid grid-cols-1 gap-8 md:gap-10">
      {/* Tiers */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 shadow-lg border-0 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
             <div>
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.TiersView.heightTiers')}</h3>
                   <Button size="sm" variant="ghost" onClick={() => onAddConfigItem('height')} className="flex items-center text-primary-600 dark:text-primary-400">{t('settings.TiersView.addButton')}</Button>
                </div>
                <div className="space-y-3">
                   {settings.heightTiers.map((tier) => (
                      <div key={tier.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-gray-900 dark:text-white">{tier.name}</span>
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
                   <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.TiersView.accessTiers')}</h3>
                   <Button size="sm" variant="ghost" onClick={() => onAddConfigItem('access')} className="flex items-center text-primary-600 dark:text-primary-400">{t('settings.TiersView.addButton')}</Button>
                </div>
                 <div className="space-y-3">
                   {settings.accessTiers.map((tier) => (
                      <div key={tier.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-gray-900 dark:text-white">{tier.name}</span>
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
