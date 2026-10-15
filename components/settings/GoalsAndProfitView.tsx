
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowRight, ArrowLeft, Target, PieChart, Users, DollarSign,
  Check, TrendingUp, RefreshCw, Calculator, Activity, ChevronDown,
  ChevronLeft, ChevronRight, Paintbrush, Briefcase, FileText, Clock
} from 'lucide-react';
import { Card, Button, NumberInput, InputGroup, Badge, Toggle } from '../UI';
import { GlobalSettings, FinancialModelSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

interface GoalsAndProfitViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const STEPS = [
  { id: 1, title: 'Income Goals', icon: Target },
  { id: 2, title: 'Expense Allocation', icon: PieChart },
  { id: 3, title: 'Labor Burden', icon: Users },
  { id: 4, title: 'Review & Save', icon: Calculator },
];

export const GoalsAndProfitView = ({ settings, setSettings }: GoalsAndProfitViewProps) => {
  const isSetup = settings.financialModel && settings.financialModel.desiredAnnualIncome > 0;
  const [viewMode, setViewMode] = useState<'dashboard' | 'wizard'>(isSetup ? 'dashboard' : 'wizard');

  if (viewMode === 'dashboard') {
      return <FinancialDashboard settings={settings} onEdit={() => setViewMode('wizard')} />;
  }

  return (
    <ProfitabilityWizard 
        settings={settings} 
        setSettings={setSettings} 
        onComplete={() => setViewMode('dashboard')}
        onCancel={() => setViewMode('dashboard')}
    />
  );
};

// --- DASHBOARD VIEW ---
const FinancialDashboard = ({ settings, onEdit }: { settings: GlobalSettings, onEdit: () => void }) => {
    const { t } = useTranslation();
    const model = settings.financialModel || DEFAULT_SETTINGS.financialModel;

    const targetRevenue = model.profitMargin > 0 ? (model.desiredAnnualIncome / (model.profitMargin / 100)) : 0;
    const misc = (model.includeMiscMaterials !== false) ? model.miscExpense : 0;
    const totalExpensePercent = model.materialCost + model.marketingExpense + misc;
    const availableForLaborPercent = 100 - model.profitMargin - totalExpensePercent;
    
    const burdenPercent = model.taxSocialSecurity + model.taxFUTA + model.taxSUTA + model.taxWorkmansComp + model.taxLiability + model.benefits;
    const fullyBurdenedHourlyCost = model.avgHourlyPay * (1 + burdenPercent / 100);

    const hourlyChargeRate = availableForLaborPercent > 0 
        ? fullyBurdenedHourlyCost / (availableForLaborPercent / 100) 
        : 0;

    // Pipeline Calculations
    const avgJobSize = model.avgJobSize || 3500;
    const closingRate = model.closingRate || 35;
    const leadConversionRate = model.leadConversionRate || 25;

    const jobsNeeded = avgJobSize > 0 ? Math.ceil(targetRevenue / avgJobSize) : 0;
    const estimatesNeeded = closingRate > 0 ? Math.ceil(jobsNeeded / (closingRate / 100)) : 0;
    const leadsNeeded = leadConversionRate > 0 ? Math.ceil(estimatesNeeded / (leadConversionRate / 100)) : 0;

    // Work Hours Calculation
    // Total Labor Budget ($) = Revenue * Labor %
    // Total Hours = Labor Budget / Burdened Cost
    const laborBudget = targetRevenue * (availableForLaborPercent / 100);
    const totalHoursNeeded = fullyBurdenedHourlyCost > 0 ? Math.ceil(laborBudget / fullyBurdenedHourlyCost) : 0;

    return (
        <div className="p-4 md:p-12 max-w-6xl mx-auto animate-in fade-in duration-500 pb-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.financialOverview')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">{t('settings.GoalsAndProfitView.financialOverviewSubtitle')}</p>
                </div>
                <Button onClick={onEdit} variant="secondary" className="shadow-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700">
                    <RefreshCw className="w-4 h-4 mr-2" /> {t('settings.GoalsAndProfitView.recalculateGoals')}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="rounded-3xl p-8 border shadow-sm flex flex-col md:flex-row items-center gap-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Activity className="w-10 h-10" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 font-heading">{t('settings.GoalsAndProfitView.finalOpExChargeRate')}</h3>
                        <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                            ${hourlyChargeRate.toFixed(2)}<span className="text-2xl text-gray-400 dark:text-gray-500 font-bold">/hr</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl p-8 border shadow-sm flex flex-col md:flex-row items-center gap-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                        <Target className="w-10 h-10" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 font-heading">{t('settings.GoalsAndProfitView.targetAnnualRevenue')}</h3>
                        <div className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">${targetRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <Card className="p-6 md:p-8 flex flex-col border-0 shadow-lg relative overflow-hidden group bg-white dark:bg-gray-800">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Target className="w-24 h-24 text-primary-500" /></div>
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4"><DollarSign className="w-6 h-6" /></div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.incomeTargets')}</h4>
                    </div>
                    <div className="space-y-4 mt-auto">
                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.GoalsAndProfitView.netIncomeGoal')}</span>
                            <span className="font-bold text-gray-900 dark:text-white text-lg">${model.desiredAnnualIncome.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.GoalsAndProfitView.targetMargin')}</span>
                            <span className="font-bold text-green-600 dark:text-green-400 text-lg">{model.profitMargin}%</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-8 flex flex-col border-0 shadow-lg relative overflow-hidden group bg-white dark:bg-gray-800">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users className="w-24 h-24 text-blue-500" /></div>
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4"><Users className="w-6 h-6" /></div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.laborBurden')}</h4>
                    </div>
                    <div className="space-y-4 mt-auto">
                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.GoalsAndProfitView.basePayAvg')}</span>
                            <span className="font-bold text-gray-900 dark:text-white text-lg">${model.avgHourlyPay.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-700 pb-2">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.GoalsAndProfitView.taxesAndBenefits')}</span>
                            <span className="font-bold text-gray-900 dark:text-white text-lg">+{burdenPercent.toFixed(1)}%</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 md:p-8 flex flex-col border-0 shadow-lg relative overflow-hidden group bg-white dark:bg-gray-800">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><PieChart className="w-24 h-24 text-amber-500" /></div>
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4"><PieChart className="w-6 h-6" /></div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.revenueDollar')}</h4>
                    </div>
                    <div className="mt-auto">
                        <div className="flex h-4 w-full rounded-full overflow-hidden mb-6">
                            <div style={{ width: `${model.profitMargin}%` }} className="bg-green-500"></div>
                            <div style={{ width: `${totalExpensePercent}%` }} className="bg-blue-400"></div>
                            <div style={{ width: `${availableForLaborPercent}%` }} className="bg-gray-900 dark:bg-gray-700"></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">
                            <div>{t('settings.GoalsAndProfitView.profit')}<div className="text-sm font-black text-green-600 dark:text-green-400">{model.profitMargin}%</div></div>
                            <div>{t('settings.GoalsAndProfitView.expense')}<div className="text-sm font-black text-blue-500 dark:text-blue-400">{totalExpensePercent.toFixed(1)}%</div></div>
                            <div>{t('settings.GoalsAndProfitView.labor')}<div className="text-sm font-black text-gray-900 dark:text-white">{availableForLaborPercent.toFixed(1)}%</div></div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Pipeline Targets Section */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.pipelineTargets')}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.GoalsAndProfitView.pipelineTargetsSubtitle', { amount: model.desiredAnnualIncome.toLocaleString() })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {/* Leads Needed */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between mb-4">
                             <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"><Users className="w-5 h-5" /></div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('settings.GoalsAndProfitView.totalLeads')}</span>
                        </div>
                        <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">{leadsNeeded.toLocaleString()}</div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.basedOnConversion', { rate: leadConversionRate })}
                        </div>
                     </Card>
                     
                     {/* Estimates Needed */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between mb-4">
                             <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"><FileText className="w-5 h-5" /></div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('settings.GoalsAndProfitView.estimates')}</span>
                        </div>
                        <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">{estimatesNeeded.toLocaleString()}</div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.basedOnCloseRate', { rate: closingRate })}
                        </div>
                     </Card>

                     {/* Jobs Needed */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between mb-4">
                             <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"><Briefcase className="w-5 h-5" /></div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('settings.GoalsAndProfitView.jobsSold')}</span>
                        </div>
                        <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">{jobsNeeded.toLocaleString()}</div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.avgJobSize', { size: avgJobSize.toLocaleString() })}
                        </div>
                     </Card>

                     {/* Work Hours Needed */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between mb-4">
                             <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><Clock className="w-5 h-5" /></div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('settings.GoalsAndProfitView.workHours')}</span>
                        </div>
                        <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">{totalHoursNeeded.toLocaleString()}</div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.basedOnPayrollBudget')}
                        </div>
                     </Card>
                </div>
            </div>

            {/* Projected Annual Budget Breakdown */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-10 mt-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.projectedAnnualBudget')}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.GoalsAndProfitView.projectedAnnualBudgetSubtitle', { revenue: targetRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {/* Payroll */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"><Users className="w-5 h-5" /></div>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('settings.GoalsAndProfitView.payrollBudget')}</div>
                        <div className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                            ${(targetRevenue * (availableForLaborPercent / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.percentOfRevenue', { percent: availableForLaborPercent.toFixed(1) })}
                        </div>
                     </Card>
                     
                     {/* Paint & Materials */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"><Paintbrush className="w-5 h-5" /></div>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('settings.GoalsAndProfitView.paintAndMaterials')}</div>
                        <div className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                            ${(targetRevenue * (model.materialCost / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.percentOfRevenue', { percent: model.materialCost.toFixed(1) })}
                        </div>
                     </Card>

                     {/* Misc & Marketing */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"><PieChart className="w-5 h-5" /></div>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('settings.GoalsAndProfitView.miscAndMarketing')}</div>
                        <div className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                            ${(targetRevenue * ((misc + model.marketingExpense) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.percentOfRevenue', { percent: (misc + model.marketingExpense).toFixed(1) })}
                        </div>
                     </Card>

                     {/* Profit */}
                     <Card className="p-6 border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-5 h-5" /></div>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('settings.GoalsAndProfitView.netProfit')}</div>
                        <div className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">
                            ${model.desiredAnnualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            {t('settings.GoalsAndProfitView.percentOfRevenue', { percent: model.profitMargin.toFixed(1) })}
                        </div>
                     </Card>
                </div>
            </div>
        </div>
    );
};

// --- PROFITABILITY WIZARD (Matching Setup Wizard 1:1) ---
const ProfitabilityWizard = ({ settings, setSettings, onComplete, onCancel }: { settings: GlobalSettings, setSettings: (s: GlobalSettings) => void, onComplete: () => void, onCancel: () => void }) => {
    // ... (Wizard component remains unchanged)
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(1);
    const [model, setModel] = useState<FinancialModelSettings>(settings.financialModel || DEFAULT_SETTINGS.financialModel);

    // --- Calculations ---
    const targetRevenue = model.profitMargin > 0 ? (model.desiredAnnualIncome / (model.profitMargin / 100)) : 0;
    const misc = (model.includeMiscMaterials !== false) ? model.miscExpense : 0;
    const totalExpensePercent = model.materialCost + model.marketingExpense + misc;
    const availableForLaborPercent = 100 - model.profitMargin - totalExpensePercent;
    
    const burdenPercent = 
        model.taxSocialSecurity + 
        model.taxFUTA + 
        model.taxSUTA + 
        model.taxWorkmansComp + 
        model.taxLiability + 
        model.benefits; 
        
    const fullyBurdenedHourlyCost = model.avgHourlyPay * (1 + burdenPercent / 100);
    const finalHourlyRate = availableForLaborPercent > 0 ? (fullyBurdenedHourlyCost / (availableForLaborPercent / 100)) : 0;

    const handleUpdate = (field: keyof FinancialModelSettings, value: any) => {
        setModel(prev => ({ ...prev, [field]: value }));
    };

    const applyModel = () => {
        setSettings({
            ...settings,
            financialModel: model,
            defaultLaborRate: parseFloat(finalHourlyRate.toFixed(2)),
            operatingExpensePercentage: (100 - availableForLaborPercent) / 100
        });
        onComplete();
    };

    return (
        <div className="p-4 md:p-12 max-w-5xl mx-auto animate-in fade-in duration-500 pb-32">
            
            {/* Header */}
            <div className="mb-12 text-center">
                <div className="flex items-center justify-between md:justify-center relative mb-4">
                    <button onClick={onCancel} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 text-sm font-bold md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> <span>{t('settings.GoalsAndProfitView.back')}</span>
                    </button>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.GoalsAndProfitView.engineCalibration')}</h2>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex justify-center mb-10 w-full px-4 md:px-0">
                <div className="flex items-center w-full max-w-lg">
                    {STEPS.map((step, idx) => (
                        <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center relative z-10">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${currentStep === step.id ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/20 scale-110' : currentStep > step.id ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'}`}>
                                    {currentStep > step.id ? <Check className="w-5 h-5" /> : <step.icon className="w-4 h-4 md:w-5 md:h-5" />}
                                </div>
                                <span className={`hidden md:block text-[10px] font-black uppercase tracking-widest absolute -bottom-8 whitespace-nowrap ${currentStep === step.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-600'}`}>{({1: t('settings.GoalsAndProfitView.stepIncomeGoals'), 2: t('settings.GoalsAndProfitView.stepExpenseAllocation'), 3: t('settings.GoalsAndProfitView.stepLaborBurden'), 4: t('settings.GoalsAndProfitView.stepReviewAndSave')} as Record<number,string>)[step.id]}</span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`flex-1 h-1 mx-2 rounded-full transition-colors duration-500 ${currentStep > step.id ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <Card className="w-full p-6 md:p-12 shadow-2xl border-0 rounded-[3rem] bg-white dark:bg-gray-800 relative overflow-hidden min-h-[500px] flex flex-col animate-in fade-in zoom-in-95 duration-500">
                <div className="flex-1">
                    {/* STEP 1: Income Goals & Sales Assumptions */}
                    {currentStep === 1 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-heading mb-2">{t('settings.GoalsAndProfitView.setYourTargets')}</h2>
                                <p className="text-slate-500 dark:text-gray-400 font-medium">{t('settings.GoalsAndProfitView.setYourTargetsSubtitle')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
                                <div className="space-y-6">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">{t('settings.GoalsAndProfitView.financialGoals')}</h4>
                                    <InputGroup label={t('settings.GoalsAndProfitView.desiredAnnualNetIncome')}>
                                        <NumberInput value={model.desiredAnnualIncome} onChange={(v) => handleUpdate('desiredAnnualIncome', v)} className="text-2xl font-bold py-3" />
                                    </InputGroup>
                                    <InputGroup label={t('settings.GoalsAndProfitView.targetNetProfitMargin')}>
                                        <NumberInput value={model.profitMargin} onChange={(v) => handleUpdate('profitMargin', v)} className="text-2xl font-bold py-3" />
                                    </InputGroup>
                                    
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2 pt-4">{t('settings.GoalsAndProfitView.salesAssumptions')}</h4>
                                    <InputGroup label={t('settings.GoalsAndProfitView.averageJobSize')}>
                                         <NumberInput value={model.avgJobSize} onChange={(v) => handleUpdate('avgJobSize', v)} />
                                    </InputGroup>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label={t('settings.GoalsAndProfitView.closingRate')}>
                                            <NumberInput value={model.closingRate} onChange={(v) => handleUpdate('closingRate', v)} />
                                        </InputGroup>
                                        <InputGroup label={t('settings.GoalsAndProfitView.leadConvRate')}>
                                            <NumberInput value={model.leadConversionRate} onChange={(v) => handleUpdate('leadConversionRate', v)} />
                                        </InputGroup>
                                    </div>
                                </div>
                                <div className="bg-primary-50/50 dark:bg-primary-900/20 rounded-[2rem] p-8 border border-primary-100 dark:border-primary-800 flex flex-col justify-center items-center text-center h-full">
                                    <span className="text-primary-800 dark:text-primary-300 font-bold text-sm uppercase tracking-widest mb-2">{t('settings.GoalsAndProfitView.requiredGrossRevenue')}</span>
                                    <span className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                                        ${(targetRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    <div className="mt-6 text-sm text-gray-600 dark:text-gray-300 max-w-xs mx-auto leading-relaxed mb-6">
                                        {t('settings.GoalsAndProfitView.toTakeHome', { income: model.desiredAnnualIncome.toLocaleString(), margin: model.profitMargin })}
                                    </div>
                                    
                                    <div className="w-full pt-6 border-t border-primary-200 dark:border-primary-800">
                                         <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-2xl font-black text-primary-700 dark:text-primary-300">{Math.ceil(targetRevenue/ (model.avgJobSize || 1))}</div>
                                                <div className="text-[10px] uppercase font-bold text-primary-400">{t('settings.GoalsAndProfitView.jobs')}</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-primary-700 dark:text-primary-300">{Math.ceil((targetRevenue/ (model.avgJobSize || 1)) / ((model.closingRate || 1)/100))}</div>
                                                <div className="text-[10px] uppercase font-bold text-primary-400">{t('settings.GoalsAndProfitView.ests')}</div>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black text-primary-700 dark:text-primary-300">{Math.ceil(((targetRevenue/ (model.avgJobSize || 1)) / ((model.closingRate || 1)/100)) / ((model.leadConversionRate || 1)/100))}</div>
                                                <div className="text-[10px] uppercase font-bold text-primary-400">{t('settings.GoalsAndProfitView.leads')}</div>
                                            </div>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Expenses */}
                    {currentStep === 2 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-heading mb-2">{t('settings.GoalsAndProfitView.allocateExpenses')}</h2>
                                <p className="text-slate-500 dark:text-gray-400 font-medium">{t('settings.GoalsAndProfitView.allocateExpensesSubtitle')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                <div className="space-y-6">
                                    <InputGroup label={t('settings.GoalsAndProfitView.materialsAndSundries')}><NumberInput value={model.materialCost} onChange={(v) => handleUpdate('materialCost', v)} /></InputGroup>
                                    <InputGroup label={t('settings.GoalsAndProfitView.marketingBudget')}><NumberInput value={model.marketingExpense} onChange={(v) => handleUpdate('marketingExpense', v)} /></InputGroup>
                                    <InputGroup label={t('settings.GoalsAndProfitView.miscExpense')}>
                                        <div className="relative">
                                            <NumberInput value={model.miscExpense} onChange={(v) => handleUpdate('miscExpense', v)} />
                                            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3">
                                                <Toggle checked={model.includeMiscMaterials !== false} onChange={(v) => handleUpdate('includeMiscMaterials', v)} />
                                            </div>
                                        </div>
                                    </InputGroup>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h4 className="text-xs font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-4 text-center">{t('settings.GoalsAndProfitView.revenueDollarBreakdown')}</h4>
                                    <div className="h-16 w-full bg-slate-100 dark:bg-gray-700 rounded-2xl overflow-hidden flex shadow-inner border border-slate-200 dark:border-gray-600">
                                        {model.profitMargin > 0 && <div style={{ width: `${model.profitMargin}%` }} className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-black text-white">{t('settings.GoalsAndProfitView.profit')}</div>}
                                        {totalExpensePercent > 0 && <div style={{ width: `${totalExpensePercent}%` }} className="bg-primary-400 h-full flex items-center justify-center text-[10px] font-black text-white">{t('settings.GoalsAndProfitView.exp')}</div>}
                                        <div className="flex-1 bg-slate-900 dark:bg-gray-600 h-full flex items-center justify-center text-[10px] font-black text-white">{t('settings.GoalsAndProfitView.labor')}</div>
                                    </div>
                                    <div className="mt-8 grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-700/50 border border-slate-100 dark:border-gray-700"><span className="block text-[10px] font-black text-slate-400 dark:text-gray-400 uppercase tracking-widest mb-1">{t('settings.GoalsAndProfitView.totalExpenses')}</span><span className="text-2xl font-black text-slate-900 dark:text-white">{totalExpensePercent.toFixed(1)}%</span></div>
                                        <div className="p-4 rounded-xl bg-slate-900 dark:bg-gray-600 text-white border border-slate-800 dark:border-gray-500 shadow-lg"><span className="block text-[10px] font-black text-slate-400 dark:text-gray-300 uppercase tracking-widest mb-1">{t('settings.GoalsAndProfitView.payrollBudget')}</span><span className="text-2xl font-black text-primary-400 dark:text-primary-300">{availableForLaborPercent.toFixed(1)}%</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Labor Burden */}
                    {currentStep === 3 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-heading mb-2">{t('settings.GoalsAndProfitView.laborBurden')}</h2>
                                <p className="text-slate-500 dark:text-gray-400 font-medium">{t('settings.GoalsAndProfitView.laborBurdenSubtitle')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                <div>
                                    <InputGroup label={t('settings.GoalsAndProfitView.averageBaseHourlyPay')} className="mb-6"><NumberInput value={model.avgHourlyPay} onChange={(v) => handleUpdate('avgHourlyPay', v)} className="py-3 font-bold" /></InputGroup>
                                    <div className="bg-slate-50 dark:bg-gray-700/50 p-6 rounded-2xl border border-slate-100 dark:border-gray-700 space-y-4">
                                        <h4 className="font-bold text-slate-700 dark:text-gray-200 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-gray-600 pb-2 mb-4">{t('settings.GoalsAndProfitView.taxesAndBenefitsPercent')}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputGroup label={t('settings.GoalsAndProfitView.socialSecurity')}><NumberInput value={model.taxSocialSecurity} onChange={(v) => handleUpdate('taxSocialSecurity', v)} /></InputGroup>
                                            <InputGroup label={t('settings.GoalsAndProfitView.medicareFuta')}><NumberInput value={model.taxFUTA} onChange={(v) => handleUpdate('taxFUTA', v)} /></InputGroup>
                                            <InputGroup label={t('settings.GoalsAndProfitView.stateUnemp')}><NumberInput value={model.taxSUTA} onChange={(v) => handleUpdate('taxSUTA', v)} /></InputGroup>
                                            <InputGroup label={t('settings.GoalsAndProfitView.workmansComp')}><NumberInput value={model.taxWorkmansComp} onChange={(v) => handleUpdate('taxWorkmansComp', v)} /></InputGroup>
                                            <InputGroup label={t('settings.GoalsAndProfitView.otherLiability')}><NumberInput value={model.taxLiability} onChange={(v) => handleUpdate('taxLiability', v)} /></InputGroup>
                                            <InputGroup label={t('settings.GoalsAndProfitView.benefits')}><NumberInput value={model.benefits} onChange={(v) => handleUpdate('benefits', v)} /></InputGroup>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center items-center space-y-6">
                                    <div className="text-center w-full"><div className="text-sm font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1">{t('settings.GoalsAndProfitView.totalBurdenRate')}</div><div className="text-4xl font-black text-slate-900 dark:text-white">{burdenPercent.toFixed(2)}%</div></div>
                                    <div className="w-full bg-white dark:bg-gray-700/30 border-2 border-slate-100 dark:border-gray-600 rounded-3xl p-8 relative shadow-xl">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-black px-4 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 uppercase tracking-widest">{t('settings.GoalsAndProfitView.trueCost')}</div>
                                        <div className="flex justify-between items-end border-b border-dashed border-slate-200 dark:border-gray-600 pb-4 mb-4"><span className="text-slate-500 dark:text-gray-400 font-medium text-sm uppercase">{t('settings.GoalsAndProfitView.baseRate')}</span><span className="font-bold text-slate-900 dark:text-white text-xl">${model.avgHourlyPay.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-end border-b border-dashed border-slate-200 dark:border-gray-600 pb-4 mb-4"><span className="text-slate-500 dark:text-gray-400 font-medium text-[10px] uppercase">{t('settings.GoalsAndProfitView.burdenWithRate', { rate: burdenPercent.toFixed(1) })}</span><span className="font-bold text-slate-900 dark:text-white">+$ {(model.avgHourlyPay * (burdenPercent/100)).toFixed(2)}</span></div>
                                        <div className="flex justify-between items-end pt-2"><span className="text-slate-900 dark:text-white font-black text-lg uppercase">{t('settings.GoalsAndProfitView.totalCost')}</span><span className="font-black text-primary-600 dark:text-primary-400 text-4xl tracking-tighter">${fullyBurdenedHourlyCost.toFixed(2)}</span></div>
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 text-center max-w-xs leading-relaxed italic">{t('settings.GoalsAndProfitView.trueCostQuote')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Review (Matching Final Screenshot) */}
                    {currentStep === 4 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-12 text-center">
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-heading mb-2">{t('settings.GoalsAndProfitView.finalEngineCalibration')}</h2>
                                <p className="text-slate-500 dark:text-gray-400 font-medium">{t('settings.GoalsAndProfitView.finalEngineCalibrationSubtitle')}</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto w-full items-center">
                                <div className="space-y-6">
                                     <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                                        <h4 className="font-black text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-[0.2em] border-b border-gray-50 dark:border-gray-700 pb-3">{t('settings.GoalsAndProfitView.laborAndBurden')}</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 font-medium text-base">{t('settings.GoalsAndProfitView.baseHourlyPay')}</span><span className="font-bold text-gray-900 dark:text-white text-lg">${model.avgHourlyPay.toFixed(2)}</span></div>
                                            <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 font-medium text-base">{t('settings.GoalsAndProfitView.burdenRate')}</span><span className="font-black text-gray-900 dark:text-white text-lg">{burdenPercent.toFixed(1)}%</span></div>
                                            <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700 flex justify-between items-center"><span className="text-gray-900 dark:text-white font-black text-sm uppercase tracking-widest">{t('settings.GoalsAndProfitView.burdenedCost')}</span><span className="font-black text-primary-600 dark:text-primary-400 text-xl">${fullyBurdenedHourlyCost.toFixed(2)}/hr</span></div>
                                        </div>
                                     </div>
                                     <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                                        <h4 className="font-black text-gray-400 dark:text-gray-500 text-[11px] uppercase tracking-[0.2em] border-b border-gray-50 dark:border-gray-700 pb-3">{t('settings.GoalsAndProfitView.revenueModel')}</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 font-medium text-base">{t('settings.GoalsAndProfitView.targetMargin')}</span><span className="font-black text-emerald-500 dark:text-emerald-400 text-lg">{model.profitMargin}%</span></div>
                                            <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 font-medium text-base">{t('settings.GoalsAndProfitView.overheadExp')}</span><span className="font-black text-amber-500 dark:text-amber-400 text-lg">{totalExpensePercent.toFixed(1)}%</span></div>
                                            <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700 flex justify-between items-center"><span className="text-gray-900 dark:text-white font-black text-sm uppercase tracking-widest">{t('settings.GoalsAndProfitView.laborBudget')}</span><span className="font-black text-gray-900 dark:text-white text-xl">{availableForLaborPercent.toFixed(1)}%</span></div>
                                        </div>
                                     </div>
                                </div>
                                <div className="flex flex-col items-center gap-8">
                                     <div className="w-full bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 rounded-[2.5rem] p-12 relative shadow-2xl shadow-primary-500/10 overflow-hidden ring-1 ring-blue-50 dark:ring-blue-900">
                                        <div className="absolute top-1/2 right-0 -translate-y-1/2 p-6 opacity-5 pointer-events-none"><Activity className="w-48 h-48 text-primary-500" /></div>
                                        <div className="relative z-10 text-center space-y-6">
                                            <span className="text-primary-600 dark:text-primary-400 font-black text-[11px] uppercase tracking-[0.3em] block">{t('settings.GoalsAndProfitView.calculatedChargeRate')}</span>
                                            <div className="flex flex-col items-center">
                                                <div className="text-7xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter">${finalHourlyRate.toFixed(2)}</div>
                                                <span className="text-gray-400 dark:text-gray-500 font-bold text-lg uppercase tracking-widest mt-1">{t('settings.GoalsAndProfitView.perHour')}</span>
                                            </div>
                                            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
                                                <div className="flex justify-between items-center px-2"><span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('settings.GoalsAndProfitView.targetAnnualRevenue')}</span><span className="text-xl font-black text-gray-900 dark:text-white">${targetRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <Button onClick={applyModel} size="lg" className="w-full h-16 font-black text-lg shadow-2xl shadow-primary-500/30 rounded-2xl transition-all active:scale-95">
                                        <Check className="w-6 h-6 mr-3" /> {t('settings.GoalsAndProfitView.applyFinancialModel')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 pt-8 border-t border-slate-100 dark:border-gray-700 flex items-center justify-between">
                    <Button variant="ghost" onClick={() => (currentStep === 1 ? onCancel() : setCurrentStep(prev => prev - 1))} className="text-slate-400 dark:text-gray-400 font-bold hover:text-slate-900 dark:hover:text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" /> {t('settings.GoalsAndProfitView.previous')}
                    </Button>
                    {currentStep < 4 && (
                        <Button onClick={() => setCurrentStep(prev => prev + 1)} size="lg" className="px-10 h-14 font-bold">
                            {t('settings.GoalsAndProfitView.nextStep')} <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
};
