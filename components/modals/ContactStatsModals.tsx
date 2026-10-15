
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Modal, Button } from '../UI';
import { ArrowUpRight, Calendar, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface JobData {
  id: string;
  jobId: string;
  title: string;
  address: string;
  status: string;
  stageIndex: number;
  created: string;
  amount: number;
  statusColor: string;
}

interface ActiveProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobData[];
  onViewJob: (id: string) => void;
}

export const ActiveProjectsModal = ({ isOpen, onClose, jobs, onViewJob }: ActiveProjectsModalProps) => {
  const { t } = useTranslation();
  const activeJobs = jobs.filter(job => job.status !== 'Paid' && job.status !== 'Closed');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.ContactStatsModals.activeProjects')}>
      <div className="space-y-4">
        {activeJobs.map((job) => (
          <div key={job.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">{job.title}</h4>
              <span className={`px-2 py-1 rounded text-xs font-bold border ${job.statusColor}`}>
                {job.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">{job.address}</div>
            
            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                <span>{t('modals.ContactStatsModals.progress')}</span>
                <span>60%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-primary-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => onViewJob(job.id)}>
                {t('modals.ContactStatsModals.viewFullDetails')} <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
        
        {activeJobs.length === 0 && (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 font-medium">{t('modals.ContactStatsModals.noActiveProjects')}</p>
          </div>
        )}
        
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="ghost">{t('modals.ContactStatsModals.close')}</Button>
        </div>
      </div>
    </Modal>
  );
};

interface LifetimeValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobData[];
}

type FilterType = 'All Time' | 'This Year' | 'Last Year' | 'This Month' | 'This Week' | 'Custom';

export const LifetimeValueModal = ({ isOpen, onClose, jobs }: LifetimeValueModalProps) => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<FilterType>('All Time');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter jobs based on selected time range
  const filteredJobs = useMemo(() => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Calculate start of current week (Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      return jobs.filter(job => {
          const jobDate = new Date(job.created);
          
          switch (filterType) {
              case 'All Time': 
                  return true;
              case 'This Year': 
                  return jobDate.getFullYear() === currentYear;
              case 'Last Year': 
                  return jobDate.getFullYear() === currentYear - 1;
              case 'This Month': 
                  return jobDate.getMonth() === currentMonth && jobDate.getFullYear() === currentYear;
              case 'This Week': 
                  return jobDate >= startOfWeek;
              case 'Custom': 
                  if (!customRange.start && !customRange.end) return true;
                  const start = customRange.start ? new Date(customRange.start) : new Date(0);
                  const end = customRange.end ? new Date(customRange.end) : new Date(8640000000000000);
                  // Set end date to end of day
                  end.setHours(23, 59, 59, 999);
                  return jobDate >= start && jobDate <= end;
              default: 
                  return true;
          }
      });
  }, [jobs, filterType, customRange]);

  const totalRevenue = filteredJobs.reduce((sum, job) => sum + job.amount, 0);
  const totalJobs = filteredJobs.length;

  const filterOptions: FilterType[] = ['All Time', 'This Year', 'Last Year', 'This Month', 'This Week', 'Custom'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.ContactStatsModals.valueBreakdown')}>
      <div className="space-y-6">
        
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('modals.ContactStatsModals.filterPeriod')}</span>
            </div>
            
            {/* Custom Dropdown Selector */}
            <div className="relative" ref={filterRef}>
                <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <span>{filterType}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {filterOptions.map((option) => (
                            <button
                                key={option}
                                onClick={() => {
                                    setFilterType(option);
                                    setIsFilterOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between transition-colors ${
                                    filterType === option 
                                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200' 
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {option}
                                {filterType === option && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Custom Date Inputs - Redesigned */}
            {filterType === 'Custom' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-1">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">{t('modals.ContactStatsModals.startDate')}</label>
                        <div className="relative group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 transition-all shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="h-4 w-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                            </div>
                            <input 
                                type="date" 
                                className="block w-full pl-10 pr-3 py-2.5 bg-transparent rounded-xl text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                                value={customRange.start}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">{t('modals.ContactStatsModals.endDate')}</label>
                        <div className="relative group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10 transition-all shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="h-4 w-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                            </div>
                            <input 
                                type="date" 
                                className="block w-full pl-10 pr-3 py-2.5 bg-transparent rounded-xl text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                                value={customRange.end}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="flex justify-between items-end bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-100 dark:border-green-800 transition-all">
          <div>
            <h4 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">{filterType === 'Custom' ? t('modals.ContactStatsModals.customRange') : filterType} {t('modals.ContactStatsModals.revenue')}</h4>
            <p className="text-4xl font-black text-green-900 dark:text-green-200 tracking-tight">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-800 dark:text-green-300">{totalJobs} {t('modals.ContactStatsModals.jobs')}</p>
            <p className="text-xs text-green-600 dark:text-green-500 font-medium uppercase tracking-wide">{t('modals.ContactStatsModals.count')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">{t('modals.ContactStatsModals.transactionHistory')}</h4>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm max-h-[300px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('modals.ContactStatsModals.date')}</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('modals.ContactStatsModals.project')}</th>
                  <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">{t('modals.ContactStatsModals.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{job.created}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{job.title}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      ${job.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 italic">{t('modals.ContactStatsModals.noTransactions')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>{t('modals.ContactStatsModals.close')}</Button>
        </div>
      </div>
    </Modal>
  );
};
