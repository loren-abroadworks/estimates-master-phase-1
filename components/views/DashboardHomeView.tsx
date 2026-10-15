
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  MessageSquare, CheckSquare, Users, Briefcase, Calendar, 
  DollarSign, TrendingUp, Target, Clock, Filter, ChevronRight,
  MoreVertical, CheckCircle2, User, Paintbrush, List, Star,
  Zap, Flame, ArrowUpRight, Plus, Receipt, UserPlus, FileText, ChevronDown,
  MapPin, BarChart3, LineChart, ChevronLeft, Gauge, Ruler, Layers, ArrowRight, Info,
  Activity, Send, BookOpen
} from 'lucide-react';
import { Typography, Spacing } from '../../theme/designSystem';
import { Card, Badge, Button } from '../UI';
import { Lead, Estimate, Job, Invoice, Appointment, JobStage, ConfiguredScope, Client } from '../../types';
import { DEFAULT_PIPELINE_STAGES } from '../../constants';
import { DatePicker } from '../ui/DatePicker';
import { AddLeadModal } from '../modals/AddLeadModal';
import { AddContactModal } from '../modals/AddContactModal';
import { CreateEstimateModal } from '../modals/CreateEstimateModal';
import { TasksWidget } from '../widgets/TasksWidget';
import { getSelectedPackage } from '../../services/packages';

interface DashboardHomeViewProps {
    leads?: Lead[];
    estimates?: Estimate[];
    jobs?: Job[];
    invoices?: Invoice[];
    appointments?: Appointment[];
    clients?: Client[];
    scopes?: ConfiguredScope[];
    templates?: any[];
    onNavigate: (screen: string, id?: string | null) => void;
    onAddLead?: (lead: Lead) => void;
    onAddClient?: (client: Client) => void;
    onCreateEstimate?: (data: { type: string, template: string }) => void;
    onCreateInvoice?: (data: { type: string, template: string }) => void;
}

