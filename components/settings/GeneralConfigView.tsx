
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, InputGroup, Button, Badge, KebabMenu, Toggle, NumberInput } from '../UI';
import { GlobalSettings } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface GeneralConfigViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onAddConfigItem: (type: 'discount' | 'height' | 'access') => void;
  onEditConfigItem: (type: 'discount' | 'height' | 'access', item: any) => void;
  onDeleteConfigItem: (type: 'discount' | 'height' | 'access', id: string) => void;
  onRestartTour?: () => void;
}

export const GeneralConfigView = ({ 
  settings, 
  setSettings, 
  onAddConfigItem,
  onEditConfigItem,
  onDeleteConfigItem,
  onRestartTour
}: GeneralConfigViewProps) => {
  const { t } = useTranslation();

  return (
  <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
    <div className="mb-8 md:mb-10">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.GeneralConfigView.heading')}</h2>
      <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.GeneralConfigView.subheading')}</p>
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
      {/* Defaults */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 col-span-full lg:col-span-1 shadow-lg border-0 bg-white dark:bg-gray-800">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading border-b border-gray-100 dark:border-gray-700 pb-4 mb-2">
          {t('settings.GeneralConfigView.financialDefaults')}
        </h3>
        <InputGroup label={t('settings.GeneralConfigView.baseLaborRate')}>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg z-10">$</span>
            <NumberInput
              className="pl-10"
              value={settings.defaultLaborRate}
              onChange={(v) => setSettings({...settings, defaultLaborRate: v})}
            />
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium">{t('settings.GeneralConfigView.laborRateHelper')}</p>
        </InputGroup>

        <InputGroup label={t('settings.GeneralConfigView.laborMargin')}>
         <div className="relative">
            <NumberInput
              className="pr-12"
              value={Math.round(settings.laborMargin * 100)}
              onChange={(v) => setSettings({...settings, laborMargin: v / 100})}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold z-10">%</span>
         </div>
         <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium">{t('settings.GeneralConfigView.laborMarginHelper')}</p>
        </InputGroup>

        <InputGroup label={t('settings.GeneralConfigView.operatingExpense')}>
         <div className="relative">
            <NumberInput
              className="pr-12"
              value={Math.round(settings.operatingExpensePercentage)}
              onChange={(v) => setSettings({...settings, operatingExpensePercentage: v})}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold z-10">%</span>
         </div>
         <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium">{t('settings.GeneralConfigView.operatingExpenseHelper')}</p>
        </InputGroup>
      </Card>

      {/* Measurement */}
       <Card className="p-6 md:p-10 space-y-6 md:space-y-8 col-span-full lg:col-span-1 shadow-lg border-0 bg-white dark:bg-gray-800">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading border-b border-gray-100 dark:border-gray-700 pb-4 mb-2">
          {t('settings.GeneralConfigView.measurementWaste')}
        </h3>
         <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.calculateWaste')}</span>
            <Toggle label="" checked={settings.wasteEnabled} onChange={(v) => setSettings({...settings, wasteEnabled: v})} />
         </div>
         {settings.wasteEnabled && (
           <InputGroup label={t('settings.GeneralConfigView.wastePercentage')}>
             <div className="relative">
                <NumberInput
                  className="pr-12"
                  step={1}
                  value={Math.round(settings.wastePercentage * 100)}
                  onChange={(v) => setSettings({...settings, wastePercentage: v / 100})}
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold z-10">%</span>
             </div>
           </InputGroup>
         )}
      </Card>

      {/* Estimate Visibility Defaults */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 col-span-full lg:col-span-1 shadow-lg border-0 bg-white dark:bg-gray-800">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading border-b border-gray-100 dark:border-gray-700 pb-4 mb-2">
          {t('settings.GeneralConfigView.estimateVisibilityDefaults')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('settings.GeneralConfigView.estimateVisibilityHelper')}
        </p>
        
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showAreaLabels')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showAreaLabel ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showAreaLabel: v}})} />
            </div>
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showAreaPrices')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showAreaPrice ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showAreaPrice: v}})} />
            </div>
            
            <div className="h-px bg-gray-100 dark:bg-gray-700 my-2"></div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">{t('settings.GeneralConfigView.lineItemColumns')}</span>

            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showColumnHeaders')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showColLabels ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showColLabels: v}})} />
            </div>
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showQuantities')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showColQuantities ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showColQuantities: v}})} />
            </div>
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showCoats')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showColCoats ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showColCoats: v}})} />
            </div>
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showPrices')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showColPrices ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showColPrices: v}})} />
            </div>
            <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('settings.GeneralConfigView.showProducts')}</span>
                <Toggle label="" checked={settings.estimateDefaults?.showColProducts ?? true} onChange={(v) => setSettings({...settings, estimateDefaults: {...settings.estimateDefaults, showColProducts: v}})} />
            </div>
        </div>
      </Card>
      
      {/* Project Discounts */}
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 col-span-full lg:col-span-1 shadow-lg border-0 bg-white dark:bg-gray-800">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-gray-700 pb-4 md:pb-6 gap-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GeneralConfigView.projectDiscounts')}</h3>
            <Button size="sm" variant="secondary" onClick={() => onAddConfigItem('discount')} className="flex items-center w-full sm:w-auto justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600">
              <Plus className="w-4 h-4 mr-2" /> {t('settings.GeneralConfigView.addDiscount')}
            </Button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {settings.projectDiscounts.map((disc) => (
             <div 
               key={disc.id} 
               className={`flex items-center justify-between p-5 rounded-2xl border transition-all bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm`}
             >
                <div className="flex items-center gap-4">
                   <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">{disc.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {disc.type === 'flat'
                          ? t('settings.GeneralConfigView.discountFlat', { value: `$${disc.value.toFixed(2)}` })
                          : t('settings.GeneralConfigView.discountPercent', { value: `${(disc.value * 100).toFixed(2)}` })}
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
      <Card className="p-6 md:p-10 space-y-6 md:space-y-8 col-span-full shadow-lg border-0 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4 md:pb-6">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GeneralConfigView.difficultyTiers')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
             <div>
                <div className="flex justify-between items-center mb-4">
                   <h4 className="font-bold text-gray-700 dark:text-gray-300 text-lg">{t('settings.GeneralConfigView.heightTiers')}</h4>
                   <Button size="sm" variant="ghost" onClick={() => onAddConfigItem('height')} className="flex items-center text-primary-600 dark:text-primary-400">{t('settings.GeneralConfigView.addTier')}</Button>
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
                   <h4 className="font-bold text-gray-700 dark:text-gray-300 text-lg">{t('settings.GeneralConfigView.accessTiers')}</h4>
                   <Button size="sm" variant="ghost" onClick={() => onAddConfigItem('access')} className="flex items-center text-primary-600 dark:text-primary-400">{t('settings.GeneralConfigView.addTier')}</Button>
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
