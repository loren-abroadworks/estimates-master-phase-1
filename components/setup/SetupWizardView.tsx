
import React, { useState } from 'react';
import {
    Target, PieChart, Users, Calculator, Activity,
    Check, ArrowRight, ArrowLeft,
    DollarSign, Paintbrush, TrendingUp
} from 'lucide-react';
import { FinancialModelSettings } from '../../types';
import { Card, Button, NumberInput, InputGroup, Toggle, Badge } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface SetupWizardViewProps {
    onComplete: (settings: FinancialModelSettings) => void;
    initialSettings?: FinancialModelSettings;
}

const STEPS = [
    { id: 1, title: 'Income Goals', icon: Target },
    { id: 2, title: 'Expense Allocation', icon: PieChart },
    { id: 3, title: 'Labor Burden', icon: Users },
    { id: 4, title: 'Review & Save', icon: Calculator },
];

export const SetupWizardView = ({ onComplete, initialSettings }: SetupWizardViewProps) => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(1);
    const [model, setModel] = useState<FinancialModelSettings>(initialSettings || {
        desiredAnnualIncome: 100000,
        profitMargin: 35,
        marketingExpense: 0,
        miscExpense: 8,
        includeMiscExpense: true,
        includeMiscMaterials: true,
        materialCost: 13,
        avgHourlyPay: 25,
        annualHoursPerEmployee: 2000,
        taxSocialSecurity: 7.65,
        taxFUTA: 0.1,
        taxSUTA: 5,
        taxLiability: 1,
        taxWorkmansComp: 10,
        benefits: 0,
        customBurdens: [],
        avgJobSize: 3500,
        closingRate: 35,
        leadConversionRate: 25,
    });

    // --- CALCULATIONS ---
    
    // Step 1: Revenue Target
    const targetRevenue = model.profitMargin > 0 ? (model.desiredAnnualIncome / (model.profitMargin / 100)) : 0;
    
    // Step 2: Overhead & Allocations
    const misc = (model.includeMiscMaterials !== false) ? model.miscExpense : 0;
    const totalExpensePercent = model.materialCost + model.marketingExpense + misc;
    const availableForLaborPercent = 100 - model.profitMargin - totalExpensePercent; // Payroll Cost %
    
    // Step 3: Labor Burden
    const burdenPercent = 
        model.taxSocialSecurity + 
        model.taxFUTA + 
        model.taxSUTA + 
        model.taxWorkmansComp + 
        model.taxLiability + 
        model.benefits; 
        
    const fullyBurdenedHourlyCost = model.avgHourlyPay * (1 + burdenPercent / 100);

    // Step 4: Final OpEx Charge Rate (USD/hr)
    const finalHourlyRate = availableForLaborPercent > 0 ? (fullyBurdenedHourlyCost / (availableForLaborPercent / 100)) : 0;

    const handleUpdate = (field: keyof FinancialModelSettings, value: any) => {
        setModel(prev => ({ ...prev, [field]: value }));
    };

    const handleFinish = () => {
        onComplete({
            ...model,
            requiredGrossRevenue: targetRevenue,
            payrollCostPercent: availableForLaborPercent,
            avgLaborRate: finalHourlyRate,
            opexRate: (100 - availableForLaborPercent) / 100
        });
    };

    const isStepValid = () => {
        if (currentStep === 1) return model.desiredAnnualIncome > 0 && model.profitMargin > 0;
        if (currentStep === 3) return model.avgHourlyPay > 0;
        return true;
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 px-4 md:px-8 font-sans">
            
            {/* Header branding */}
            <div className="mb-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-[1.25rem] shadow-xl text-white mb-6">
                    <Paintbrush className="w-8 h-8" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">{t('setup.SetupWizardView.estimateMaster')}</h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">{t('setup.SetupWizardView.initialEngineCalibration')}</p>
            </div>

            {/* Stepper */}
            <div className="flex justify-center mb-10 w-full max-w-lg px-4">
                <div className="flex items-center w-full">
                    {STEPS.map((step, idx) => (
                        <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center relative z-10">
                                <div 
                                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                        currentStep === step.id 
                                            ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/20 scale-110' 
                                            : currentStep > step.id 
                                                ? 'bg-primary-50 border-primary-500 text-primary-600'
                                                : 'bg-white border-gray-200 text-gray-300'
                                    }`}
                                >
                                    {currentStep > step.id ? <Check className="w-5 h-5" /> : <step.icon className="w-4 h-4 md:w-5 md:h-5" />}
                                </div>
                                <span className={`hidden md:block text-[10px] font-black uppercase tracking-widest absolute -bottom-8 whitespace-nowrap ${
                                    currentStep === step.id ? 'text-primary-600' : 'text-gray-400'
                                }`}>
                                    {t(`setup.SetupWizardView.stepTitle_${step.id}`)}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`flex-1 h-1 mx-2 rounded-full transition-colors duration-500 ${
                                    currentStep > step.id ? 'bg-primary-500' : 'bg-gray-200'
                                }`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Main Content Card */}
            <Card className="w-full max-w-5xl p-6 md:p-12 shadow-2xl border-0 rounded-[3rem] bg-white relative overflow-hidden min-h-[500px] flex flex-col animate-in fade-in zoom-in-95 duration-500">
                
                <div className="flex-1">
                    {/* STEP 1: Income Goals */}
                    {currentStep === 1 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 font-heading mb-2">{t('setup.SetupWizardView.setYourTargets')}</h2>
                                <p className="text-slate-500 font-medium">{t('setup.SetupWizardView.defineIncomeGoalDesc')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                                <div className="space-y-8">
                                    <InputGroup label={t('setup.SetupWizardView.desiredAnnualIncome')}>
                                        <NumberInput
                                            value={model.desiredAnnualIncome}
                                            onChange={(v) => handleUpdate('desiredAnnualIncome', v)}
                                            className="text-2xl font-bold py-4"
                                        />
                                    </InputGroup>
                                    <InputGroup label={t('setup.SetupWizardView.targetNetProfitMargin')}>
                                        <NumberInput
                                            value={model.profitMargin}
                                            onChange={(v) => handleUpdate('profitMargin', v)}
                                            className="text-2xl font-bold py-4"
                                        />
                                    </InputGroup>
                                </div>
                                <div className="bg-primary-50/50 rounded-[2rem] p-8 border border-primary-100 flex flex-col justify-center items-center text-center">
                                    <span className="text-primary-800 font-bold text-sm uppercase tracking-widest mb-2">{t('setup.SetupWizardView.requiredGrossRevenue')}</span>
                                    <span className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter">
                                        ${(targetRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    <div className="mt-6 text-sm text-gray-600 max-w-xs mx-auto leading-relaxed">
                                        {t('setup.SetupWizardView.revenueExplanation', { income: `$${model.desiredAnnualIncome.toLocaleString()}`, margin: `${model.profitMargin}%` })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Expenses */}
                    {currentStep === 2 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 font-heading mb-2">{t('setup.SetupWizardView.allocateExpenses')}</h2>
                                <p className="text-slate-500 font-medium">{t('setup.SetupWizardView.divideRevenueDesc')}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                <div className="space-y-6">
                                    <InputGroup label={t('setup.SetupWizardView.materialsSundries')}>
                                        <NumberInput value={model.materialCost} onChange={(v) => handleUpdate('materialCost', v)} />
                                    </InputGroup>
                                    <InputGroup label={t('setup.SetupWizardView.marketingBudget')}>
                                        <NumberInput value={model.marketingExpense} onChange={(v) => handleUpdate('marketingExpense', v)} />
                                    </InputGroup>
                                    <InputGroup label={t('setup.SetupWizardView.miscExpense')}>
                                        <div className="relative">
                                            <NumberInput value={model.miscExpense} onChange={(v) => handleUpdate('miscExpense', v)} />
                                            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3">
                                                <Toggle 
                                                    checked={model.includeMiscMaterials !== false} 
                                                    onChange={(v) => handleUpdate('includeMiscMaterials', v)} 
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 mt-2">{t('setup.SetupWizardView.includeInRateCalc')}</p>
                                    </InputGroup>
                                </div>

                                <div className="flex flex-col justify-center">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">{t('setup.SetupWizardView.revenueDollarBreakdown')}</h4>
                                    <div className="h-16 w-full bg-slate-100 rounded-2xl overflow-hidden flex shadow-inner border border-slate-200">
                                        {model.profitMargin > 0 && (
                                            <div style={{ width: `${model.profitMargin}%` }} className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-black text-white" title={t('setup.SetupWizardView.netProfit')}>{t('setup.SetupWizardView.profit')}</div>
                                        )}
                                        {totalExpensePercent > 0 && (
                                            <div style={{ width: `${totalExpensePercent}%` }} className="bg-primary-400 h-full flex items-center justify-center text-[10px] font-black text-white" title={t('setup.SetupWizardView.expenses')}>{t('setup.SetupWizardView.exp')}</div>
                                        )}
                                        <div className="flex-1 bg-slate-900 h-full flex items-center justify-center text-[10px] font-black text-white" title={t('setup.SetupWizardView.laborBudget')}>{t('setup.SetupWizardView.labor')}</div>
                                    </div>
                                    
                                    <div className="mt-8 grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('setup.SetupWizardView.totalExpenses')}</span>
                                            <span className="text-2xl font-black text-slate-900">{totalExpensePercent.toFixed(1)}%</span>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-lg">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('setup.SetupWizardView.payrollBudget')}</span>
                                            <span className="text-2xl font-black text-primary-400">{availableForLaborPercent.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Labor Burden */}
                    {currentStep === 3 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 font-heading mb-2">{t('setup.SetupWizardView.laborBurdenHeading')}</h2>
                                <p className="text-slate-500 font-medium">{t('setup.SetupWizardView.laborBurdenDesc')}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                                <div>
                                    <InputGroup label={t('setup.SetupWizardView.avgBaseHourlyPay')} className="mb-6">
                                        <NumberInput value={model.avgHourlyPay} onChange={(v) => handleUpdate('avgHourlyPay', v)} className="py-3 font-bold" />
                                    </InputGroup>
                                    
                                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                        <h4 className="font-bold text-slate-700 text-[10px] uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">{t('setup.SetupWizardView.taxesAndBenefits')}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputGroup label={t('setup.SetupWizardView.socialSecurity')}><NumberInput value={model.taxSocialSecurity} onChange={(v) => handleUpdate('taxSocialSecurity', v)} /></InputGroup>
                                            <InputGroup label={t('setup.SetupWizardView.medicareFuta')}><NumberInput value={model.taxFUTA} onChange={(v) => handleUpdate('taxFUTA', v)} /></InputGroup>
                                            <InputGroup label={t('setup.SetupWizardView.stateUnemp')}><NumberInput value={model.taxSUTA} onChange={(v) => handleUpdate('taxSUTA', v)} /></InputGroup>
                                            <InputGroup label={t('setup.SetupWizardView.workmansComp')}><NumberInput value={model.taxWorkmansComp} onChange={(v) => handleUpdate('taxWorkmansComp', v)} /></InputGroup>
                                            <InputGroup label={t('setup.SetupWizardView.otherLiability')}><NumberInput value={model.taxLiability} onChange={(v) => handleUpdate('taxLiability', v)} /></InputGroup>
                                            <InputGroup label={t('setup.SetupWizardView.benefits')}><NumberInput value={model.benefits} onChange={(v) => handleUpdate('benefits', v)} /></InputGroup>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center items-center space-y-6">
                                    <div className="text-center w-full">
                                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{t('setup.SetupWizardView.totalBurdenRate')}</div>
                                        <div className="text-4xl font-black text-slate-900">{burdenPercent.toFixed(2)}%</div>
                                    </div>
                                    
                                    <div className="w-full bg-white border-2 border-slate-100 rounded-3xl p-8 relative shadow-xl">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-100 text-amber-800 text-[10px] font-black px-4 py-1.5 rounded-full border border-amber-200 uppercase tracking-widest">
                                            {t('setup.SetupWizardView.trueCost')}
                                        </div>
                                        <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-4 mb-4">
                                            <span className="text-slate-500 font-medium">{t('setup.SetupWizardView.baseRate')}</span>
                                            <span className="font-bold text-slate-900">${model.avgHourlyPay.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-4 mb-4">
                                            <span className="text-slate-500 font-medium text-xs">{t('setup.SetupWizardView.burdenWithRate', { rate: burdenPercent.toFixed(1) })}</span>
                                            <span className="font-bold text-slate-900">+${(model.avgHourlyPay * (burdenPercent/100)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-end pt-2">
                                            <span className="text-slate-900 font-black text-lg">{t('setup.SetupWizardView.totalCost')}</span>
                                            <span className="font-black text-primary-600 text-4xl tracking-tighter">${fullyBurdenedHourlyCost.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed italic">{t('setup.SetupWizardView.trueCostQuote')}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Review & Finalize (Matching Screenshot Exactly) */}
                    {currentStep === 4 && (
                        <div className="animate-in slide-in-from-right fade-in duration-300 flex-1 flex flex-col">
                            <div className="mb-12 text-center">
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white font-heading mb-2">{t('setup.SetupWizardView.finalEngineCalibration')}</h2>
                                <p className="text-slate-500 dark:text-gray-400 font-medium">{t('setup.SetupWizardView.verifyFinancialModelDesc')}</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto w-full items-center">
                                {/* Left Side: Two Breakdown Cards */}
                                <div className="space-y-6">
                                     {/* LABOR & BURDEN Card */}
                                     <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
                                        <h4 className="font-black text-gray-400 text-[11px] uppercase tracking-[0.2em] border-b border-gray-50 pb-3">{t('setup.SetupWizardView.laborAndBurden')}</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-medium text-base">{t('setup.SetupWizardView.baseHourlyPay')}</span>
                                                <span className="font-bold text-gray-900 text-lg">${model.avgHourlyPay.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-medium text-base">{t('setup.SetupWizardView.burdenRate')}</span>
                                                <span className="font-black text-gray-900 text-lg">{burdenPercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
                                                <span className="text-gray-900 font-black text-sm uppercase tracking-widest">{t('setup.SetupWizardView.burdenedCost')}</span>
                                                <span className="font-black text-primary-600 text-xl">${fullyBurdenedHourlyCost.toFixed(2)}/hr</span>
                                            </div>
                                        </div>
                                     </div>

                                     {/* REVENUE MODEL Card */}
                                     <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
                                        <h4 className="font-black text-gray-400 text-[11px] uppercase tracking-[0.2em] border-b border-gray-50 pb-3">{t('setup.SetupWizardView.revenueModel')}</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-medium text-base">{t('setup.SetupWizardView.targetMargin')}</span>
                                                <span className="font-black text-emerald-500 text-lg">{model.profitMargin}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-medium text-base">{t('setup.SetupWizardView.overheadExp')}</span>
                                                <span className="font-black text-amber-500 text-lg">{totalExpensePercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
                                                <span className="text-gray-900 font-black text-sm uppercase tracking-widest">{t('setup.SetupWizardView.laborBudget')}</span>
                                                <span className="font-black text-gray-900 text-xl">{availableForLaborPercent.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                     </div>
                                </div>

                                {/* Right Side: Hero Card & Action */}
                                <div className="flex flex-col items-center gap-8">
                                     <div className="w-full bg-white border border-blue-100 rounded-[2.5rem] p-12 relative shadow-2xl shadow-primary-500/10 overflow-hidden ring-1 ring-blue-50">
                                        {/* Background Pulse/Waveform Simulation */}
                                        <div className="absolute top-1/2 right-0 -translate-y-1/2 p-6 opacity-5 pointer-events-none">
                                            <Activity className="w-48 h-48 text-primary-500" />
                                        </div>

                                        <div className="relative z-10 text-center space-y-6">
                                            <span className="text-primary-600 font-black text-[11px] uppercase tracking-[0.3em] block">
                                                {t('setup.SetupWizardView.calculatedChargeRate')}
                                            </span>
                                            <div className="flex flex-col items-center">
                                                <div className="text-7xl md:text-8xl font-black text-gray-900 tracking-tighter">
                                                    ${finalHourlyRate.toFixed(2)}
                                                </div>
                                                <span className="text-gray-400 font-bold text-lg uppercase tracking-widest mt-1">{t('setup.SetupWizardView.perHour')}</span>
                                            </div>
                                            
                                            <div className="mt-12 pt-8 border-t border-gray-100">
                                                <div className="flex justify-between items-center px-2">
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('setup.SetupWizardView.targetAnnualRevenue')}</span>
                                                    <span className="text-xl font-black text-gray-900">${targetRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleFinish}
                                        size="lg"
                                        className="w-full h-16 font-black text-lg shadow-2xl shadow-primary-500/30 rounded-2xl transition-all active:scale-95"
                                    >
                                        {t('setup.SetupWizardView.continue')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {currentStep < 4 && (
                    <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
                        <Button 
                            variant="ghost" 
                            onClick={() => (currentStep === 1 ? onComplete({} as any) : setCurrentStep(prev => prev - 1))} 
                            className="text-slate-400 font-bold hover:text-slate-900"
                        >
                            {currentStep === 1 ? t('setup.SetupWizardView.skipSetup') : <><ArrowLeft className="w-4 h-4 mr-2" /> {t('setup.SetupWizardView.previous')}</>}
                        </Button>
                        
                        <Button 
                            onClick={() => setCurrentStep(prev => prev + 1)} 
                            disabled={!isStepValid()}
                            size="lg"
                            className="px-10 h-14 font-bold"
                        >
                            {t('setup.SetupWizardView.nextStep')} <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </div>
                )}
            </Card>

            {/* Bottom Tip */}
            <div className="mt-8 flex items-center gap-3 text-slate-400">
                <Badge color="gray">{t('setup.SetupWizardView.systemCalibrator')}</Badge>
                <span className="text-xs font-medium italic">{t('setup.SetupWizardView.systemCalibratorTip')}</span>
            </div>
        </div>
    );
};
