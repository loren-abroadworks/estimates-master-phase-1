
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Plus, Search, Filter, FileText, Calendar, DollarSign, User, 
  ChevronRight, Clock, Archive, Trash2, MoreVertical, CheckCircle2, 
  AlertCircle, ArrowUpRight, ChevronDown, ArrowDownAZ, Copy, Send, PieChart, ClipboardList, X, Edit2
} from 'lucide-react';
import { Button, Badge, Card, SearchInput, KebabMenu } from '../UI';
import { DatePicker } from '../ui/DatePicker';
import { EstimatesListModal } from '../modals/EstimatesListModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { CreateEstimateModal } from '../modals/CreateEstimateModal';
import { Typography, Spacing } from '../../theme/designSystem';
import { ConfiguredScope, Estimate } from '../../types';
import { getSelectedPackage } from '../../services/packages';

export const EstimatesDashboardView = ({ 
  onCreateNew,
  onEditEstimate,
  scopes,
  templates,
  estimates = [],
  onApproveEstimate
}: { 
  onCreateNew: (data: any) => void;
  onEditEstimate: (id: string) => void;
  scopes?: ConfiguredScope[];
  templates?: any[];
  estimates?: Estimate[];
  onApproveEstimate?: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  
  // View State
  const [statusFilter, setStatusFilter] = useState<string>('All Active');
  const [sortOption, setSortOption] = useState<'Date' | 'Amount' | 'Name'>('Date');
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [estimateToDelete, setEstimateToDelete] = useState<string | null>(null);
  
  // Date Filters
  const [dateFilterLabel, setDateFilterLabel] = useState('All Time');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Dropdown States
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const dateFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setIsDateFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDeleteClick = (id: string) => {
    setEstimateToDelete(id);
  };

  const confirmDelete = () => {
    if (estimateToDelete) {
        // onDeleteEstimate(estimateToDelete); // Need to add this prop if deletion is supported here
        setEstimateToDelete(null);
    }
  };

  const handleDatePreset = (preset: 'All Time' | 'This Month' | 'Last Month' | 'This Year') => {
      const now = new Date();
      let start = '';
      let end = '';
      
      if (preset === 'This Month') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          start = firstDay.toISOString().split('T')[0];
          end = lastDay.toISOString().split('T')[0];
      } else if (preset === 'Last Month') {
          const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
          start = firstDay.toISOString().split('T')[0];
          end = lastDay.toISOString().split('T')[0];
      } else if (preset === 'This Year') {
          const firstDay = new Date(now.getFullYear(), 0, 1);
          const lastDay = new Date(now.getFullYear(), 11, 31);
          start = firstDay.toISOString().split('T')[0];
          end = lastDay.toISOString().split('T')[0];
      }

      setStartDate(start);
      setEndDate(end);
      setDateFilterLabel(preset);
      setIsDateFilterOpen(false);
  };

  // --- Filtering & Sorting ---

  const filteredEstimates = useMemo(() => {
    let result = estimates.filter(est => {
      const clientName = `${est.customer.firstName} ${est.customer.lastName}`;
      const estNumber = est.projectInfo.number;
      const projName = est.projectName || est.projectInfo.name;
      const term = searchTerm.toLowerCase();

      const matchesSearch = (
        clientName.toLowerCase().includes(term) || 
        estNumber.toLowerCase().includes(term) ||
        projName.toLowerCase().includes(term)
      );

      // Date Range Filter
      const estDate = new Date(est.projectInfo.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      // Adjust end date to include the full day
      if (end) end.setHours(23, 59, 59, 999);

      const matchesDate = (!start || estDate >= start) && (!end || estDate <= end);

      return matchesSearch && matchesDate;
    });

    // Status Filter
    if (statusFilter === 'All Active') {
        result = result.filter(e => e.status !== 'Archived' && e.status !== 'Lost');
    } else if (statusFilter === 'Archived') {
        result = result.filter(e => e.status === 'Archived' || e.status === 'Lost');
    } else {
        result = result.filter(e => e.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
        if (sortOption === 'Amount') return (getSelectedPackage(b).financials?.baseGrandTotal || 0) - (getSelectedPackage(a).financials?.baseGrandTotal || 0);
        if (sortOption === 'Name') return (a.projectName || '').localeCompare(b.projectName || '');
        // Default Date Descending
        return new Date(b.projectInfo.date).getTime() - new Date(a.projectInfo.date).getTime();
    });

    return result;
  }, [estimates, searchTerm, statusFilter, sortOption, startDate, endDate]);

  // --- Statistics ---
  const stats = useMemo(() => {
      const active = estimates.filter(e => e.status !== 'Archived' && e.status !== 'Lost');
      return {
          drafts: active.filter(e => e.status === 'Draft').length,
          sent: active.filter(e => e.status === 'Sent').length,
          approved: active.filter(e => e.status === 'Approved' || e.status === 'Paid').length,
          totalValue: active.reduce((sum, e) => sum + (getSelectedPackage(e).financials?.baseGrandTotal || 0), 0)
      };
  }, [estimates]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Draft': return 'gray';
      case 'Sent': return 'blue';
      case 'Approved': return 'green';
      case 'Paid': return 'green'; // Reusing green for Paid but could be distinct
      case 'Archived': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'Sent': return <Send className="w-3 h-3 mr-1" />;
          case 'Approved': return <CheckCircle2 className="w-3 h-3 mr-1" />;
          case 'Paid': return <DollarSign className="w-3 h-3 mr-1" />;
          default: return null;
      }
  };

  const getScopeName = (scopeId: string) => {
      const scope = scopes?.find(s => s.id === scopeId);
      if (scope) return scope.name;
      // Fallback formatting
      if (scopeId.includes('int')) return 'Interior';
      if (scopeId.includes('ext')) return 'Exterior';
      if (scopeId.includes('cab')) return 'Cabinets';
      return scopeId;
  }

  const getModalData = () => {
      if (!activeStatFilter) return [];
      const active = estimates.filter(e => e.status !== 'Archived' && e.status !== 'Lost');
      
      // Need to map to simplified summary for modal
      const mapToSummary = (list: Estimate[]) => list.map(e => ({
          id: e.id,
          number: e.projectInfo.number,
          name: e.projectName,
          client: `${e.customer.firstName} ${e.customer.lastName}`,
          date: e.projectInfo.date,
          total: getSelectedPackage(e).financials?.baseGrandTotal,
          status: e.status,
          type: getSelectedPackage(e).scopeId // Simplified
      }));

      if (activeStatFilter === 'Drafts') return mapToSummary(active.filter(e => e.status === 'Draft'));
      if (activeStatFilter === 'Sent') return mapToSummary(active.filter(e => e.status === 'Sent'));
      if (activeStatFilter === 'Approved') return mapToSummary(active.filter(e => e.status === 'Approved' || e.status === 'Paid'));
      if (activeStatFilter === 'Pipeline') return mapToSummary(active);
      
      return [];
  };

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      
      <EstimatesListModal 
        isOpen={!!activeStatFilter}
        onClose={() => setActiveStatFilter(null)}
        title={activeStatFilter === 'Pipeline' ? t('views.EstimatesDashboardView.activePipeline') : t('views.EstimatesDashboardView.filterEstimatesTitle', { filter: activeStatFilter ?? '' })}
        estimates={getModalData()}
        onViewEstimate={(id) => {
            setActiveStatFilter(null);
            onEditEstimate(id);
        }}
      />

      <ConfirmationModal 
        isOpen={!!estimateToDelete}
        onClose={() => setEstimateToDelete(null)}
        onConfirm={confirmDelete}
        title={t('views.EstimatesDashboardView.deleteEstimateTitle')}
        message={t('views.EstimatesDashboardView.deleteEstimateMessage')}
        confirmLabel={t('views.EstimatesDashboardView.deleteEstimateTitle')}
      />
      
      <CreateEstimateModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(data) => {
            setIsCreateModalOpen(false);
            onCreateNew(data);
        }}
        scopes={scopes}
        templates={templates}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className={`${Typography.h1} mb-4`}>{t('views.EstimatesDashboardView.heading')}</h1>
          <p className={Typography.lead}>{t('views.EstimatesDashboardView.subheading')}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto" id="create-estimate-btn">
            <Button onClick={() => setIsCreateModalOpen(true)} size="lg" className="w-full md:w-auto shadow-xl shadow-primary-500/20">
                <Plus className="w-5 h-5" /> {t('views.EstimatesDashboardView.createNewEstimate')}
            </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { id: 'Drafts', label: t('views.EstimatesDashboardView.statDraftProposals'), value: stats.drafts, icon: FileText, subtext: t('views.EstimatesDashboardView.statInProgress') },
          { id: 'Sent', label: t('views.EstimatesDashboardView.statSentPending'), value: stats.sent, icon: Clock, subtext: t('views.EstimatesDashboardView.statAwaitingApproval') },
          { id: 'Approved', label: t('views.EstimatesDashboardView.statApproved'), value: stats.approved, icon: CheckCircle2, subtext: t('views.EstimatesDashboardView.statReadyForWork') },
          { id: 'Pipeline', label: t('views.EstimatesDashboardView.statPipelineValue'), value: `$${(stats.totalValue / 1000).toFixed(1)}k`, icon: DollarSign, subtext: t('views.EstimatesDashboardView.statTotalActiveValue') },
        ].map((stat, i) => (
          <div 
            key={i} 
            onClick={() => setActiveStatFilter(stat.id)}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500 transition-all cursor-pointer group"
          >
             <div className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400`}>
                <stat.icon className={`w-4 h-4 text-gray-400`} /> {stat.label}
             </div>
             <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">{stat.value}</div>
             <div className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 font-medium mt-1 flex items-center gap-1">
                 {stat.subtext} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-6">
           <SearchInput 
              value={searchTerm} 
              onChange={setSearchTerm} 
              placeholder={t('views.EstimatesDashboardView.searchPlaceholder')}
              className="w-full lg:w-80"
           />
           
           <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto relative z-20">
               
               {/* Unified Date Range Dropdown */}
               <div className="relative" ref={dateFilterRef}>
                  <button
                    onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[180px] justify-between h-[42px]"
                  >
                     <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" /> 
                        {dateFilterLabel === 'Custom' ? (startDate && endDate ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` : t('views.EstimatesDashboardView.customRange')) : dateFilterLabel}
                     </span>
                     <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isDateFilterOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDateFilterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                            {['All Time', 'This Month', 'Last Month', 'This Year'].map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => handleDatePreset(preset as any)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${dateFilterLabel === preset ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('views.EstimatesDashboardView.customRange')}</span>
                            <div className="space-y-3">
                                <DatePicker value={startDate} onChange={(d) => { setStartDate(d); setDateFilterLabel('Custom'); }} label="From" />
                                <DatePicker value={endDate} onChange={(d) => { setEndDate(d); setDateFilterLabel('Custom'); }} label="To" />
                            </div>
                        </div>
                    </div>
                  )}
               </div>

               <div className="flex gap-2 w-full md:w-auto mt-auto">
                   {/* Filter Dropdown */}
                   <div className="relative" ref={filterMenuRef}>
                       <button 
                           onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                           className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[140px] justify-between h-[42px]"
                       >
                           <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /> {statusFilter}</span>
                           <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                       </button>
                       {isFilterMenuOpen && (
                           <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                               {['All Active', 'Draft', 'Sent', 'Approved', 'Paid', 'Archived'].map(opt => (
                                   <button 
                                       key={opt}
                                       onClick={() => { setStatusFilter(opt); setIsFilterMenuOpen(false); }}
                                       className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${statusFilter === opt ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-700 dark:text-gray-300'}`}
                                   >
                                       {opt}
                                       {statusFilter === opt && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                                   </button>
                               ))}
                           </div>
                       )}
                   </div>

                   {/* Sort Dropdown */}
                   <div className="relative" ref={sortMenuRef}>
                       <button 
                           onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                           className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[140px] justify-between h-[42px]"
                       >
                           <span className="flex items-center gap-2">
                               {sortOption === 'Date' && <Calendar className="w-4 h-4 text-gray-400" />}
                               {sortOption === 'Amount' && <DollarSign className="w-4 h-4 text-gray-400" />}
                               {sortOption === 'Name' && <ArrowDownAZ className="w-4 h-4 text-gray-400" />}
                               {t('views.EstimatesDashboardView.sortLabel', { option: sortOption })}
                           </span>
                           <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
                       </button>
                       {isSortMenuOpen && (
                           <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                               <button onClick={() => { setSortOption('Date'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sortOption === 'Date' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                                   <Calendar className="w-3.5 h-3.5" /> {t('views.EstimatesDashboardView.sortDateNewest')}
                               </button>
                               <button onClick={() => { setSortOption('Amount'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sortOption === 'Amount' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                                   <DollarSign className="w-3.5 h-3.5" /> {t('views.EstimatesDashboardView.sortAmountHighLow')}
                               </button>
                               <button onClick={() => { setSortOption('Name'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sortOption === 'Name' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                                   <ArrowDownAZ className="w-3.5 h-3.5" /> {t('views.EstimatesDashboardView.sortClientName')}
                               </button>
                           </div>
                       )}
                   </div>
               </div>
           </div>
      </div>

      {/* Estimates List */}
      <div className="space-y-3">
          {filteredEstimates.map(est => {
              const clientName = `${est.customer.firstName} ${est.customer.lastName}`;
              const date = new Date(est.projectInfo.date);
              
              return (
              <React.Fragment key={est.id}>
                {/* --- MOBILE CARD DESIGN (Left Aligned List Style) --- */}
                <div 
                    onClick={() => onEditEstimate(est.id)}
                    className="md:hidden bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm relative cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 transition-colors"
                >
                    <div className="flex gap-4">
                        {/* Date Block - Left Aligned */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 flex flex-col items-center justify-center w-14 h-14 shrink-0">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-none">{date.toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                            <span className="text-xl font-black text-gray-900 dark:text-white leading-none mt-0.5">{date.getDate()}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-tight truncate pr-2">{est.projectName || t('views.EstimatesDashboardView.untitledProject')}</h3>
                                <div onClick={e => e.stopPropagation()}>
                                    <KebabMenu 
                                        items={[
                                            { label: t('views.EstimatesDashboardView.menuViewEstimate'), icon: Edit2, onClick: () => onEditEstimate(est.id) },
                                            ...(est.status === 'Sent' && onApproveEstimate ? [{
                                                label: t('views.EstimatesDashboardView.menuMarkApproved'),
                                                icon: CheckCircle2,
                                                onClick: () => onApproveEstimate(est.id),
                                                className: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                            }] : []),
                                            { label: t('views.EstimatesDashboardView.menuDuplicate'), icon: Copy, onClick: () => { /* Handle Duplicate */ } },
                                            { label: t('views.EstimatesDashboardView.menuDelete'), icon: Trash2, onClick: () => handleDeleteClick(est.id), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                                        ]}
                                    />
                                </div>
                            </div>
                            
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                                <span className="font-mono font-bold text-gray-400 dark:text-gray-500 mr-2">{est.projectInfo.number}</span>
                                {clientName}
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                                <Badge color={getStatusColor(est.status) as any} className="text-[10px] px-2 py-0.5">
                                    {est.status}
                                </Badge>
                                <span className="text-sm font-black text-gray-900 dark:text-white">
                                    ${(getSelectedPackage(est).financials?.baseGrandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- DESKTOP ROW DESIGN --- */}
                <div 
                    onClick={() => onEditEstimate(est.id)}
                    className={`hidden md:flex bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500 transition-all cursor-pointer group relative overflow-hidden items-center gap-6 ${
                        est.status === 'Archived' ? 'opacity-75 border-dashed bg-gray-50 dark:bg-gray-900' : ''
                    }`}
                >
                    {/* Compact Date Block */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 shrink-0">
                        <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-none mt-1">{date.toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                        <span className="text-xl font-black text-gray-900 dark:text-white leading-none my-0.5">{date.getDate()}</span>
                        <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 leading-none mb-1">{date.getFullYear()}</span>
                    </div>
                    
                    {/* Main Info */}
                    <div className="flex-1 min-w-0 w-full text-left">
                        <h3 className={`font-bold text-gray-900 dark:text-white text-base mb-1 truncate transition-colors ${est.status === 'Archived' ? 'text-gray-500 dark:text-gray-500 line-through' : 'group-hover:text-primary-700 dark:group-hover:text-primary-400'}`}>
                            {est.projectName || t('views.EstimatesDashboardView.untitledProject')}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono font-medium border border-gray-200 dark:border-gray-600">
                                {est.projectInfo.number}
                            </span>
                            <span>•</span>
                            <span className="font-medium">{clientName}</span>
                        </div>
                    </div>

                    {/* Columns */}
                    <div className="w-auto flex items-center justify-end gap-8 pt-0 border-t-0 border-gray-100 dark:border-gray-700">
                        
                        {/* Status */}
                        <div className="flex flex-col gap-1 w-24">
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('views.EstimatesDashboardView.colStatus')}</span>
                            <Badge color={getStatusColor(est.status) as any} className="flex w-fit items-center px-2 py-0.5 text-[10px]">
                                {getStatusIcon(est.status)}
                                {est.status}
                            </Badge>
                        </div>

                        {/* Type */}
                        <div className="hidden lg:flex flex-col gap-1 w-24">
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('views.EstimatesDashboardView.colType')}</span>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{getScopeName(getSelectedPackage(est).scopeId)}</span>
                        </div>

                        {/* Value */}
                        <div className="flex flex-col gap-1 w-28 text-right">
                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('views.EstimatesDashboardView.colTotalValue')}</span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">
                                ${(getSelectedPackage(est).financials?.baseGrandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pl-4 border-l border-gray-100 dark:border-gray-700">
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={(e) => { e.stopPropagation(); onEditEstimate(est.id); }} 
                                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold px-3 h-8 shadow-sm text-xs"
                            >
                                {t('views.EstimatesDashboardView.viewButton')}
                            </Button>
                            <div onClick={e => e.stopPropagation()}>
                                <KebabMenu 
                                    items={[
                                        ...(est.status === 'Sent' && onApproveEstimate ? [{
                                            label: t('views.EstimatesDashboardView.menuMarkApproved'),
                                            icon: CheckCircle2,
                                            onClick: () => onApproveEstimate(est.id),
                                            className: 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                        }] : []),
                                        { label: t('views.EstimatesDashboardView.menuDuplicate'), icon: Copy, onClick: () => { /* Handle Duplicate */ } },
                                        { label: t('views.EstimatesDashboardView.menuDelete'), icon: Trash2, onClick: () => handleDeleteClick(est.id), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>
              </React.Fragment>
          )})}
          
          {filteredEstimates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                      <ClipboardList className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('views.EstimatesDashboardView.emptyStateHeading')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">{t('views.EstimatesDashboardView.emptyStateSubtext')}</p>
                  <Button onClick={() => setIsCreateModalOpen(true)}>{t('views.EstimatesDashboardView.createNewEstimate')}</Button>
              </div>
          )}
      </div>
    </div>
  );
};
