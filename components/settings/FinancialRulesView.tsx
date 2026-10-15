import React from 'react';
import { Card, InputGroup, NumberInput } from '../UI';
import { GlobalSettings, FinancialModelSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

interface FinancialRulesViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

export const FinancialRulesView = ({ settings, setSettings }: FinancialRulesViewProps) => {
  const { t } = useTranslation();
  const model = settings.financialModel || DEFAULT_SETTINGS.financialModel;

  const updateModel = (field: keyof FinancialModelSettings, value: number) => {
    setSettings({
      ...settings,
      financialModel: {
        ...model,
        [field]: value
      }
    });
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-8 md:mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight font-heading">{t('settings.FinancialRulesView.financialRules')}</h2>
        <p className="text-gray-500 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.FinancialRulesView.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Profit Targets Card */}
        <Card className="p-6 md:p-10 shadow-lg border-0 h-full">
           <div className="border-b border-gray-100 pb-4 md:pb-6 mb-6">
             <h3 className="text-xl md:text-2xl font-bold text-gray-900 font-heading flex items-center gap-3">
               {t('settings.FinancialRulesView.profitGoals')}
             </h3>
             <p className="text-gray-500 mt-1 text-sm">{t('settings.FinancialRulesView.profitGoalsDesc')}</p>
           </div>
           
           <div className="space-y-6">
             <InputGroup label={t('settings.FinancialRulesView.targetProfitMargin')}>
                <div className="relative">
                  <NumberInput
                    value={model.profitMargin}
                    onChange={(v) => updateModel('profitMargin', v)}
                    step={0.5}
                    className="pr-12 font-bold text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                   <span className="font-bold">{t('settings.FinancialRulesView.note')}</span>
                   <span>{t('settings.FinancialRulesView.profitMarginNote')}</span>
                </div>
             </InputGroup>
           </div>
        </Card>

        {/* Expense Allocation Card */}
        <Card className="p-6 md:p-10 shadow-lg border-0 h-full">
           <div className="border-b border-gray-100 pb-4 md:pb-6 mb-6">
             <h3 className="text-xl md:text-2xl font-bold text-gray-900 font-heading flex items-center gap-3">
               {t('settings.FinancialRulesView.expenseBenchmarks')}
             </h3>
             <p className="text-gray-500 mt-1 text-sm">{t('settings.FinancialRulesView.expenseBenchmarksDesc')}</p>
           </div>

           <div className="space-y-8">
             <InputGroup label={t('settings.FinancialRulesView.materialCostAllocation')}>
                <div className="relative">
                  <NumberInput
                    value={model.materialCost}
                    onChange={(v) => updateModel('materialCost', v)}
                    step={0.5}
                    className="pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                </div>
                <p className="text-sm text-gray-400 mt-1.5">{t('settings.FinancialRulesView.materialCostDesc')}</p>
             </InputGroup>

             <InputGroup label={t('settings.FinancialRulesView.miscExpense')}>
                <div className="relative">
                  <NumberInput
                    value={model.miscExpense}
                    onChange={(v) => updateModel('miscExpense', v)}
                    step={0.1}
                    className="pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                </div>
                <p className="text-sm text-gray-400 mt-1.5">{t('settings.FinancialRulesView.miscExpenseDesc')}</p>
             </InputGroup>
           </div>
        </Card>
      </div>
    </div>
  );
};