// --- MOCK DATA FOR RECENT UI ELEMENTS ---
const MESSAGES = [
    { id: 0, clientId: '2', user: 'System Notification', text: 'Your job is scheduled at 9:00 AM tomorrow.', time: 'Just now', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 1, clientId: '1', user: 'Sarah Johnson', text: 'When can we start?', time: '2m', color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
    { id: 2, clientId: '2', user: 'Mike Smith', text: 'Send the invoice.', time: '1h', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { id: 3, clientId: '3', user: 'Alex Rivera', text: 'Confirmed for Monday.', time: '3h', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

const RECENT_ACTIVITY = [
  { id: 1, time: '2:15 PM', title: 'Miller Estimate Sent', icon: Send, color: 'text-blue-500' },
  { id: 2, time: '11:00 AM', title: 'Job #1024 Marked Completed', icon: CheckCircle2, color: 'text-green-500' },
  { id: 3, time: '9:30 AM', title: 'New Lead: Sarah Jenkins', icon: UserPlus, color: 'text-purple-500' },
  { id: 4, time: 'Yesterday', title: 'Deposit Received - Smith Job', icon: DollarSign, color: 'text-emerald-500' },
];

// --- SUB-COMPONENTS ---

const SectionHeader = ({ 
    title, 
    icon: Icon, 
    colorClass = "text-gray-400",
    onClick
}: { 
    title: string, 
    icon: any, 
    colorClass?: string,
    onClick?: () => void
}) => (
    <div 
        className={`flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 ${onClick ? 'cursor-pointer group' : ''}`}
        onClick={onClick}
    >
        <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${colorClass}`} />
            <h3 className={`text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] ${onClick ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors' : ''}`}>
                {title}
            </h3>
        </div>
        {onClick && <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-primary-500 transition-colors" />}
    </div>
);

const WinRateGauge = ({ value }: { value: number }) => {
    const { t } = useTranslation();
    // Speedometer style: 240 degree arc
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const arcLength = (240 / 360) * circumference;
    const fillLength = (value / 100) * arcLength;
    
    return (
        <div className="relative flex flex-col items-center justify-center p-6 bg-primary-50/30 dark:bg-primary-900/10 rounded-3xl border border-primary-100/50 dark:border-primary-900/30 w-full h-full min-h-[220px]">
            <svg className="w-48 h-48 md:w-56 md:h-56 rotate-[150deg] drop-shadow-sm" viewBox="0 0 128 128">
                {/* Background Track */}
                <circle 
                    cx="64" cy="64" r="54" 
                    fill="transparent" 
                    stroke="currentColor" 
                    className="text-gray-200 dark:text-gray-700"
                    strokeWidth="8" 
                    strokeDasharray={`${arcLength} ${circumference}`}
                    strokeLinecap="round"
                />
                {/* Value Fill */}
                <circle 
                    cx="64" cy="64" r="54" 
                    fill="transparent" 
                    stroke="var(--p-primary, #2563eb)" 
                    strokeWidth="12" 
                    strokeDasharray={`${fillLength} ${circumference}`}
                    strokeDashoffset="0" 
                    strokeLinecap="round" 
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                <span className="text-6xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{value}%</span>
                <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mt-2 flex items-center gap-1.5">
                    <Flame className="w-3 h-3 text-orange-500" /> {t('views.DashboardHomeView.winRate')}
                </span>
            </div>
            {/* Speedometer ticks */}
            <div className="absolute bottom-8 flex justify-between w-32 px-2">
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase">0%</span>
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase">100%</span>
            </div>
        </div>
    );
};

const ScheduleAgendaWidget = ({ appointments = [], onNavigate }: { appointments?: Appointment[], onNavigate: (s: string) => void }) => {
    const { t } = useTranslation();
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [weekOffset, setWeekOffset] = useState(0);

    const weekDays = useMemo(() => {
        const start = new Date(today);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1) + (weekOffset * 7);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [weekOffset]);

    const appointmentsByDay = useMemo(() => {
        const map: Record<string, Appointment[]> = {};
        appointments.forEach(a => {
            const dateKey = new Date(a.date).toDateString();
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(a);
        });
        return map;
    }, [appointments]);

    const selectedAppointments = appointmentsByDay[selectedDate.toDateString()] || [];

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">{t('views.DashboardHomeView.scheduleAgenda')}</h3>
                </div>
            </div>

            {/* Day Selector Strip */}
            <div className="flex items-center gap-2 mb-6">
                <button 
                    onClick={() => setWeekOffset(prev => prev - 1)}
                    className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    title={t('views.DashboardHomeView.previousWeek')}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex-1 grid grid-cols-7 gap-1">
                    {weekDays.map((day, idx) => {
                        const isSelected = day.toDateString() === selectedDate.toDateString();
                        const isToday = day.toDateString() === today.toDateString();
                        const dayAppointments = appointmentsByDay[day.toDateString()] || [];
                        
                        const hasEstimate = dayAppointments.some(a => a.title.toLowerCase().includes('estimate'));
                        const hasProduction = dayAppointments.some(a => !a.title.toLowerCase().includes('estimate'));

                        return (
                            <button 
                                key={idx}
                                onClick={() => setSelectedDate(day)}
                                className={`flex flex-col items-center py-2 rounded-xl transition-all border ${
                                    isSelected 
                                        ? 'bg-primary-600 border-primary-700 text-white shadow-lg' 
                                        : 'bg-white dark:bg-gray-800 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                                } ${isToday && !isSelected ? 'ring-2 ring-primary-100 dark:ring-primary-900 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : ''}`}
                            >
                                <span className="text-[9px] font-black uppercase mb-1 opacity-70">
                                    {day.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0)}
                                </span>
                                <span className="text-xs font-black">{day.getDate()}</span>
                                
                                <div className="flex gap-0.5 mt-1">
                                    {hasEstimate && (
                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-purple-500'}`} />
                                    )}
                                    {hasProduction && (
                                        <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>

                <button 
                    onClick={() => setWeekOffset(prev => prev + 1)}
                    className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    title={t('views.DashboardHomeView.nextWeek')}
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-[140px]">
                <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                
                {selectedAppointments.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {selectedAppointments.map((apt, idx) => {
                            const aptDate = new Date(apt.date);
                            const isEstimate = apt.title.toLowerCase().includes('estimate');
                            return (
                                <div 
                                    key={apt.id} 
                                    onClick={() => onNavigate('calendar')}
                                    className="flex-shrink-0 w-[280px] md:w-[320px] flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30 hover:bg-white dark:hover:bg-gray-800 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 flex flex-col items-center justify-center shrink-0 shadow-sm">
                                        <span className="text-[9px] font-black uppercase leading-none mb-1 opacity-60">{aptDate.toLocaleDateString(undefined, { month: 'short' })}</span>
                                        <span className="text-lg font-black leading-none">{aptDate.getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col min-w-0">
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate group-hover:text-primary-700 dark:group-hover:text-primary-400">{apt.title}</h4>
                                                <div className="mt-1">
                                                    <Badge color={isEstimate ? 'purple' : 'blue'} className="text-[9px] py-0 px-2">
                                                        {isEstimate ? t('views.DashboardHomeView.estimate') : t('views.DashboardHomeView.production')}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-100 dark:border-gray-700 ml-2">
                                                {aptDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate mt-2">
                                            <MapPin className="w-3 h-3" /> {apt.address.split(',')[0]}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.DashboardHomeView.noAppointmentsToday')}</p>
                        <button onClick={() => onNavigate('calendar')} className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mt-2 hover:underline">{t('views.DashboardHomeView.scheduleNew')}</button>
                    </div>
                )}
            </div>

            <div className="pt-4 text-center border-t border-gray-100 dark:border-gray-700 mt-3">
                <button 
                    onClick={() => onNavigate('calendar')}
                    className="text-[10px] font-bold text-primary-600 dark:text-primary-400 flex items-center justify-center gap-1 hover:underline"
                >
                    {t('views.DashboardHomeView.goToCalendar')} <ArrowUpRight className="w-2.5 h-2.5" />
                </button>
            </div>
        </div>
    );
};

export const DashboardHomeView = ({ 
    leads = [], 
    estimates = [], 
    jobs = [], 
    invoices = [], 
    appointments = [], 
    clients = [],
    scopes,
    templates,
    onNavigate,
    onAddLead,
    onAddClient,
    onCreateEstimate,
    onCreateInvoice
}: DashboardHomeViewProps) => {
  const { t } = useTranslation();
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [pendingSalesPage, setPendingSalesPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const createMenuRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [estimateModalMode, setEstimateModalMode] = useState<'estimate' | 'invoice'>('estimate');

  // Date Filter State
  const [dateRange, setDateRange] = useState<{start: Date, end: Date, label: string}>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: 'This Month' };
  });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
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

  const handleDatePreset = (preset: 'All Time' | 'This Month' | 'Last Month' | 'This Year') => {
      const now = new Date();
      let start = new Date(0); // Epoch
      let end = new Date(8640000000000000); // Far future

      if (preset === 'This Month') {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (preset === 'Last Month') {
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (preset === 'This Year') {
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31);
      }

      end.setHours(23, 59, 59, 999);
      setDateRange({ start, end, label: preset });
      setIsDateFilterOpen(false);
  };

  const updateCustomDate = (type: 'start' | 'end', dateStr: string) => {
      const newDate = new Date(dateStr);
      if (type === 'end') newDate.setHours(23, 59, 59, 999);
      
      setDateRange(prev => ({
          ...prev,
          [type]: newDate,
          label: 'Custom'
      }));
  };

  const handleNewLead = () => {
      setIsCreateMenuOpen(false);
      setIsLeadModalOpen(true);
  };

  const handleNewContact = () => {
      setIsCreateMenuOpen(false);
      setIsContactModalOpen(true);
  };

  const handleNewEstimate = () => {
      setIsCreateMenuOpen(false);
      setEstimateModalMode('estimate');
      setIsEstimateModalOpen(true);
  };

  const handleNewInvoice = () => {
      setIsCreateMenuOpen(false);
      setEstimateModalMode('invoice');
      setIsEstimateModalOpen(true);
  };

  // --- FILTERED DATA ---
  const isDateInRange = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= dateRange.start && d <= dateRange.end;
  };

  const filteredLeads = leads.filter(l => isDateInRange(l.date));
  
  // Create Recent Leads list (sorted by date descending, top 5)
  const recentLeads = useMemo(() => {
      return [...leads].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [leads]);

  const filteredEstimates = estimates.filter(e => isDateInRange(e.projectInfo.date));
  const pendingEstimates = filteredEstimates.filter(e => e.status === 'Sent');
  const soldEstimates = filteredEstimates.filter(e => e.status === 'Approved' || e.status === 'Paid');
  
  const filteredJobs = jobs.filter(j => {
      // Logic for job overlap with range
      if (!j.startDate) return false; // Or include unscheduled if range is wide? Sticking to strict for dashboard
      const start = new Date(j.startDate);
      const end = j.endDate ? new Date(j.endDate) : new Date(start);
      // Check for overlap
      return start <= dateRange.end && end >= dateRange.start;
  });

  const activeJobsList = useMemo(() => filteredJobs.filter(j => j.stage !== 'Completed' && j.stage !== 'Marketing'), [filteredJobs]);
  
  // Widget Active Jobs (Filtered & Sorted for display)
  const activeJobsWidgetData = useMemo(() => {
    return jobs
        .filter(j => ['Scheduled', 'In Production', 'Ready for Inspection'].includes(j.stage))
        .sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime())
        .slice(0, 5);
  }, [jobs]);

  // UPDATED: Include ALL overdue invoices regardless of date range, plus any in range
  const filteredInvoices = invoices.filter(i => {
      if (i.status === 'Overdue') return true; 
      return isDateInRange(i.dueDate);
  });
  const unpaidInvoices = filteredInvoices.filter(i => i.status !== 'Paid');
  
  const winRate = useMemo(() => {
      const sold = soldEstimates.length;
      // Filter leads that are sold or lost within period to calc win rate
      const closedLeads = filteredLeads.filter(l => l.status === 'Sold' || l.status === 'Lost').length;
      // Use fallback if low data
      if (closedLeads === 0 && sold === 0) return 0;
      return closedLeads > 0 ? Math.round((sold / closedLeads) * 100) : (sold > 0 ? 100 : 0);
  }, [soldEstimates, filteredLeads]);

  const totalPipelineValue = pendingEstimates.reduce((sum, e) => sum + (getSelectedPackage(e).financials?.baseGrandTotal || 0), 0);
  const totalSales = soldEstimates.reduce((sum, e) => sum + (getSelectedPackage(e).financials?.baseGrandTotal || 0), 0);
  const avgJobSize = soldEstimates.length > 0 ? totalSales / soldEstimates.length : 0;

  // Pagination for Pending Sales
  const paginatedPendingSales = useMemo(() => {
      const start = (pendingSalesPage - 1) * ITEMS_PER_PAGE;
      return pendingEstimates.slice(start, start + ITEMS_PER_PAGE);
  }, [pendingEstimates, pendingSalesPage]);

  const totalPages = Math.ceil(pendingEstimates.length / ITEMS_PER_PAGE);

  const getSourceColor = (source: string) => {
      const src = (source || '').toLowerCase();
      if (src.includes('google')) return 'green';
      if (src.includes('facebook') || src.includes('fb')) return 'blue';
      if (src.includes('web')) return 'primary';
      if (src.includes('referral')) return 'purple';
      return 'gray';
  };

  const getStageColor = (stage: JobStage) => {
    switch(stage) {
        case 'Confirmed': return 'gray';
        case 'Scheduled': return 'blue';
        case 'In Production': return 'purple';
        case 'Ready for Inspection': return 'amber';
        case 'Completed': return 'green';
        default: return 'gray';
    }
  };

  return (
    <div className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8 bg-gray-100 dark:bg-gray-950`}>
      
      {/* Creation Modals */}
      <AddLeadModal 
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSave={(lead) => { 
            onAddLead?.(lead); 
            onNavigate('lead_detail', lead.id);
        }}
        existingLeads={leads || []}
        existingClients={clients || []}
      />
      
      <AddContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSave={(client) => { 
            onAddClient?.(client);
            onNavigate('contact_detail', client.id);
        }}
        existingClients={clients || []}
      />

      <CreateEstimateModal
        isOpen={isEstimateModalOpen}
        onClose={() => setIsEstimateModalOpen(false)}
        onCreate={(data) => {
            if (estimateModalMode === 'invoice') {
                 onCreateInvoice?.(data);
            } else {
                 onCreateEstimate?.(data);
            }
        }}
        scopes={scopes}
        templates={templates}
        mode={estimateModalMode}
      />

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{t('views.DashboardHomeView.greeting')}</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">{t('views.DashboardHomeView.subheading')} <span className="text-primary-600 dark:text-primary-400 font-bold">{t('views.DashboardHomeView.projects')}</span> {t('views.DashboardHomeView.today')}</p>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
            
            {/* Date Filter */}
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-auto" ref={dateFilterRef}>
                <button
                    onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm w-full md:min-w-[160px] justify-between h-12"
                >
                    <span className="flex items-center gap-2 truncate">
                        <Calendar className="w-4 h-4 text-gray-400 shrink-0" /> 
                        <span className="truncate">
                            {dateRange.label === 'Custom'
                                ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                                : dateRange.label === 'All Time' ? t('views.DashboardHomeView.allTime')
                                : dateRange.label === 'This Month' ? t('views.DashboardHomeView.thisMonth')
                                : dateRange.label === 'Last Month' ? t('views.DashboardHomeView.lastMonth')
                                : dateRange.label === 'This Year' ? t('views.DashboardHomeView.thisYear')
                                : dateRange.label
                            }
                        </span>
                    </span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isDateFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDateFilterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                            {(['All Time', 'This Month', 'Last Month', 'This Year'] as const).map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => handleDatePreset(preset as any)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${dateRange.label === preset ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}
                                >
                                    {preset === 'All Time' ? t('views.DashboardHomeView.allTime') : preset === 'This Month' ? t('views.DashboardHomeView.thisMonth') : preset === 'Last Month' ? t('views.DashboardHomeView.lastMonth') : t('views.DashboardHomeView.thisYear')}
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('views.DashboardHomeView.customRange')}</span>
                            <div className="space-y-3">
                                <DatePicker
                                    value={dateRange.start.toISOString().split('T')[0]}
                                    onChange={(d) => updateCustomDate('start', d)}
                                    label={t('views.DashboardHomeView.from')}
                                />
                                <DatePicker
                                    value={dateRange.end.toISOString().split('T')[0]}
                                    onChange={(d) => updateCustomDate('end', d)}
                                    label={t('views.DashboardHomeView.to')}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative" ref={createMenuRef}>
                <Button 
                    onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} 
                    className="w-full md:w-auto justify-center shadow-xl shadow-primary-500/20 h-12 px-6 font-bold flex items-center gap-2 rounded-2xl whitespace-nowrap"
                    variant="primary"
                >
                    <Plus className="w-5 h-5" />
                    {t('views.DashboardHomeView.create')}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
                </Button>
                {isCreateMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={handleNewLead} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                            <UserPlus className="w-4 h-4 text-blue-500" /> {t('views.DashboardHomeView.newLead')}
                        </button>
                        <button onClick={handleNewContact} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                            <Users className="w-4 h-4 text-indigo-500" /> {t('views.DashboardHomeView.newContact')}
                        </button>
                        <button onClick={handleNewEstimate} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors">
                            <FileText className="w-4 h-4 text-primary-500" /> {t('views.DashboardHomeView.newEstimate')}
                        </button>
                        <button onClick={handleNewInvoice} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold flex items-center gap-3 transition-colors border-t border-gray-50 dark:border-gray-700">
                            <Receipt className="w-4 h-4 text-green-500" /> {t('views.DashboardHomeView.newInvoice')}
                        </button>
                    </div>
                )}
            </div>
            </div> {/* End of flex container for buttons */}
        </div>
      </div>

      {/* MAIN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
        
        {/* LEFT COLUMN: OPERATIONAL */}
        <div className="lg:col-span-3 flex flex-col gap-6">

            {/* Tasks Widget */}
            <TasksWidget />

            {/* Messages Card (Moved to first) */}
            <Card className="p-5 border-0 shadow-sm shrink-0">
                <SectionHeader title={t('views.DashboardHomeView.messages')} icon={MessageSquare} colorClass="text-rose-500" onClick={() => onNavigate('contacts')} />
                <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                    {MESSAGES.map(m => (
                        <div key={m.id} onClick={() => onNavigate('contact_detail', m.clientId)} className="flex gap-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -m-1 p-1 rounded-xl transition-all">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs shadow-sm ${m.color}`}>
                                {m.user.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{m.user}</span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{m.time}</span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            
            {/* NEW RECENT LEADS WIDGET */}
            <Card className="p-5 border-0 shadow-sm shrink-0">
                <SectionHeader title={t('views.DashboardHomeView.recentLeads')} icon={UserPlus} colorClass="text-purple-500" onClick={() => onNavigate('leads')} />
                <div className="space-y-3">
                    {recentLeads.map(lead => {
                        const date = new Date(lead.date);
                        return (
                            <div key={lead.id} onClick={() => onNavigate('lead_detail', lead.id)} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                {/* Date Box */}
                                <div className="flex flex-col items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0 border border-gray-200 dark:border-gray-600">
                                    <span className="text-[8px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-none">{date.toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                    <span className="text-sm font-black text-gray-900 dark:text-white leading-none mt-0.5">{date.getDate()}</span>
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{lead.firstName} {lead.lastName}</h4>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        <MapPin className="w-3 h-3" />
                                        <span className="truncate">{lead.city || t('views.DashboardHomeView.noCity')}, {lead.state || 'ST'}</span>
                                    </div>
                                </div>

                                {/* Source Badge */}
                                <Badge color={lead.source === 'Website' ? 'blue' : lead.source === 'Referral' ? 'purple' : 'green'} className="text-[9px] px-2 py-0.5 uppercase tracking-wide">
                                    {lead.source || t('views.DashboardHomeView.na')}
                                </Badge>
                            </div>
                        )
                    })}
                    {recentLeads.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">{t('views.DashboardHomeView.noRecentLeads')}</p>}
                </div>
            </Card>

            <Card className="p-4 border-0 shadow-sm flex-1 flex flex-col min-h-[250px] max-h-[300px]">
                <SectionHeader title={t('views.DashboardHomeView.jobsToDo')} icon={CheckSquare} colorClass="text-emerald-500" onClick={() => onNavigate('jobs')} />
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1 pb-1">
                    {activeJobsList.length > 0 ? activeJobsList.map(job => (
                        <div 
                            key={job.id} 
                            onClick={() => onNavigate('job_detail', job.id)} 
                            className="bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <Badge color={getStageColor(job.stage) as any} className="text-[9px] font-black uppercase py-0 px-2 tracking-wider leading-none">
                                    {job.stage}
                                </Badge>
                                <div className="text-[10px] font-black text-gray-400 dark:text-gray-300">
                                    {job.startDate ? (
                                        <span>{new Date(job.startDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric'})}</span>
                                    ) : (
                                        <span className="italic">{t('views.DashboardHomeView.tbd')}</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-gray-900 dark:text-white text-sm leading-tight group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors truncate">{job.name}</h4>
                                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-500 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-all transform group-hover:translate-x-0.5" />
                            </div>
                        </div>
                    )) : (
                        <p className="text-xs text-gray-400 italic py-8 text-center">{t('views.DashboardHomeView.noJobsInPeriod')}</p>
                    )}
                </div>
            </Card>
            
            <Card className="p-5 border-0 shadow-sm shrink-0">
                <SectionHeader title={t('views.DashboardHomeView.activity')} icon={Activity} colorClass="text-orange-500" />
                <div className="space-y-4">
                    {RECENT_ACTIVITY.map((activity) => (
                         <div key={activity.id} className="flex flex-col">
                             <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{activity.time}</div>
                             <div className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{activity.title}</div>
                         </div>
                    ))}
                </div>
            </Card>
        </div>

        {/* CENTER COLUMN: SALES FOCUS */}
        <div className="lg:col-span-6 flex flex-col gap-6">
            <Card className="p-6 border-0 shadow-lg shrink-0 h-auto">
                <div className="flex justify-between items-center mb-6">
                    <SectionHeader title={t('views.DashboardHomeView.pendingSales')} icon={Clock} colorClass="text-blue-600 dark:text-blue-400" onClick={() => onNavigate('estimates')} />
                    <div className="text-right">
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.DashboardHomeView.pipelineValue')}</span>
                        <span className="text-3xl font-black text-primary-600 dark:text-primary-400 tracking-tight drop-shadow-sm">${totalPipelineValue.toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800/50 font-black text-gray-400 dark:text-gray-500 uppercase text-[10px] tracking-widest sticky top-0 z-10">
                            <tr>
                                <th className="p-4">{t('views.DashboardHomeView.customer')}</th>
                                <th className="p-4">{t('views.DashboardHomeView.value')}</th>
                                <th className="p-4">{t('views.DashboardHomeView.source')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedPendingSales.map((p, i) => (
                                <tr key={i} onClick={() => onNavigate('estimate', p.id)} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group cursor-pointer">
                                    <td className="p-4 font-bold text-gray-900 dark:text-white">{p.customer.firstName} {p.customer.lastName}</td>
                                    <td className="p-4 font-black text-gray-900 dark:text-white">${(getSelectedPackage(p).financials?.baseGrandTotal || 0).toLocaleString()}</td>
                                    <td className="p-4"><Badge color="blue">Web</Badge></td>
                                </tr>
                            ))}
                            {pendingEstimates.length === 0 && (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">{t('views.DashboardHomeView.noPendingSales')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                        <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {t('views.DashboardHomeView.pageOf', { page: pendingSalesPage, total: totalPages })}
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPendingSalesPage(p => Math.max(1, p - 1))}
                                disabled={pendingSalesPage === 1}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setPendingSalesPage(p => Math.min(totalPages, p + 1))}
                                disabled={pendingSalesPage === totalPages}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
                <Card className="p-6 border-0 shadow-lg overflow-hidden flex flex-col items-center">
                    <div className="w-full flex-1 flex flex-col items-center justify-center">
                        <WinRateGauge value={winRate} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 text-center">
                        <div className="group cursor-default">
                            <div className="text-lg font-black text-gray-900 dark:text-white">{soldEstimates.length}</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('views.DashboardHomeView.soldPeriod')}</div>
                        </div>
                        <div className="group cursor-default">
                            <div className="text-lg font-black text-gray-900 dark:text-white">${(avgJobSize / 1000).toFixed(1)}K</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('views.DashboardHomeView.avgJob')}</div>
                        </div>
                    </div>
                </Card>

                <Card className="p-8 md:p-12 border-0 shadow-lg flex flex-col justify-center space-y-10 border-slate-100 dark:border-gray-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Zap className="w-24 h-24 text-indigo-500 dark:text-indigo-400" /></div>
                    <div className="relative z-10">
                        <span className="text-[11px] font-black text-primary-500 dark:text-primary-400 uppercase tracking-[0.25em] mb-2 block">{t('views.DashboardHomeView.revenue')}</span>
                        <div className="text-5xl font-black tracking-tighter text-primary-600 dark:text-primary-400">${totalSales.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{dateRange.label === 'Custom' ? t('views.DashboardHomeView.custom') : dateRange.label === 'All Time' ? t('views.DashboardHomeView.allTime') : dateRange.label === 'This Month' ? t('views.DashboardHomeView.thisMonth') : dateRange.label === 'Last Month' ? t('views.DashboardHomeView.lastMonth') : dateRange.label === 'This Year' ? t('views.DashboardHomeView.thisYear') : dateRange.label}</div>
                    </div>
                    <div className="relative z-10 pt-6 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 block">{t('views.DashboardHomeView.annualTarget')}</span>
                        <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">$830,000</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('views.DashboardHomeView.companyGoal')}</div>
                    </div>
                </Card>
            </div>

            <Card className="p-6 border-0 shadow-lg shrink-0 hover:border-primary-300 dark:hover:border-primary-600 transition-all">
                <ScheduleAgendaWidget appointments={appointments} onNavigate={onNavigate} />
            </Card>

            <Card className="p-6 border-0 shadow-lg flex flex-col min-h-[200px]">
                <SectionHeader title={t('views.DashboardHomeView.invoicesDue')} icon={DollarSign} colorClass="text-emerald-600" onClick={() => onNavigate('invoices')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {unpaidInvoices.slice(0, 4).map((inv, i) => (
                        <div key={i} onClick={() => onNavigate('invoice_detail', inv.id)} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 group hover:border-emerald-300 dark:hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer h-fit">
                            <div className="min-w-0">
                                <div className="font-bold text-gray-900 dark:text-white truncate text-sm">{inv.clientName}</div>
                                <div className="text-[9px] font-black text-gray-400 dark:text-gray-300 uppercase tracking-widest">
                                    {inv.status === 'Overdue' ? <span className="text-red-500 font-bold">{t('views.DashboardHomeView.overdue')}</span> : t('views.DashboardHomeView.dueDate', { date: new Date(inv.dueDate).toLocaleDateString() })}
                                </div>
                            </div>
                            <div className={`text-base font-black ${inv.status === 'Overdue' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} ml-2`}>
                                ${inv.balanceDue.toLocaleString()}
                            </div>
                        </div>
                    ))}
                    {unpaidInvoices.length === 0 && <p className="col-span-full text-center text-gray-400 text-xs py-8 italic font-medium">{t('views.DashboardHomeView.allAccountsUpToDate')}</p>}
                </div>
            </Card>
        </div>

        {/* RIGHT COLUMN: ANALYTICS */}
        <div className="lg:col-span-3 flex flex-col gap-6">
            <Card className="p-6 border-0 shadow-sm flex flex-col items-center text-center shrink-0">
                <SectionHeader title={t('views.DashboardHomeView.estimateStatus')} icon={Target} colorClass="text-primary-600 dark:text-primary-400" onClick={() => onNavigate('estimates')} />
                <div className="relative w-32 h-32 flex items-center justify-center mb-6 mt-2">
                    <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 128 128">
                        <circle cx="64" cy="64" r="54" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-gray-100 dark:text-gray-700" />
                        <circle cx="64" cy="64" r="54" fill="transparent" stroke="var(--p-primary, #2563eb)" strokeWidth="12" strokeDasharray="339.29" strokeDashoffset={339.29 * (1 - 0.37)} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-gray-900 dark:text-white leading-none">{filteredEstimates.length}</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{t('views.DashboardHomeView.total')}</span>
                    </div>
                </div>
                <div className="w-full space-y-3 pt-4 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{t('views.DashboardHomeView.openEstimates')}</span>
                        <span className="font-black text-gray-900 dark:text-white">{pendingEstimates.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('views.DashboardHomeView.totalValue')}</span>
                        <span className="font-black text-primary-600 dark:text-primary-400 text-base">${(filteredEstimates.reduce((sum, e) => sum + (getSelectedPackage(e).financials?.baseGrandTotal || 0), 0) / 1000).toFixed(0)}K</span>
                    </div>
                </div>
            </Card>

            <Card className="overflow-hidden border-0 shadow-sm flex flex-col shrink-0">
                <div className="p-6 pb-4 border-b border-gray-50 dark:border-gray-700">
                    <SectionHeader title={t('views.DashboardHomeView.monthlyGoal')} icon={TrendingUp} colorClass="text-emerald-500" onClick={() => onNavigate('reports')} />
                    <div className="space-y-6 mt-6">
                        <div className="flex justify-between items-end">
                            <div className="text-left">
                                <div className="text-4xl font-black text-gray-900 dark:text-white">$67K</div>
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{t('views.DashboardHomeView.actualRevenue')}</span>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-black text-gray-400 dark:text-gray-600">$85K</div>
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('views.DashboardHomeView.target')}</span>
                            </div>
                        </div>
                        
                        <div className="relative pt-4">
                            <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: '79%' }}></div>
                            </div>
                            
                            <div className="mt-2 text-right">
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">{t('views.DashboardHomeView.percentToGoal', { percent: 79 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 pt-4 bg-gray-50/30 dark:bg-gray-800/30">
                    <SectionHeader title={t('views.DashboardHomeView.topDeals')} icon={Star} colorClass="text-amber-400" />
                    <div className="space-y-2 mt-2">
                        {soldEstimates.sort((a,b) => (getSelectedPackage(b).financials?.baseGrandTotal || 0) - (getSelectedPackage(a).financials?.baseGrandTotal || 0)).slice(0, 5).map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-2.5 bg-white dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600 transition-all cursor-default shadow-xs">
                                <span className="font-bold text-gray-700 dark:text-gray-200 text-xs truncate pr-2">{s.customer.lastName}</span>
                                <span className={`font-black text-indigo-600 dark:text-indigo-400 text-xs`}>${(getSelectedPackage(s).financials?.baseGrandTotal || 0).toLocaleString()}</span>
                            </div>
                        ))}
                         {soldEstimates.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">{t('views.DashboardHomeView.noDealsInRange')}</p>}
                    </div>
                </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm flex flex-col min-h-[300px]">
                <SectionHeader title={t('views.DashboardHomeView.activeJobs')} icon={Briefcase} colorClass="text-blue-600" onClick={() => onNavigate('jobs')} />
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-0">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {activeJobsWidgetData.map((job) => (
                            <div 
                                key={job.id} 
                                onClick={() => onNavigate('job_detail', job.id)} 
                                className="group flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 -mx-2 px-2 rounded-lg transition-colors"
                            >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                                        job.stage === 'In Production' ? 'text-purple-600 dark:text-purple-400' : 
                                        job.stage === 'Scheduled' ? 'text-blue-600 dark:text-blue-400' : 
                                        'text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {job.stage}
                                    </span>
                                    <span className="font-bold text-gray-900 dark:text-white text-sm truncate">{job.name}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 text-xs font-bold whitespace-nowrap pl-4 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {job.startDate ? new Date(job.startDate).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric', year: 'numeric'}) : t('views.DashboardHomeView.tbd')}
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        ))}
                    </div>
                    {activeJobsWidgetData.length === 0 && <p className="text-xs text-gray-400 italic py-4 text-center">{t('views.DashboardHomeView.noActiveJobs')}</p>}
                </div>
                <div className="pt-3 mt-auto border-t border-gray-50 dark:border-gray-700 text-center">
                    <button 
                        onClick={() => onNavigate('jobs')}
                        className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 uppercase tracking-widest"
                    >
                        {t('views.DashboardHomeView.viewAllJobs')}
                    </button>
                </div>
            </Card>

            <Card className="p-4 border-0 shadow-sm cursor-pointer group hover:border-primary-300 dark:hover:border-primary-600 transition-all shrink-0" onClick={() => onNavigate('leads')}>
                <SectionHeader title={t('views.DashboardHomeView.pipeline')} icon={List} colorClass="text-indigo-400" onClick={() => onNavigate('leads')} />
                <div className="space-y-2 pt-1">
                    {DEFAULT_PIPELINE_STAGES.filter(s => !['Archived', 'Lost'].includes(s.id)).map((stage, i) => {
                        const count = filteredLeads.filter(l => l.status === stage.id).length;
                        const totalLeads = Math.max(1, filteredLeads.length);
                        const percentage = Math.max(5, (count / totalLeads) * 100);
                        
                        const getBarColor = (id: string) => {
                            if (id === 'New') return 'bg-blue-500';
                            if (id === 'Contacted') return 'bg-purple-500';
                            if (id === 'Scheduled') return 'bg-orange-500';
                            if (id === 'Pending') return 'bg-amber-400';
                            if (id === 'Sold') return 'bg-emerald-500';
                            return 'bg-primary-500';
                        };

                        return (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${stage.color.split(' ')[1]} dark:text-gray-400`}>
                                        {stage.label}
                                    </span>
                                    <span className="text-gray-900 dark:text-white font-black text-[10px]">{count}</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className={`h-full ${getBarColor(stage.id)} transition-all duration-1000 ease-out`} 
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="pt-3 text-center border-t border-gray-50 dark:border-gray-700 mt-3">
                    <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 flex items-center justify-center gap-1">{t('views.DashboardHomeView.leadPipeline')} <ArrowUpRight className="w-2.5 h-2.5" /></span>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};
