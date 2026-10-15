
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, User, MapPin, Phone, Mail, ChevronRight, Building, Plus, Filter, ArrowUpRight, Calendar, Star, MoreVertical, ChevronDown, ArrowDownAZ, DollarSign, Edit2, Trash2, Check } from 'lucide-react';
import { Button, Card, SearchInput, Badge, KebabMenu } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { Client } from '../../types';
import { AddContactModal } from '../modals/AddContactModal';
import { ActiveProjectsModal, LifetimeValueModal } from '../modals/ContactStatsModals';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { useTranslation } from '@/i18n/LanguageContext';

interface ContactsDashboardViewProps {
  clients: Client[];
  onViewClient: (id: string) => void;
  onAddClient: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

// Interface for the jobs we generate
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

// Helper to generate consistent mock jobs for a client based on their ID
const generateClientJobs = (client: Client): JobData[] => {
    // Specific Mock Data for Demo Personas
    if (client.name.includes('Sarah Johnson')) {
        return [
            {
                id: 'job-sj-1',
                jobId: 'JOBS/2024/01/001',
                title: 'Interior Refresh',
                address: '123 Creative Blvd',
                status: 'Paid',
                stageIndex: 4,
                created: '1/14/2024',
                amount: 4250,
                statusColor: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            },
            {
                id: 'job-sj-2',
                jobId: 'JOBS/2023/12/042',
                title: 'Deck Staining',
                address: '789 Vacation Way',
                status: 'Paid',
                stageIndex: 4,
                created: '12/4/2023',
                amount: 1800,
                statusColor: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }
        ];
    } 
    
    if (client.name.includes('David Lee')) {
        return [
            {
                id: 'job-dl-1',
                jobId: 'JOBS/2024/02/015',
                title: 'Kitchen Cabinets',
                address: '456 Tech Park',
                status: 'In Production',
                stageIndex: 3,
                created: '2/10/2024',
                amount: 3800,
                statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            },
            {
                id: 'job-dl-2',
                jobId: 'JOBS/2024/03/001',
                title: 'Guest Bath Paint',
                address: '456 Tech Park',
                status: 'Estimate Sent',
                stageIndex: 0,
                created: '3/01/2024',
                amount: 1200,
                statusColor: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
            }
        ];
    }

    if (client.name.includes('Emily Davis')) {
        return [
            {
                id: 'job-ed-1',
                jobId: 'JOBS/2024/01/028',
                title: 'Master Suite Remodel',
                address: '321 Design St',
                status: 'Paid',
                stageIndex: 4,
                created: '1/28/2024',
                amount: 5600,
                statusColor: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            },
            {
                id: 'job-ed-2',
                jobId: 'JOBS/2024/03/012',
                title: 'Exterior Trim',
                address: '888 Studio Ave',
                status: 'Scheduled',
                stageIndex: 2,
                created: '3/05/2024',
                amount: 2400,
                statusColor: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            }
        ];
    }

    // Default Random Generation
    const seed = client.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const count = (seed % 4) + 1; // 1 to 4 jobs
    
    const statuses = ['Paid', 'In Production', 'Estimate Sent', 'Scheduled'];
    const jobTitles = ['Interior Refresh', 'Exterior Repaint', 'Deck Staining', 'Kitchen Cabinets', 'Master Bedroom'];
    const addresses = client.properties.map(p => p.address);
    
    const jobs: JobData[] = [];

    for (let i = 0; i < count; i++) {
        const statusIdx = (seed + i) % statuses.length;
        const status = statuses[statusIdx];
        
        let statusColor = 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
        let stageIndex = 4;

        if (status === 'In Production') { 
            statusColor = 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'; 
            stageIndex = 3; 
        } else if (status === 'Scheduled') { 
            statusColor = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'; 
            stageIndex = 2; 
        } else if (status === 'Estimate Sent') { 
            statusColor = 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'; 
            stageIndex = 0; 
        } else if (status === 'Paid') {
            statusColor = 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
            stageIndex = 4;
        }

        const date = new Date();
        date.setDate(date.getDate() - ((i * 45) + (seed % 30)));

        const amount = 1500 + ((seed * (i + 1) * 37) % 9000);
        const address = addresses[i % addresses.length] || client.address.split(',')[0];

        jobs.push({
            id: `job-${client.id}-${i}`,
            jobId: `JOB-${date.getFullYear()}-${(seed + i).toString().padStart(3, '0')}`,
            title: jobTitles[(seed + i) % jobTitles.length],
            address: address,
            status: status,
            stageIndex: stageIndex,
            created: date.toLocaleDateString(),
            amount: Math.round(amount),
            statusColor
        });
    }
    
    return jobs.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
};

// Helper to enrich client with calculated stats
const enrichClientData = (client: Client) => {
    const jobs = generateClientJobs(client);
    const revenue = jobs.reduce((sum, j) => sum + j.amount, 0);
    
    const activeJob = jobs.find(j => ['In Production', 'Scheduled', 'Estimate Sent'].includes(j.status));
    
    const currentStatus = activeJob 
        ? { label: activeJob.status, color: activeJob.statusColor }
        : { label: 'No Active Jobs', color: 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700' };

    return {
        ...client,
        stats: {
            jobs: jobs.length,
            revenue: revenue,
            lastContact: jobs[0]?.created || 'Recently'
        },
        currentStatus,
        generatedJobs: jobs 
    };
};

export const ContactsDashboardView = ({ clients, onViewClient, onAddClient, onEditClient, onDeleteClient }: ContactsDashboardViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isActiveProjectsModalOpen, setIsActiveProjectsModalOpen] = useState(false);
  const [isLTVModalOpen, setIsLTVModalOpen] = useState(false);
  
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  
  // Sorting State
  const [sortOption, setSortOption] = useState<'NameAsc' | 'NameDesc' | 'Revenue' | 'Date'>('NameAsc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Filtering State
  const [filterOption, setFilterOption] = useState<'All' | 'Starred' | 'WithActive'>('All');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 1. Enrich Data (Generate Jobs)
  const enrichedClients = useMemo(() => {
      return clients.map(enrichClientData);
  }, [clients]);

  // 2. Aggregate Global Stats from Enriched Data
  const allSystemJobs = useMemo(() => {
      return enrichedClients.flatMap(c => c.generatedJobs);
  }, [enrichedClients]);

  const globalRevenue = allSystemJobs.reduce((acc, j) => acc + j.amount, 0);
  
  const globalActiveJobsCount = allSystemJobs.filter(j => 
      ['In Production', 'Scheduled', 'Estimate Sent'].includes(j.status)
  ).length;

  // 3. Filter & Sort for List View
  const filteredClients = useMemo(() => {
      let result = enrichedClients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Filter Logic
      if (filterOption === 'Starred') {
          result = result.filter(c => c.starred);
      } else if (filterOption === 'WithActive') {
          result = result.filter(c => c.currentStatus.label !== 'No Active Jobs');
      }

      result.sort((a, b) => {
          if (sortOption === 'NameAsc') return a.name.localeCompare(b.name);
          if (sortOption === 'NameDesc') return b.name.localeCompare(a.name);
          if (sortOption === 'Revenue') return b.stats.revenue - a.stats.revenue;
          if (sortOption === 'Date') return 0; // Keeping placeholder behavior for now
          return 0;
      });

      return result;
  }, [enrichedClients, searchTerm, sortOption, filterOption]);

  const handleEditClick = (client: Client) => {
      setClientToEdit(client);
      setIsAddModalOpen(true);
  };

  const handleSaveContact = (client: Client) => {
      if (clientToEdit) {
          onEditClient(client);
      } else {
          onAddClient(client);
      }
      setIsAddModalOpen(false);
      setClientToEdit(null);
  };

  const handleDeleteClick = (id: string) => {
      setClientToDelete(id);
  };

  const confirmDelete = () => {
      if (clientToDelete) {
          onDeleteClient(clientToDelete);
          setClientToDelete(null);
      }
  };

  const getSortLabel = (opt: string) => {
      switch(opt) {
          case 'NameAsc': return t('views.ContactsDashboardView.nameAZ');
          case 'NameDesc': return t('views.ContactsDashboardView.nameZA');
          case 'Revenue': return t('views.ContactsDashboardView.revenue');
          case 'Date': return t('views.ContactsDashboardView.dateAdded');
          default: return t('views.ContactsDashboardView.sort');
      }
  };

  return (
    <div id="contacts-list" className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      <AddContactModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setClientToEdit(null); }} 
        onSave={handleSaveContact}
        existingClients={clients}
        clientToEdit={clientToEdit}
        onDelete={(id) => {
            setIsAddModalOpen(false);
            setClientToDelete(id);
        }}
      />

      <ActiveProjectsModal 
        isOpen={isActiveProjectsModalOpen}
        onClose={() => setIsActiveProjectsModalOpen(false)}
        jobs={allSystemJobs} 
        onViewJob={() => setIsActiveProjectsModalOpen(false)} 
      />

      <LifetimeValueModal
        isOpen={isLTVModalOpen}
        onClose={() => setIsLTVModalOpen(false)}
        jobs={allSystemJobs} 
      />

      <ConfirmationModal 
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={confirmDelete}
        title={t('views.ContactsDashboardView.deleteContactTitle')}
        message={t('views.ContactsDashboardView.deleteContactMessage')}
        confirmLabel={t('views.ContactsDashboardView.deleteContactTitle')}
      />

      {/* --- HEADER & ACTIONS --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className={`${Typography.h1} mb-4`}>{t('views.ContactsDashboardView.contacts')}</h1>
          <p className={Typography.lead}>{t('views.ContactsDashboardView.manageClientsLead')}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <Button onClick={() => { setClientToEdit(null); setIsAddModalOpen(true); }} size="lg" className="w-full md:w-auto shadow-xl shadow-primary-500/20">
                <Plus className="w-5 h-5" /> {t('views.ContactsDashboardView.addContact')}
            </Button>
        </div>
      </div>

      {/* --- STATS OVERVIEW --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-default">
              <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> {t('views.ContactsDashboardView.totalClients')}
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">{clients.length}</div>
              <div className="text-sm text-green-600 font-medium mt-1">{t('views.ContactsDashboardView.plusTwoThisMonth')}</div>
          </div>
          
          <div 
            onClick={() => setIsActiveProjectsModalOpen(true)}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
          >
              <div className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" /> {t('views.ContactsDashboardView.activeProjects')}
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">{globalActiveJobsCount}</div>
              <div className="text-sm text-gray-400 group-hover:text-primary-500 font-medium mt-1 flex items-center gap-1">
                  {t('views.ContactsDashboardView.viewInProgress')} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
              </div>
          </div>
          
          <div 
            onClick={() => setIsLTVModalOpen(true)}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
          >
              <div className="text-gray-500 dark:text-gray-400 group-hover:text-primary-600 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" /> {t('views.ContactsDashboardView.lifetimeValue')}
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">${(globalRevenue / 1000).toFixed(1)}k</div>
              <div className="text-sm text-gray-400 group-hover:text-primary-500 font-medium mt-1 flex items-center gap-1">
                  {t('views.ContactsDashboardView.totalRevenueGenerated')}
              </div>
          </div>
      </div>

      {/* --- FILTERS & LIST --- */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
           <SearchInput 
              value={searchTerm} 
              onChange={setSearchTerm} 
              placeholder={t('views.ContactsDashboardView.searchPlaceholder')}
              className="w-full md:w-96"
           />
           <div className="flex gap-2 w-full md:w-auto relative z-20">
               {/* Filter Button */}
               <div className="relative" ref={filterMenuRef}>
                   <button 
                       onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                       className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-bold transition-colors shadow-sm ${filterOption !== 'All' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'}`}
                   >
                       <Filter className="w-4 h-4" /> 
                       {filterOption === 'All' ? t('views.ContactsDashboardView.filter') : filterOption === 'WithActive' ? t('views.ContactsDashboardView.activeProjects') : filterOption}
                       <ChevronDown className={`w-3 h-3 transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                   </button>
                   
                   {isFilterMenuOpen && (
                       <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                           <button onClick={() => { setFilterOption('All'); setIsFilterMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${filterOption === 'All' ? 'text-primary-600' : 'text-gray-700 dark:text-gray-200'}`}>
                               {t('views.ContactsDashboardView.allContacts')}
                               {filterOption === 'All' && <Check className="w-3 h-3" />}
                           </button>
                           <button onClick={() => { setFilterOption('Starred'); setIsFilterMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${filterOption === 'Starred' ? 'text-primary-600' : 'text-gray-700 dark:text-gray-200'}`}>
                               {t('views.ContactsDashboardView.starredOnly')}
                               {filterOption === 'Starred' && <Check className="w-3 h-3" />}
                           </button>
                           <button onClick={() => { setFilterOption('WithActive'); setIsFilterMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${filterOption === 'WithActive' ? 'text-primary-600' : 'text-gray-700 dark:text-gray-200'}`}>
                               {t('views.ContactsDashboardView.hasActiveProjects')}
                               {filterOption === 'WithActive' && <Check className="w-3 h-3" />}
                           </button>
                       </div>
                   )}
               </div>
               
               {/* Sort Dropdown */}
               <div className="relative" ref={sortMenuRef}>
                   <button 
                       onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                       className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[180px]"
                   >
                       <span className="flex items-center gap-2">
                           {(sortOption === 'NameAsc' || sortOption === 'NameDesc') && <ArrowDownAZ className="w-4 h-4 text-gray-400" />}
                           {sortOption === 'Revenue' && <DollarSign className="w-4 h-4 text-gray-400" />}
                           {sortOption === 'Date' && <Calendar className="w-4 h-4 text-gray-400" />}
                           {getSortLabel(sortOption)}
                       </span>
                       <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
                   </button>

                   {isSortMenuOpen && (
                       <div className="absolute top-full right-0 mt-2 w-full min-w-[200px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                           <button 
                               onClick={() => { setSortOption('NameAsc'); setIsSortMenuOpen(false); }}
                               className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold flex items-center gap-3 transition-colors ${sortOption === 'NameAsc' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                           >
                               <ArrowDownAZ className="w-4 h-4" /> {t('views.ContactsDashboardView.nameAZ')}
                           </button>
                           <button
                               onClick={() => { setSortOption('NameDesc'); setIsSortMenuOpen(false); }}
                               className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold flex items-center gap-3 transition-colors ${sortOption === 'NameDesc' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                           >
                               <ArrowDownAZ className="w-4 h-4" /> {t('views.ContactsDashboardView.nameZA')}
                           </button>
                           <button
                               onClick={() => { setSortOption('Revenue'); setIsSortMenuOpen(false); }}
                               className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold flex items-center gap-3 transition-colors ${sortOption === 'Revenue' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                           >
                               <DollarSign className="w-4 h-4" /> {t('views.ContactsDashboardView.revenueHighLow')}
                           </button>
                           <button
                               onClick={() => { setSortOption('Date'); setIsSortMenuOpen(false); }}
                               className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold flex items-center gap-3 transition-colors ${sortOption === 'Date' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                           >
                               <Calendar className="w-4 h-4" /> {t('views.ContactsDashboardView.dateAdded')}
                           </button>
                       </div>
                   )}
               </div>
           </div>
        </div>

        <div className="space-y-4">
            {filteredClients.map(client => (
                <div 
                    key={client.id}
                    onClick={() => onViewClient(client.id)}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500 transition-all cursor-pointer group relative overflow-hidden"
                >
                    {/* Tablet Optimized Grid: 2 Cols on MD, Flex Row on LG */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row items-start lg:items-center gap-6">
                        
                        {/* Identity Column */}
                        <div className="md:col-span-1 lg:flex-[2] lg:min-w-0 flex items-center gap-4 w-full">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-sm border-2 border-white dark:border-gray-700 ring-2 ring-gray-100 dark:ring-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 shrink-0`}>
                                {client.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{client.name}</h3>
                                    
                                    {(client.qualityRating || 0) > 0 && (
                                        <div className="flex items-center gap-0.5 text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-100 dark:border-amber-800 ml-1">
                                            <span className="text-xs font-bold text-amber-700 dark:text-amber-500 mr-0.5">{client.qualityRating}</span>
                                            <Star className="w-3 h-3 fill-current" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{client.address.split(',')[0]}</div>
                            </div>
                        </div>

                        {/* Status Column - Moves to right on tablet */}
                        <div className="md:col-span-1 lg:flex-none flex md:justify-end lg:justify-start">
                            <div className="flex flex-col md:items-end lg:items-start">
                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('views.ContactsDashboardView.status')}</div>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${client.currentStatus.color}`}>
                                    {client.currentStatus.label}
                                </span>
                            </div>
                        </div>

                        {/* Contact Info Column */}
                        <div className="md:col-span-1 lg:flex-1 min-w-0 space-y-1.5 border-t md:border-t-0 md:border-r lg:border-r-0 lg:border-l border-gray-100 dark:border-gray-700 pt-4 md:pt-0 lg:pl-6 lg:border-l lg:border-r lg:pr-6 md:pr-6 lg:border-r-0">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                                <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> 
                                {client.phone}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors truncate">
                                <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> 
                                {client.email}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 truncate">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> 
                                {t('views.ContactsDashboardView.propertiesManaged', { count: client.properties.length })}
                            </div>
                        </div>

                        {/* Stats Column */}
                        <div className="md:col-span-1 lg:flex-1 flex flex-row lg:flex-col justify-between lg:justify-center gap-4 lg:gap-1 w-full lg:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-700 lg:border-none">
                            <div>
                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('views.ContactsDashboardView.lifetimeValue')}</div>
                                <div className="text-base font-bold text-gray-900 dark:text-white">${client.stats.revenue.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('views.ContactsDashboardView.jobsCompleted')}</div>
                                <div className="text-base font-bold text-gray-900 dark:text-white">{client.stats.jobs}</div>
                            </div>
                        </div>

                        {/* Actions Column */}
                        <div className="md:col-span-2 lg:w-auto pt-4 lg:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-700 mt-2 lg:mt-0 flex items-center justify-between md:justify-end gap-3">
                            <div className="text-right mr-4 hidden xl:block">
                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('views.ContactsDashboardView.lastContact')}</div>
                                <div className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center justify-end gap-1">
                                    <Calendar className="w-3 h-3" /> {client.stats.lastContact}
                                </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onViewClient(client.id); }}>
                                {t('views.ContactsDashboardView.viewProfile')}
                            </Button>
                            <div onClick={e => e.stopPropagation()}>
                                <KebabMenu 
                                    items={[
                                        { label: t('views.ContactsDashboardView.editContact'), icon: Edit2, onClick: () => handleEditClick(client) },
                                        { label: t('views.ContactsDashboardView.delete'), icon: Trash2, onClick: () => handleDeleteClick(client.id), className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30' }
                                    ]}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            ))}
            
            {filteredClients.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                        <User className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('views.ContactsDashboardView.noContactsFound')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">{t('views.ContactsDashboardView.noContactsHint')}</p>
                    <Button onClick={() => { setClientToEdit(null); setIsAddModalOpen(true); }}>{t('views.ContactsDashboardView.addNewContact')}</Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
