
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, Badge, Button } from '../UI';
import { DatePicker } from '../ui/DatePicker';
import { Typography, Spacing } from '../../theme/designSystem';
import { FileSpreadsheet, TrendingUp, ClipboardList, Target, Download, ChevronDown, Briefcase, Calendar, Calculator, AlertCircle, Info } from 'lucide-react';
import { GlobalSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

const MOCK_REPORTS_DATA = {
  estimates: [
    { date: '5-Jan', jobNo: '2025-3', customer: 'Andy Dahlberg', source: 'Repeat', amount: 2695, hours: 42, wash: 0, left: 42, pending: 2695, status: 'SOLD', present: '5-Jan', email: '' },
    { date: '6-Jan', jobNo: '2025-5', customer: 'John Canfield', source: 'Repeat', amount: 895, hours: 23.5, wash: 0, left: 23.5, pending: 0, status: 'SOLD', present: '6-Jan', email: '' },
    { date: '8-Jan', jobNo: '2025-4', customer: 'Todd & Chris Boys', source: 'Referral', amount: 3597, hours: 50, wash: 0, left: 50, pending: 0, status: 'SOLD', present: '8-Jan', email: '' },
    { date: '9-Jan', jobNo: '2025-8', customer: 'Aspen - Miller', source: 'Repeat', amount: 865, hours: 7.75, wash: 0, left: 0, pending: 0, status: 'SOLD', present: '', email: '' },
    { date: '9-Jan', jobNo: '2025-9', customer: 'Aspen-McGarity', source: 'Repeat', amount: 770, hours: 11, wash: 0, left: 0, pending: 0, status: 'SOLD', present: '', email: '' },
    { date: '11-Jan', jobNo: '2025-6', customer: 'Harvey Johnson', source: 'Repeat', amount: 1997, hours: 28, wash: 0, left: 28, pending: 0, status: 'SOLD', present: '11-Jan', email: '' },
    { date: '11-Jan', jobNo: '2025-7', customer: 'Mary Westphal', source: 'Referral', amount: 5997, hours: 85.75, wash: 0, left: 85.75, pending: 0, status: 'SOLD', present: '11-Jan', email: '11-Jan' },
    { date: '21-Jan', jobNo: '2025-12', customer: 'Matt USA', source: 'Google', amount: 950, hours: 13.5, wash: 0, left: 13.5, pending: 0, status: 'SOLD', present: '22-Jan', email: '22-Jan' },
    { date: '31-Jan', jobNo: '2025-40', customer: 'John Westphal', source: 'Referral', amount: 1800, hours: 36.5, wash: 0, left: 36.5, pending: 0, status: 'SOLD', present: '31-Jan', email: '1-Feb' },
    { date: '1-Feb', jobNo: '2025-10', customer: 'Prop Care', source: 'Repeat', amount: 4925, hours: 77, wash: 0, left: 77, pending: 0, status: 'SOLD', present: '2-Feb', email: '2-Feb' },
    { date: '15-Dec', jobNo: '2024-350', customer: 'Previous Client', source: 'Repeat', amount: 1200, hours: 15, wash: 0, left: 0, pending: 0, status: 'SOLD', present: '15-Dec', email: '' },
  ],
  jobsSold: [
    { date: '6-Jan', jobNo: '2025-5', customer: 'John Canfield', source: 'Repeat', amount: 1695, hours: 23.5, wash: 0, left: 0, paid: 'Y' },
    { date: '8-Jan', jobNo: '2025-4', customer: 'Todd & Chris Boys', source: 'Referral', amount: 3642, hours: 51, wash: 0, left: 0, paid: 'Y' },
    { date: '9-Jan', jobNo: '2025-8', customer: 'Aspen - Miller', source: 'Repeat', amount: 895, hours: 7.75, wash: 0, left: 0, paid: '' },
    { date: '9-Jan', jobNo: '2025-9', customer: 'Aspen-McGarity', source: 'Repeat', amount: 770, hours: 11, wash: 0, left: 0, paid: '' },
    { date: '11-Jan', jobNo: '2025-6', customer: 'Harvey Johnson', source: 'Repeat', amount: 2072, hours: 28, wash: 0, left: 0, paid: 'Y' },
    { date: '19-Jan', jobNo: '2025-7', customer: 'Mary Westphal', source: 'Referral', amount: 5770, hours: 85, wash: 0, left: 0, paid: 'Y' },
    { date: '21-Jan', jobNo: '2025-141', customer: 'Frank Agguirre', source: 'Repeat', amount: 5274, hours: 76, wash: 2, left: 74, paid: '' },
    { date: '23-Jan', jobNo: '2025-13', customer: 'Chandler Industries', source: 'Google', amount: 3233.74, hours: 46.5, wash: 0, left: 0, paid: '' },
    { date: '30-Jan', jobNo: '2025-331', customer: 'Ben Albers', source: 'Web', amount: 1525, hours: 19.5, wash: 0, left: 0, paid: 'Y' },
    { date: '31-Jan', jobNo: '2025-40', customer: 'John Westphal', source: 'Referral', amount: 1800, hours: 36.5, wash: 0, left: 0, paid: 'Y' },
    { date: '1-Feb', jobNo: '2025-285', customer: 'John Mccormick', source: 'Referral', amount: 425, hours: 6, wash: 0, left: 5, paid: '' },
    { date: '3-Feb', jobNo: '2025-41', customer: 'Sheri Stewart', source: 'Referral', amount: 1060, hours: 21.75, wash: 0, left: 0, paid: 'Y' },
    { date: '4-Feb', jobNo: '2025-39', customer: 'Angela Nillsen', source: 'Referral', amount: 525, hours: 12.5, wash: 0, left: 0, paid: 'Y' },
    { date: '5-Feb', jobNo: '2025-46', customer: 'Aspen Fuechtmann', source: 'Repeat', amount: 2988, hours: 43, wash: 0, left: 0, paid: '' },
  ],
  salesGoals: [
    {
      month: 'January',
      goal: 55000,
      total: 53368.99,
      jobs: [
        { date: '31-Jul', jobNo: '2024-230', customer: 'Eric Ness', source: 'Referral', amount: 1587, hours: 0, wash: 0, left: 0 },
        { date: '8-Nov', jobNo: '2024-51', customer: 'Maxine Mcclellen', source: 'USB 24', amount: 5105, hours: 0, wash: 0, left: 0 },
        { date: '23-Nov', jobNo: '2024-310', customer: 'Andy & Kate King', source: 'Repeat', amount: 1795, hours: 36, wash: 0, left: 0 },
        { date: '6-Jan', jobNo: '2025-5', customer: 'John Canfield', source: 'Repeat', amount: 1695, hours: 23.5, wash: 0, left: 0 },
        { date: '8-Jan', jobNo: '2025-4', customer: 'Todd & Chris Boys', source: 'Referral', amount: 3642, hours: 51, wash: 0, left: 0 },
        { date: '19-Jan', jobNo: '2025-7', customer: 'Mary Westphal', source: 'Referral', amount: 5300, hours: 75, wash: 0, left: 0 },
      ]
    },
    {
      month: 'February',
      goal: 120000,
      total: 0, 
      jobs: [
        { date: '1-Feb', jobNo: '2024-285', customer: 'John Mccormick', source: 'Referral', amount: 425, hours: 6, wash: 0, left: 5 },
        { date: '1-Feb', jobNo: '2025-7', customer: 'Mary Westphal', source: 'Referral', amount: 470, hours: 10, wash: 0, left: 0 },
        { date: '3-Feb', jobNo: '2025-41', customer: 'Sheri Stewart', source: 'Referral', amount: 1060, hours: 21.75, wash: 0, left: 0 },
      ]
    }
  ],
  production: [
    { date: '2024-230', customer: 'Eric Ness', source: 'Referral', amount: 1587, hours: 0, wash: 0, left: 0 },
    { date: '2024-322', customer: 'Tom & Heidi Dauer', source: 'Repeat', amount: 1605, hours: 28, wash: 0, left: 0 },
    { date: '2024-326', customer: 'Marina Naples', source: 'Referral', amount: 4364.25, hours: 60, wash: 0, left: 0 },
    { date: '2025-4', customer: 'Todd & Chris Boys', source: 'Referral', amount: 3642, hours: 51, wash: 0, left: 0 },
    { date: '2025-6', customer: 'Harvey Johnson', source: 'Repeat', amount: 2072, hours: 28, wash: 0, left: 0 },
  ],
  summary: {
    months: ['JAN', 'FEB', 'MAR', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'],
    estimates: {
      goal: [14, 50, 68, 24, 30, 28, 20, 20, 19, 16, 20, 10],
      done: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      sold: [18, 18, 23, 19, 20, 0, 0, 0, 0, 0, 0, 0]
    },
    // Sales goals removed from here, calculated dynamically in component
    sold: [53368.99, 33812.82, 85930.03, 55231.2, 101083, 104454.7, 26507.63, 45686.25, 58194, 43547, 26464, 0]
  }
};

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 md:px-6 md:py-3 rounded-lg text-xs md:text-sm font-bold transition-all relative whitespace-nowrap flex-shrink-0 ${
      active 
        ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm ring-1 ring-black/5' 
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`}
  >
    <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
    {label}
  </button>
);

const formatCompactCurrency = (value: number) => {
    if (value === 0) return '-';
    if (value === undefined || value === null) return '-';
    // If < 1000, return as is
    if (Math.abs(value) < 1000) return `$${value.toFixed(0)}`;
    // Else return K format
    return `$${(value / 1000).toFixed(0)}k`;
};

const formatFullCurrency = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to parse dates like "6-Jan" using the selected year
const parseMockDate = (dateStr: string, defaultYear: number): Date | null => {
    if (!dateStr || !dateStr.includes('-')) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 2) return null;
    
    const [dayStr, monStr] = parts;
    const months: {[key:string]: number} = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const month = months[monStr];
    if (month === undefined) return null;
    
    const day = parseInt(dayStr);
    if (isNaN(day)) return null;

    return new Date(defaultYear, month, day);
};

export const ReportsView = ({ settings, onUpdateSettings }: { settings?: GlobalSettings, onUpdateSettings?: (settings: GlobalSettings) => void }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'estimates' | 'jobs_sold' | 'sales' | 'production' | 'summary'>('jobs_sold');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedYear, setSelectedYear] = useState(2025);

  // --- GOAL STATE MANAGEMENT ---
  const model = settings?.financialModel || DEFAULT_SETTINGS.financialModel;
  const avgJobSize = model.avgJobSize || 3500;
  const closingRate = model.closingRate || 35; // %
  const profitMargin = model.profitMargin || 35; // %
  const desiredIncome = model.desiredAnnualIncome || 100000;
  
  const targetRevenue = profitMargin > 0 ? desiredIncome / (profitMargin / 100) : 0;
  const totalJobsNeeded = avgJobSize > 0 ? targetRevenue / avgJobSize : 0;
  const annualEstimatesTarget = closingRate > 0 ? Math.ceil(totalJobsNeeded / (closingRate / 100)) : 0;

  const [monthlySalesGoals, setMonthlySalesGoals] = useState<number[]>(
      model.monthlySalesGoals?.length === 12 
        ? model.monthlySalesGoals 
        : Array(12).fill(Math.round(targetRevenue / 12))
  );

  // Calculate Estimate Goals dynamically based on Sales Goals
  const [monthlyEstimateGoals, setMonthlyEstimateGoals] = useState<number[]>(
      model.monthlyEstimateGoals?.length === 12
        ? model.monthlyEstimateGoals
        : Array(12).fill(0).map((_, i) => {
            const sg = model.monthlySalesGoals?.length === 12 ? model.monthlySalesGoals[i] : Math.round(targetRevenue / 12);
            if (closingRate <= 0 || avgJobSize <= 0) return 0;
            return Math.ceil(sg / (avgJobSize * (closingRate / 100)));
        })
  );

  // Derived Diff for Sales (Actual - Goal)
  const salesDiffs = useMemo(() => {
    return MOCK_REPORTS_DATA.summary.sold.map((actualSold, idx) => {
        const goal = monthlySalesGoals[idx] || 0;
        return actualSold - goal;
    });
  }, [monthlySalesGoals]);

  // Total Calculations
  const currentTotalEstimatesSet = monthlyEstimateGoals.reduce((a,b) => a + b, 0);
  const currentTotalSalesGoal = monthlySalesGoals.reduce((a,b) => a + b, 0);

  const handleSalesGoalChange = (index: number, newGoalStr: string) => {
      const cleanStr = newGoalStr.replace(/[^0-9.]/g, '');
      const newSalesGoal = parseFloat(cleanStr) || 0;
      
      const newSalesGoals = [...monthlySalesGoals];
      newSalesGoals[index] = newSalesGoal;
      
      const newEstimateGoals = [...monthlyEstimateGoals];
      if (closingRate > 0 && avgJobSize > 0) {
          newEstimateGoals[index] = Math.ceil(newSalesGoal / (avgJobSize * (closingRate / 100)));
      } else {
          newEstimateGoals[index] = 0;
      }
      
      setMonthlySalesGoals(newSalesGoals);
      setMonthlyEstimateGoals(newEstimateGoals);
      
      if (onUpdateSettings && settings) {
          onUpdateSettings({
              ...settings,
              financialModel: {
                  ...settings.financialModel,
                  monthlySalesGoals: newSalesGoals,
                  monthlyEstimateGoals: newEstimateGoals
              }
          });
      }
  };

  const handleEstimateGoalChange = (index: number, newGoalStr: string) => {
      const cleanStr = newGoalStr.replace(/[^0-9]/g, '');
      const newEstimateGoal = parseInt(cleanStr, 10) || 0;
      
      const newEstimateGoals = [...monthlyEstimateGoals];
      newEstimateGoals[index] = newEstimateGoal;
      
      const newSalesGoals = [...monthlySalesGoals];
      if (closingRate > 0 && avgJobSize > 0) {
          newSalesGoals[index] = Math.round(newEstimateGoal * avgJobSize * (closingRate / 100));
      } else {
          newSalesGoals[index] = 0;
      }
      
      setMonthlyEstimateGoals(newEstimateGoals);
      setMonthlySalesGoals(newSalesGoals);
      
      if (onUpdateSettings && settings) {
          onUpdateSettings({
              ...settings,
              financialModel: {
                  ...settings.financialModel,
                  monthlyEstimateGoals: newEstimateGoals,
                  monthlySalesGoals: newSalesGoals
              }
          });
      }
  };

  const filteredEstimatesLog = useMemo(() => {
    let data = MOCK_REPORTS_DATA.estimates.filter(item => item.jobNo.startsWith(selectedYear.toString()));
    
    if (dateRange.start || dateRange.end) {
        const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : new Date(0);
        const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : new Date(8640000000000000);
        
        data = data.filter(item => {
            const date = parseMockDate(item.date, selectedYear);
            if (!date) return true; 
            return date >= start && date <= end;
        });
    }
    return data;
  }, [selectedYear, dateRange]);

  const filteredJobsSold = useMemo(() => {
    let data = MOCK_REPORTS_DATA.jobsSold.filter(item => item.jobNo.startsWith(selectedYear.toString()));

    if (dateRange.start || dateRange.end) {
        const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : new Date(0);
        const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : new Date(8640000000000000);
        
        data = data.filter(item => {
            const date = parseMockDate(item.date, selectedYear);
            if (!date) return true; 
            return date >= start && date <= end;
        });
    }
    return data;
  }, [selectedYear, dateRange]);

  const estimatesTotals = useMemo(() => {
    return filteredEstimatesLog.reduce((acc, curr) => ({
        hours: acc.hours + (curr.hours || 0),
        amount: acc.amount + (curr.amount || 0),
        pending: acc.pending + (curr.pending || 0),
        wash: acc.wash + (curr.wash || 0),
        left: acc.left + (curr.left || 0)
    }), { hours: 0, amount: 0, pending: 0, wash: 0, left: 0 });
  }, [filteredEstimatesLog]);

  const jobsSoldTotals = useMemo(() => {
    return filteredJobsSold.reduce((acc, curr) => ({
        amount: acc.amount + (curr.amount || 0),
        hours: acc.hours + (curr.hours || 0),
        wash: acc.wash + (curr.wash || 0),
        left: acc.left + (curr.left || 0)
    }), { amount: 0, hours: 0, wash: 0, left: 0 });
  }, [filteredJobsSold]);

  const filteredSalesGoals = useMemo(() => {
    const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
    const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;

    return MOCK_REPORTS_DATA.salesGoals.map((goal, index) => {
      const filteredJobs = goal.jobs.filter(j => {
          let jobYear = selectedYear;
          const yearMatch = j.jobNo.match(/^(\d{4})-/);
          if (yearMatch) {
              jobYear = parseInt(yearMatch[1]);
          }
          const dateObj = parseMockDate(j.date, jobYear);
          if (!dateObj) return true; 

          if (start && dateObj < start) return false;
          if (end && dateObj > end) return false;
          
          return true;
      });
      
      const newTotal = filteredJobs.reduce((sum, job) => sum + job.amount, 0);

      return {
          ...goal,
          goal: monthlySalesGoals[index] || goal.goal,
          jobs: filteredJobs,
          total: newTotal
      };
    }).filter(g => {
        if (dateRange.start || dateRange.end) return g.jobs.length > 0;
        return g.jobs.length > 0 || g.month === 'January' || g.month === 'February';
    });
  }, [selectedYear, dateRange, monthlySalesGoals]);

  const filteredProduction = useMemo(() => {
    return MOCK_REPORTS_DATA.production.filter(item => item.date.startsWith(selectedYear.toString()));
  }, [selectedYear]);

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8 pb-32 animate-in fade-in duration-500 bg-gray-50/50 dark:bg-gray-950`}>
      <div className="mb-10 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
           <h1 className={`${Typography.h1} mb-2 text-gray-900 dark:text-white`}>{t('views.ReportsView.heading')}</h1>
           <p className={`${Typography.lead} text-gray-500 dark:text-gray-400 text-base md:text-lg`}>{t('views.ReportsView.subheading')}</p>
        </div>
        
        {/* Actions Area */}
        <div className="w-full xl:w-auto flex flex-col md:flex-row gap-4 items-start md:items-center">
            
            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 w-full md:w-auto overflow-x-auto no-scrollbar">
                <TabButton active={activeTab === 'estimates'} onClick={() => setActiveTab('estimates')} icon={FileSpreadsheet} label={t('views.ReportsView.tabEstimates')} />
                <TabButton active={activeTab === 'jobs_sold'} onClick={() => setActiveTab('jobs_sold')} icon={Briefcase} label={t('views.ReportsView.tabJobsSold')} />
                <TabButton active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={TrendingUp} label={t('views.ReportsView.tabSalesGoal')} />
                <TabButton active={activeTab === 'production'} onClick={() => setActiveTab('production')} icon={ClipboardList} label={t('views.ReportsView.tabJobsToDo')} />
                <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon={Target} label={t('views.ReportsView.tabStats')} />
            </div>
        </div>
      </div>

      {/* ESTIMATES TABLE */}
      {activeTab === 'estimates' && (
        <Card className="border-0 shadow-lg bg-white dark:bg-gray-800 overflow-visible">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 rounded-t-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full lg:w-auto">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg whitespace-nowrap">
                        {t('views.ReportsView.estimateActivityLog', { year: selectedYear })}
                    </h3>
                    <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                        <DatePicker label={t('views.ReportsView.startDate')} value={dateRange.start} onChange={(d) => setDateRange({...dateRange, start: d})} className="w-full sm:w-40" />
                        <span className="text-gray-400 hidden sm:block mb-3 font-bold">-</span>
                        <DatePicker label={t('views.ReportsView.endDate')} value={dateRange.end} onChange={(d) => setDateRange({...dateRange, end: d})} className="w-full sm:w-40" align="right" />
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <Button variant="secondary" size="sm" className="w-full lg:w-auto bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                        <Download className="w-4 h-4 mr-2" /> {t('views.ReportsView.exportCsv')}
                    </Button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-b-2xl">
                <table className="w-full text-left border-collapse">
                    {/* ... (Existing Table Header) ... */}
                    <thead>
                        <tr className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colDate')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colJobNo')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colCustomer')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colSource')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colWash')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colHours')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colHrsLeft')}</th>
                            <th className="px-4 py-4 text-right whitespace-nowrap">{t('views.ReportsView.colAmount')}</th>
                            <th className="px-4 py-4 text-right whitespace-nowrap">{t('views.ReportsView.colPending')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colStatus')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colPresent')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colEmail')}</th>
                        </tr>
                    </thead>
                    {filteredEstimatesLog.length > 0 && (
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 font-bold text-sm">
                                <td colSpan={4} className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.ReportsView.totals')}</td>
                                <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{estimatesTotals.wash > 0 ? estimatesTotals.wash : '-'}</td>
                                <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{estimatesTotals.hours.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{estimatesTotals.left.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-mono">${estimatesTotals.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 font-mono">${estimatesTotals.pending.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                <td colSpan={3}></td>
                            </tr>
                        </thead>
                    )}
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredEstimatesLog.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors group">
                                <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.date}</td>
                                <td className="px-4 py-4 text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap group-hover:text-primary-600 transition-colors">{row.jobNo}</td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.customer}</td>
                                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                        {row.source}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-sm text-center text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.wash > 0 ? row.wash : '-'}</td>
                                <td className="px-4 py-4 text-sm text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.hours}</td>
                                <td className="px-4 py-4 text-sm text-center font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.left}</td>
                                <td className="px-4 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                    ${row.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </td>
                                <td className="px-4 py-4 text-sm text-right font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {row.pending > 0 ? `$${row.pending.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                    {row.status ? (
                                        <Badge color={row.status === 'SOLD' ? 'green' : 'gray'} className="shadow-sm">
                                            {row.status}
                                        </Badge>
                                    ) : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="px-4 py-4 text-sm text-center text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.present || '-'}</td>
                                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.email || '-'}</td>
                            </tr>
                        ))}
                        {filteredEstimatesLog.length === 0 && (
                            <tr>
                                <td colSpan={12} className="px-6 py-12 text-center text-gray-400 italic">{t('views.ReportsView.noEstimates')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      )}

      {/* JOBS SOLD TABLE */}
      {activeTab === 'jobs_sold' && (
        <Card className="border-0 shadow-lg bg-white dark:bg-gray-800 overflow-visible">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 rounded-t-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full lg:w-auto">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg whitespace-nowrap">
                        {t('views.ReportsView.jobsSoldHeading', { year: selectedYear })}
                    </h3>
                    <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                        <DatePicker label={t('views.ReportsView.startDate')} value={dateRange.start} onChange={(d) => setDateRange({...dateRange, start: d})} className="w-full sm:w-40" />
                        <span className="text-gray-400 hidden sm:block mb-3 font-bold">-</span>
                        <DatePicker label={t('views.ReportsView.endDate')} value={dateRange.end} onChange={(d) => setDateRange({...dateRange, end: d})} className="w-full sm:w-40" align="right" />
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <Button variant="secondary" size="sm" className="w-full lg:w-auto bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                        <Download className="w-4 h-4 mr-2" /> {t('views.ReportsView.export')}
                    </Button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-b-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colDate')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colJobNo')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colCustomer')}</th>
                            <th className="px-4 py-4 whitespace-nowrap">{t('views.ReportsView.colSource')}</th>
                            <th className="px-4 py-4 text-right whitespace-nowrap">{t('views.ReportsView.colAmount')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colHours')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colWash')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colHrsLeft')}</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">{t('views.ReportsView.colPaid')}</th>
                        </tr>
                    </thead>
                    {filteredJobsSold.length > 0 && (
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 font-bold text-sm">
                                <td colSpan={4} className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('views.ReportsView.totals')}</td>
                                <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-mono">${jobsSoldTotals.amount.toLocaleString(undefined, {minimumFractionDigits: 0})}</td>
                                <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{jobsSoldTotals.hours.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{jobsSoldTotals.wash > 0 ? jobsSoldTotals.wash : '-'}</td>
                                <td className="px-4 py-3 text-center text-gray-900 dark:text-white">{jobsSoldTotals.left.toFixed(2)}</td>
                                <td></td>
                            </tr>
                        </thead>
                    )}
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredJobsSold.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors group">
                                <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.date}</td>
                                <td className="px-4 py-4 text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap group-hover:text-primary-600 transition-colors">{row.jobNo}</td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.customer}</td>
                                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.source}</td>
                                <td className="px-4 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                    ${row.amount.toLocaleString(undefined, {minimumFractionDigits: 0})}
                                </td>
                                <td className="px-4 py-4 text-sm text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.hours}</td>
                                <td className="px-4 py-4 text-sm text-center text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.wash}</td>
                                <td className="px-4 py-4 text-sm text-center font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.left}</td>
                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                    <Badge color={row.paid === 'Y' ? 'green' : 'red'} className="min-w-[3rem] justify-center">
                                        {row.paid === 'Y' ? t('views.ReportsView.yes') : t('views.ReportsView.no')}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                        {filteredJobsSold.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-gray-400 italic">{t('views.ReportsView.noJobsSold')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      )}

      {/* SALES GOAL */}
      {activeTab === 'sales' && (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
               <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.ReportsView.period')}</span>
                   <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                        <DatePicker label={t('views.ReportsView.startDate')} value={dateRange.start} onChange={(d) => setDateRange({...dateRange, start: d})} className="w-full sm:w-36" />
                        <span className="text-gray-400 hidden sm:block mb-3 font-bold">-</span>
                        <DatePicker label={t('views.ReportsView.endDate')} value={dateRange.end} onChange={(d) => setDateRange({...dateRange, end: d})} className="w-full sm:w-36" align="right" />
                    </div>
               </div>
               <Button variant="secondary" size="sm">
                   <Download className="w-4 h-4 mr-2" /> {t('views.ReportsView.exportYear')}
               </Button>
            </div>

            {filteredSalesGoals.map((period, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-800">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{t('views.ReportsView.monthPerformance', { month: period.month })}</h3>
                        </div>
                        <div className="flex items-center gap-6 mt-4 sm:mt-0">
                            <div className="text-right hidden sm:block">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('views.ReportsView.goal')}</div>
                                <div className="text-xl font-bold text-gray-500 dark:text-gray-400">
                                    ${period.goal.toLocaleString()}
                                </div>
                            </div>
                            <div className="text-right">
                                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('views.ReportsView.totalSold')}</div>
                                 <div className="text-2xl font-black text-gray-900 dark:text-white">
                                     ${(period.total || period.jobs.reduce((sum, j) => sum + j.amount, 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                 </div>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-gray-700 rounded-lg self-center" title={t('views.ReportsView.exportMonth', { month: period.month })}>
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 dark:border-gray-800">
                                    <th className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800">{t('views.ReportsView.colDate')}</th>
                                    <th className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800">{t('views.ReportsView.colJobId')}</th>
                                    <th className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800">{t('views.ReportsView.colCustomer')}</th>
                                    <th className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800">{t('views.ReportsView.colSource')}</th>
                                    <th className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800 text-right">{t('views.ReportsView.colAmount')}</th>
                                    <th className="px-6 py-3 bg-gray-50/50 dark:bg-gray-800 text-center">{t('views.ReportsView.colHours')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {period.jobs.map((job, jIdx) => (
                                    <tr key={jIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">{job.date}</td>
                                        <td className="px-6 py-4 text-gray-400 dark:text-gray-500 text-xs font-mono whitespace-nowrap">{job.jobNo}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">{job.customer}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 tracking-wide">
                                                {job.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white font-mono whitespace-nowrap">
                                            ${job.amount.toLocaleString(undefined, {minimumFractionDigits: 0})}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">{job.hours}</td>
                                    </tr>
                                ))}
                                {period.jobs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">{t('views.ReportsView.noSales')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* JOBS TO DO */}
      {activeTab === 'production' && (
        <Card className="border-0 shadow-lg bg-white dark:bg-gray-800 overflow-visible">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col lg:flex-row justify-between items-center gap-4 rounded-t-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full lg:w-auto">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg whitespace-nowrap">
                        {t('views.ReportsView.productionSchedule', { year: selectedYear })}
                    </h3>
                    <div className="hidden md:block h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                        <DatePicker label={t('views.ReportsView.startDate')} value={dateRange.start} onChange={(d) => setDateRange({...dateRange, start: d})} className="w-full sm:w-40" />
                        <span className="text-gray-400 hidden sm:block mb-3 font-bold">-</span>
                        <DatePicker label={t('views.ReportsView.endDate')} value={dateRange.end} onChange={(d) => setDateRange({...dateRange, end: d})} className="w-full sm:w-40" align="right" />
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
                    <Button variant="secondary" size="sm" className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                        <Download className="w-4 h-4 mr-2" /> {t('views.ReportsView.export')}
                    </Button>
                </div>
            </div>
            <div className="overflow-x-auto rounded-b-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-3 w-32">{t('views.ReportsView.colJobNo')}</th>
                            <th className="px-6 py-3">{t('views.ReportsView.colCustomer')}</th>
                            <th className="px-6 py-3 text-right">{t('views.ReportsView.colContract')}</th>
                            <th className="px-6 py-3 text-center">{t('views.ReportsView.colBudgetHrs')}</th>
                            <th className="px-6 py-3 text-center">{t('views.ReportsView.colUsed')}</th>
                            <th className="px-6 py-3 text-center">{t('views.ReportsView.colRemaining')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredProduction.map((job, idx) => {
                            const hoursUsed = job.hours - (job.left || 0);
                            const percentUsed = (hoursUsed / job.hours) * 100;
                            
                            return (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                <td className="px-6 py-4 font-mono text-xs font-bold text-gray-500 dark:text-gray-400 group-hover:text-primary-600 transition-colors">{job.date}</td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white">{job.customer}</div>
                                    <div className="text-xs text-gray-400">{job.source}</div>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                                    ${job.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-block px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 font-bold text-xs text-gray-700 dark:text-gray-300">
                                        {job.hours}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center text-sm text-gray-500">
                                    {hoursUsed}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{job.left || job.hours}</div>
                                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${percentUsed > 90 ? 'bg-red-500' : 'bg-green-500'}`} 
                                                style={{ width: `${Math.min(100, percentUsed)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )})}
                        {filteredProduction.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">{t('views.ReportsView.noProduction')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
      )}

      {/* STATS */}
      {activeTab === 'summary' && (
        <Card className="border-0 shadow-xl overflow-hidden bg-white dark:bg-gray-800">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                        {t('views.ReportsView.performanceSummary', { year: selectedYear })}
                    </h3>
                    
                    {/* SUMMARY HEADER: Annual Target vs Total */}
                    <div className="hidden md:flex items-center gap-4 px-4 border-l border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('views.ReportsView.targetRevenue')}</span>
                            <span className="font-bold text-gray-900 dark:text-white">${targetRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('views.ReportsView.goalTotal')}</span>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${currentTotalSalesGoal >= targetRevenue ? 'text-green-600' : 'text-amber-500'}`}>
                                    ${currentTotalSalesGoal.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </span>
                                {currentTotalSalesGoal < targetRevenue && (
                                    <div className="relative group flex items-center">
                                        <span className="text-[9px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1 cursor-help">
                                            <AlertCircle className="w-3 h-3" />
                                            {t('views.ReportsView.belowTarget')}
                                        </span>
                                        <div className="absolute top-full right-0 mt-1.5 w-48 p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-gray-200 dark:border-gray-700">
                                            <div className="font-bold mb-1.5 text-gray-900 dark:text-white">{t('views.ReportsView.salesGoalShortfall')}</div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-gray-500 dark:text-gray-400">{t('views.ReportsView.target')}</span>
                                                <span className="font-medium">${targetRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                            </div>
                                            <div className="flex justify-between text-amber-600 dark:text-amber-500 font-bold border-t border-gray-100 dark:border-gray-700 pt-1 mt-1">
                                                <span>{t('views.ReportsView.needed')}</span>
                                                <span>+${(targetRevenue - currentTotalSalesGoal).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('views.ReportsView.annualEstGoal')}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{annualEstimatesTarget} {t('views.ReportsView.estAbbr')}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('views.ReportsView.currentEst')}</span>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${currentTotalEstimatesSet >= annualEstimatesTarget ? 'text-green-600' : 'text-amber-500'}`}>
                                    {currentTotalEstimatesSet} {t('views.ReportsView.estAbbr')}
                                </span>
                                {currentTotalEstimatesSet < annualEstimatesTarget && (
                                    <div className="relative group flex items-center">
                                        <span className="text-[9px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1 cursor-help">
                                            <AlertCircle className="w-3 h-3" />
                                            {t('views.ReportsView.belowTarget')}
                                        </span>
                                        <div className="absolute top-full right-0 mt-1.5 w-48 p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-gray-200 dark:border-gray-700">
                                            <div className="font-bold mb-1.5 text-gray-900 dark:text-white">{t('views.ReportsView.estimatesShortfall')}</div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-gray-500 dark:text-gray-400">{t('views.ReportsView.target')}</span>
                                                <span className="font-medium">{annualEstimatesTarget} {t('views.ReportsView.estAbbr')}</span>
                                            </div>
                                            <div className="flex justify-between text-amber-600 dark:text-amber-500 font-bold border-t border-gray-100 dark:border-gray-700 pt-1 mt-1">
                                                <span>{t('views.ReportsView.needed')}</span>
                                                <span>+{(annualEstimatesTarget - currentTotalEstimatesSet)} {t('views.ReportsView.estAbbr')}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                 </div>
                 <Button variant="secondary" size="sm" className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                    <Download className="w-4 h-4 mr-2" /> {t('views.ReportsView.report')}
                 </Button>
            </div>
            
            <div className="overflow-x-auto pb-2">
                <table className="w-full text-sm text-left border-collapse">
                    <thead>
                        <tr className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <th className="p-4 text-left font-black text-gray-400 uppercase tracking-widest text-xs sticky left-0 bg-white dark:bg-gray-900 z-10 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100 dark:border-gray-800">
                                {t('views.ReportsView.metric')}
                            </th>
                            {MOCK_REPORTS_DATA.summary.months.map(m => (
                                <th key={m} className="p-3 min-w-[100px] text-center font-bold text-gray-600 dark:text-gray-300 text-xs border-l border-gray-100 dark:border-gray-800 uppercase">
                                    {m}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {/* ESTIMATES SECTION */}
                        <tr>
                            <td colSpan={13} className="p-3 pl-4 font-bold text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-white dark:bg-gray-900 sticky left-0 z-10 flex justify-between items-center pr-8">
                                <span>{t('views.ReportsView.estimatesPipeline')}</span>
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 group">
                            <td className="p-4 font-bold text-gray-900 dark:text-white text-xs sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        {t('views.ReportsView.estimateGoal')}
                                        <span className="block text-[9px] text-gray-400 font-normal mt-0.5">{t('views.ReportsView.editable')}</span>
                                    </div>
                                    <div className="relative group/info">
                                        <Info className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500 cursor-help" />
                                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 border border-gray-200 dark:border-gray-700 font-normal normal-case">
                                            <div className="font-bold mb-1">{t('views.ReportsView.goalCalculation')}</div>
                                            <p className="text-gray-500 dark:text-gray-400 mb-2">
                                                {t('views.ReportsView.goalCalcDesc')} <strong>${(avgJobSize * (closingRate / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}</strong> {t('views.ReportsView.goalCalcDescSuffix')}
                                            </p>
                                            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-700 space-y-1">
                                                <div className="flex justify-between"><span>{t('views.ReportsView.avgJobSize')}</span> <strong>${avgJobSize.toLocaleString()}</strong></div>
                                                <div className="flex justify-between"><span>{t('views.ReportsView.closeRate')}</span> <strong>{closingRate}%</strong></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            {monthlyEstimateGoals.map((v, i) => (
                                <td key={i} className="p-1 text-center border-l border-gray-50 dark:border-gray-800 relative">
                                    <input 
                                        type="text" 
                                        value={v}
                                        onChange={(e) => handleEstimateGoalChange(i, e.target.value)}
                                        className="w-full h-full text-center bg-transparent font-bold text-blue-600 dark:text-blue-400 focus:bg-blue-50 dark:focus:bg-blue-900/30 outline-none rounded transition-colors text-xs py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer focus:ring-2 ring-inset ring-blue-200"
                                    />
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="p-4 font-bold text-gray-900 dark:text-white text-xs sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700">{t('views.ReportsView.estimatesDone')}</td>
                            {MOCK_REPORTS_DATA.summary.estimates.done.map((v, i) => (
                                <td key={i} className="p-3 text-center text-gray-400 italic text-xs border-l border-gray-50 dark:border-gray-800">{v}</td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="p-4 font-bold text-gray-900 dark:text-white text-xs sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{t('views.ReportsView.jobsSoldRow')}</td>
                            {MOCK_REPORTS_DATA.summary.estimates.sold.map((v, i) => (
                                <td key={i} className="p-3 text-center font-bold text-gray-900 dark:text-white text-xs border-l border-gray-100 dark:border-gray-700">{v}</td>
                            ))}
                        </tr>

                        {/* SALES SECTION */}
                        <tr className="border-t border-gray-200 dark:border-gray-700">
                            <td colSpan={13} className="p-3 pl-4 font-bold text-[10px] text-green-600 dark:text-green-400 uppercase tracking-widest bg-white dark:bg-gray-900 sticky left-0 z-10">
                                {t('views.ReportsView.revenuePerformance')}
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 group">
                            <td className="p-4 font-bold text-gray-900 dark:text-white text-xs sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        {t('views.ReportsView.salesGoal')}
                                        <span className="block text-[9px] text-gray-400 font-normal mt-0.5">{t('views.ReportsView.editable')}</span>
                                    </div>
                                    <div className="relative group/info">
                                        <Info className="w-3.5 h-3.5 text-gray-400 hover:text-green-500 cursor-help" />
                                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 border border-gray-200 dark:border-gray-700 font-normal normal-case">
                                            <div className="font-bold mb-1">{t('views.ReportsView.goalCalculation')}</div>
                                            <p className="text-gray-500 dark:text-gray-400 mb-2">
                                                {t('views.ReportsView.goalCalcDesc')} <strong>${(avgJobSize * (closingRate / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}</strong> {t('views.ReportsView.goalCalcDescSuffix')}
                                            </p>
                                            <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-700 space-y-1">
                                                <div className="flex justify-between"><span>{t('views.ReportsView.avgJobSize')}</span> <strong>${avgJobSize.toLocaleString()}</strong></div>
                                                <div className="flex justify-between"><span>{t('views.ReportsView.closeRate')}</span> <strong>{closingRate}%</strong></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            {monthlySalesGoals.map((v, i) => (
                                <td key={i} className="p-1 text-center border-l border-gray-50 dark:border-gray-800 relative">
                                    <input 
                                        type="text" 
                                        value={`$${v.toLocaleString()}`}
                                        onChange={(e) => handleSalesGoalChange(i, e.target.value)}
                                        className="w-full h-full text-center bg-transparent font-bold text-green-600 dark:text-green-400 focus:bg-green-50 dark:focus:bg-green-900/30 outline-none rounded transition-colors text-xs py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer focus:ring-2 ring-inset ring-green-200"
                                    />
                                </td>
                            ))}
                        </tr>
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="p-4 font-bold text-gray-900 dark:text-white text-xs sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{t('views.ReportsView.actualSold')}</td>
                            {MOCK_REPORTS_DATA.summary.sold.map((v, i) => (
                                <td key={i} className="p-3 text-center font-bold text-gray-900 dark:text-white text-xs border-l border-gray-100 dark:border-gray-700">
                                    {formatCompactCurrency(v)}
                                </td>
                            ))}
                        </tr>
                        <tr className="border-t border-gray-100 dark:border-gray-700">
                            <td className="p-4 font-bold text-gray-900 dark:text-white text-xs sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700">{t('views.ReportsView.differential')}</td>
                            {salesDiffs.map((v, i) => (
                                <td key={i} className={`p-3 text-center font-bold text-xs border-l border-white ${v < 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : v > 0 ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-gray-300'}`}>
                                    {v !== 0 ? `${v > 0 ? '+' : ''}${formatCompactCurrency(v)}` : '-'}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </Card>
      )}
    </div>
  );
};
