
import React, { useState } from 'react';
import { Card, InputGroup, NumberInput, Button, Modal, TextInput, Toggle } from '../UI';
import { GlobalSettings, FinancialModelSettings, CustomBurden } from '../../types';
import { Info, Plus, Trash2, Users, Calculator } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

interface LaborConfigViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

export const LaborConfigView = ({ settings, setSettings }: LaborConfigViewProps) => {
  const { t } = useTranslation();
  const model = settings.financialModel || DEFAULT_SETTINGS.financialModel;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBurden, setNewBurden] = useState<Partial<CustomBurden>>({ name: '', rate: 0 });

  const updateModel = (field: keyof FinancialModelSettings, value: any) => {
    setSettings({
      ...settings,
      financialModel: { ...model, [field]: value }
    });
  };

  const handleAddBurden = () => {
    if (!newBurden.name) return;
    const newItem: CustomBurden = {
        id: `burden-${Date.now()}`,
        name: newBurden.name,
        rate: newBurden.rate || 0
    };
    updateModel('customBurdens', [...(model.customBurdens || []), newItem]);
    setIsModalOpen(false);
    setNewBurden({ name: '', rate: 0 });
  };

  const handleDeleteBurden = (id: string) => {
    updateModel('customBurdens', (model.customBurdens || []).filter(b => b.id !== id));
  };

  // Calculate Total Burden
  const standardBurdenTotal = 
    model.taxSocialSecurity + 
    model.taxFUTA + 
    model.taxSUTA + 
    model.taxLiability + 
    model.taxWorkmansComp + 
    model.benefits;
  
  const customBurdenTotal = (model.customBurdens || []).reduce((acc, curr) => acc + curr.rate, 0);
  const totalBurdenPercent = standardBurdenTotal + customBurdenTotal;
  
  const fullyBurdenedRate = model.avgHourlyPay * (1 + totalBurdenPercent / 100);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-8 md:mb-10 flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading flex items-center gap-3">
                {t('settings.LaborConfigView.heading')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.LaborConfigView.subheading')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        {/* Left Column: Inputs */}
        <div className="space-y-8">
            <Card className="p-6 md:p-8 border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.LaborConfigView.baseWages')}</h3>
                </div>
                <InputGroup label={t('settings.LaborConfigView.avgHourlyPayLabel')} className="mb-2">
                    <NumberInput
                        value={model.avgHourlyPay}
                        onChange={(v) => updateModel('avgHourlyPay', v)}
                        className="py-3 font-bold text-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{t('settings.LaborConfigView.avgHourlyPayHelper')}</p>
                </InputGroup>
            </Card>

            <Card className="p-6 md:p-8 border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                <div className="flex justify-between items-center mb-6 pb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.LaborConfigView.taxesBenefits')}</h3>
                    <Button size="sm" variant="secondary" onClick={() => setIsModalOpen(true)} className="flex items-center bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                        <Plus className="w-3 h-3 mr-1" /> {t('settings.LaborConfigView.addCustom')}
                    </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <InputGroup label={t('settings.LaborConfigView.socialSecurity')}><NumberInput value={model.taxSocialSecurity} onChange={(v) => updateModel('taxSocialSecurity', v)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" /></InputGroup>
                    <InputGroup label={t('settings.LaborConfigView.medicareFuta')}><NumberInput value={model.taxFUTA} onChange={(v) => updateModel('taxFUTA', v)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" /></InputGroup>
                    <InputGroup label={t('settings.LaborConfigView.stateUnemp')}><NumberInput value={model.taxSUTA} onChange={(v) => updateModel('taxSUTA', v)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" /></InputGroup>
                    <InputGroup label={t('settings.LaborConfigView.workmansComp')}><NumberInput value={model.taxWorkmansComp} onChange={(v) => updateModel('taxWorkmansComp', v)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" /></InputGroup>
                    <InputGroup label={t('settings.LaborConfigView.otherLiability')}><NumberInput value={model.taxLiability} onChange={(v) => updateModel('taxLiability', v)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" /></InputGroup>
                    <InputGroup label={t('settings.LaborConfigView.benefits')}><NumberInput value={model.benefits} onChange={(v) => updateModel('benefits', v)} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" /></InputGroup>
                </div>

                {model.customBurdens.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        {model.customBurdens.map((item) => (
                            <div key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 pl-2">{item.name}</span>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-gray-900 dark:text-white">{item.rate.toFixed(2)}%</span>
                                    <button onClick={() => handleDeleteBurden(item.id)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>

        {/* Right Column: Summary Visuals */}
        <div className="flex flex-col justify-center items-center space-y-8 lg:sticky lg:top-8 h-fit">
            <div className="text-center w-full">
                <div className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{t('settings.LaborConfigView.totalBurdenRate')}</div>
                <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{totalBurdenPercent.toFixed(2)}%</div>
            </div>
            
            <div className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-3xl p-8 relative shadow-xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold px-4 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 uppercase tracking-widest">
                    {t('settings.LaborConfigView.trueCostPerHour')}
                </div>
                <div className="flex justify-between items-end border-b border-dashed border-gray-200 dark:border-gray-700 pb-4 mb-4">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{t('settings.LaborConfigView.baseRate')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xl">${model.avgHourlyPay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-dashed border-gray-200 dark:border-gray-700 pb-4 mb-4">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{t('settings.LaborConfigView.burden', { percent: totalBurdenPercent.toFixed(1) })}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xl">+${(model.avgHourlyPay * (totalBurdenPercent/100)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                    <span className="text-gray-900 dark:text-white font-bold text-lg">{t('settings.LaborConfigView.totalCost')}</span>
                    <span className="font-black text-primary-600 dark:text-primary-400 text-4xl">${fullyBurdenedRate.toFixed(2)}</span>
                </div>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs leading-relaxed">
                {t('settings.LaborConfigView.costPerHourNote')}
            </p>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('settings.LaborConfigView.addBurdenItemTitle')}>
          <div className="space-y-6">
              <TextInput label={t('settings.LaborConfigView.itemName')} placeholder={t('settings.LaborConfigView.itemNamePlaceholder')} value={newBurden.name || ''} onChange={(v) => setNewBurden({...newBurden, name: v})} />
              <NumberInput label={t('settings.LaborConfigView.percentage')} value={newBurden.rate} onChange={(v) => setNewBurden({...newBurden, rate: v})} placeholder="0" />
              <Button className="w-full mt-4" onClick={handleAddBurden}>{t('settings.LaborConfigView.addBurden')}</Button>
          </div>
      </Modal>
    </div>
  );
};
