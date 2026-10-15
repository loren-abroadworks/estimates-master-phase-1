
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Search, Filter, Calendar, CheckCircle2, Clock, PlayCircle, 
  ChevronRight, User, MapPin, MoreVertical, ArrowUpRight, 
  Plus, DollarSign, ArrowDownAZ, ChevronDown, ClipboardList, Trash2 
} from 'lucide-react';
import { Button, Card, Badge, SearchInput, KebabMenu } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { WorkOrder, CrewMember } from '../../types';
import { WorkOrdersListModal } from '../modals/WorkOrdersListModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { EditWorkOrderDetailsModal } from '../modals/EditWorkOrderDetailsModal';
import { CrewSelectionModal } from '../modals/CrewSelectionModal';

interface WorkOrdersDashboardViewProps {
  workOrders: WorkOrder[];
  employees: CrewMember[];
  onViewWorkOrder: (id: string) => void;
}

export const WorkOrdersDashboardView = ({ 
  workOrders,
  employees,
  onViewWorkOrder 
}: WorkOrdersDashboardViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Active');
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  
  // Note: Delete is now handled in the detail view or requires lifting handler to App level for list deletion.
  
  // Dropdown State
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pending Deposit': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Unscheduled': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Scheduled': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Completed': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const filteredOrders = useMemo(() => {
      let result = workOrders.filter(wo => 
        (wo.jobName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (wo.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wo.id || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (statusFilter !== 'All Active') {
          if (statusFilter === 'Completed') {
              result = result.filter(wo => wo.status === 'Completed');
          } else if (statusFilter === 'In Progress') {
              result = result.filter(wo => wo.status === 'In Progress');
          } else if (statusFilter === 'Scheduled') {
              result = result.filter(wo => wo.status === 'Scheduled');
          } else if (statusFilter === 'Unscheduled') {
              result = result.filter(wo => wo.status === 'Unscheduled');
          } else if (statusFilter === 'Pending Deposit') {
              result = result.filter(wo => wo.status === 'Pending Deposit');
          }
      }

      return result;
  }, [searchTerm, statusFilter, workOrders]);

  const stats = {
      scheduled: workOrders.filter(w => w.status === 'Scheduled').length,
      inProgress: workOrders.filter(w => w.status === 'In Progress').length,
      completed: workOrders.filter(w => w.status === 'Completed').length,
      totalHours: workOrders.reduce((acc, w) => acc + (w.totalProductionHours || 0), 0)
  };

  const getModalData = () => {
      if (!activeStatFilter) return [];
      if (activeStatFilter === 'Total Hours') return workOrders; // Show all for total hours
      return workOrders.filter(w => w.status === activeStatFilter);
  };

  // --- Handlers for Row Actions ---
  const handleOpenSchedule = (wo: any) => {
      onViewWorkOrder(wo.id);
  };

  const handleOpenCrew = (wo: any) => {
      onViewWorkOrder(wo.id);
  };

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      
      <WorkOrdersListModal 
        isOpen={!!activeStatFilter}
        onClose={() => setActiveStatFilter(null)}
        title={activeStatFilter ? `${activeStatFilter} Work Orders` : 'Work Orders'}
        workOrders={getModalData()}
        onViewWorkOrder={(id) => {
            setActiveStatFilter(null);
            onViewWorkOrder(id);
        }}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className={`${Typography.h1} mb-4`}>{t('views.WorkOrdersDashboardView.workOrders')}</h1>
          <p className={Typography.lead}>{t('views.WorkOrdersDashboardView.trackProduction')}</p>
        </div>
      </div>

      {/* Statistics Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { id: 'Scheduled', label: t('views.WorkOrdersDashboardView.scheduledJobs'), value: stats.scheduled, icon: Calendar, subtext: t('views.WorkOrdersDashboardView.upcomingStarts') },
          { id: 'In Progress', label: t('views.WorkOrdersDashboardView.inProgress'), value: stats.inProgress, icon: PlayCircle, subtext: t('views.WorkOrdersDashboardView.crewsOnsite') },
          { id: 'Completed', label: t('views.WorkOrdersDashboardView.completed'), value: stats.completed, icon: CheckCircle2, subtext: t('views.WorkOrdersDashboardView.readyForInvoice') },
          { id: 'Total Hours', label: t('views.WorkOrdersDashboardView.totalHours'), value: stats.totalHours, icon: Clock, subtext: t('views.WorkOrdersDashboardView.allocatedHours') },
        ].map((stat, i) => (
          <div 
            key={i} 
            onClick={() => setActiveStatFilter(stat.id)}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all cursor-pointer group"
          >
             <div className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400`}>
                <stat.icon className={`w-4 h-4 text-gray-400`} /> {stat.label}
             </div>
             <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">{stat.value}</div>
             <div className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-primary-500 font-medium mt-1 flex items-center gap-1">
                 {stat.subtext} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
           <SearchInput 
              value={searchTerm} 
              onChange={setSearchTerm} 
              placeholder={t('views.WorkOrdersDashboardView.searchPlaceholder')}
              className="w-full md:w-96"
           />
           <div className="flex gap-2 w-full md:w-auto relative z-20">
               <div className="relative" ref={filterMenuRef}>
                   <button 
                       onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                       className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[140px] justify-between"
                   >
                       <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /> {statusFilter}</span>
                       <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                   </button>
                   {isFilterMenuOpen && (
                       <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                           {['All Active', 'Pending Deposit', 'Unscheduled', 'Scheduled', 'In Progress', 'Completed'].map(opt => (
                               <button 
                                   key={opt}
                                   onClick={() => { setStatusFilter(opt); setIsFilterMenuOpen(false); }}
                                   className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${statusFilter === opt ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                               >
                                   {opt}
                                   {statusFilter === opt && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                               </button>
                           ))}
                       </div>
                   )}
               </div>
           </div>
      </div>

      {/* Work Orders List - Card Style */}
      <div className="space-y-4">
          {filteredOrders.map((wo) => {
              // Lookup Crew Lead Name
              const crewLeadName = wo.crewLeaderId 
                  ? (employees.find(e => e.id === wo.crewLeaderId)?.name || wo.crewLeaderId)
                  : t('views.WorkOrdersDashboardView.unassigned');

              return (
              <div 
                  key={wo.id} 
                  onClick={() => onViewWorkOrder(wo.id || '')}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500 transition-all cursor-pointer group relative overflow-hidden"
              >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                      
                      {/* Identity Column */}
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(wo.status || 'Pending Deposit')}`}>
                                  {wo.status}
                              </span>
                              <span className="text-xs font-mono font-bold text-gray-400">{wo.id}</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors mb-1">
                              {wo.jobName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <User className="w-3.5 h-3.5" /> {wo.customerName}
                          </div>
                      </div>

                      {/* Location & Dates Column */}
                      <div className="flex-1 lg:border-l lg:border-r border-gray-100 dark:border-gray-700 lg:px-6 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              <span className="truncate">{wo.jobAddress || t('views.WorkOrdersDashboardView.noAddressSet')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {t('views.WorkOrdersDashboardView.startDate', { date: wo.startDate ? new Date(wo.startDate).toLocaleDateString() : t('views.WorkOrdersDashboardView.tbd') })}
                          </div>
                      </div>

                      {/* Crew & Hours Column */}
                      <div className="flex-none lg:w-48">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{t('views.WorkOrdersDashboardView.crewLead')}</div>
                          <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600 text-gray-500 shadow-sm shrink-0">
                                  {wo.crewLeaderId ? crewLeadName.charAt(0) : <User className="w-4 h-4" />}
                              </div>
                              <div className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
                                  {crewLeadName}
                              </div>
                          </div>
                      </div>

                      {/* Actions Column */}
                      <div className="flex items-center gap-4 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100 dark:border-gray-700 mt-2 lg:mt-0 justify-between lg:justify-end lg:pl-4">
                          <div className="text-right mr-2 hidden lg:block">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('views.WorkOrdersDashboardView.estHours')}</div>
                              <div className="text-base font-black text-gray-900 dark:text-white">{wo.totalProductionHours?.toFixed(1) || 0}</div>
                          </div>
                          
                          <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onViewWorkOrder(wo.id || ''); }}>
                                  {t('views.WorkOrdersDashboardView.viewDetails')}
                              </Button>
                              <div onClick={e => e.stopPropagation()}>
                                  <KebabMenu 
                                      items={[
                                          { label: t('views.WorkOrdersDashboardView.editSchedule'), icon: Calendar, onClick: () => handleOpenSchedule(wo) },
                                          { label: t('views.WorkOrdersDashboardView.assignCrew'), icon: User, onClick: () => handleOpenCrew(wo) }
                                      ]}
                                  />
                              </div>
                          </div>
                      </div>

                  </div>
              </div>
          )})}

          {filteredOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                      <ClipboardList className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('views.WorkOrdersDashboardView.noWorkOrdersFound')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">{t('views.WorkOrdersDashboardView.tryAdjustingFilters')}</p>
              </div>
          )}
      </div>
    </div>
  );
};
