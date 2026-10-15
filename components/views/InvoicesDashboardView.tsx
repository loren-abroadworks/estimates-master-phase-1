
import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, DollarSign, Calendar, AlertCircle, CheckCircle2, Plus, ArrowDownAZ, ChevronDown, ArrowUp } from 'lucide-react';
import { Button, SearchInput, Badge } from '../UI';
import { Typography, Spacing } from '../../theme/designSystem';
import { Invoice } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface InvoicesDashboardViewProps {
  invoices: Invoice[];
  onViewInvoice: (id: string) => void;
  onCreateNew: () => void;
}

export const InvoicesDashboardView = ({ invoices, onViewInvoice, onCreateNew }: InvoicesDashboardViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  
  // Sort State
  const [sortOption, setSortOption] = useState<'Date' | 'Amount' | 'Client'>('Date');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredInvoices = invoices.filter(inv => {
      const matchesSearch = 
        inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inv.number.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = statusFilter === 'All' || inv.status === statusFilter;
      
      return matchesSearch && matchesFilter;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
      if (sortOption === 'Date') {
          return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      } else if (sortOption === 'Amount') {
          return b.totalAmount - a.totalAmount;
      } else if (sortOption === 'Client') {
          return a.clientName.localeCompare(b.clientName);
      }
      return 0;
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Paid': return 'green';
          case 'Partially Paid': return 'blue';
          case 'Sent': return 'amber';
          case 'Overdue': return 'red';
          default: return 'gray';
      }
  };

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

  return (
    <div id="invoices-list" className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h1 className={`${Typography.h1} mb-4`}>{t('views.InvoicesDashboardView.invoices')}</h1>
          <p className={Typography.lead}>{t('views.InvoicesDashboardView.trackPayments')}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <Button onClick={onCreateNew} size="lg" className="w-full md:w-auto shadow-xl shadow-primary-500/20">
                <Plus className="w-5 h-5" /> {t('views.InvoicesDashboardView.createInvoice')}
            </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> {t('views.InvoicesDashboardView.outstandingBalance')}
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">${totalOutstanding.toLocaleString()}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {t('views.InvoicesDashboardView.totalCollected')}
              </div>
              <div className="text-3xl font-black text-gray-900 dark:text-white font-heading">${totalCollected.toLocaleString()}</div>
          </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col xl:flex-row gap-4 mb-6 justify-between items-start xl:items-center">
          <SearchInput 
              value={searchTerm} 
              onChange={setSearchTerm} 
              placeholder={t('views.InvoicesDashboardView.searchPlaceholder')}
              className="w-full md:max-w-md"
          />
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              {/* Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                  {['All', 'Sent', 'Partially Paid', 'Paid', 'Overdue'].map(status => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${statusFilter === status ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                          {status}
                      </button>
                  ))}
              </div>

              {/* Sort Dropdown */}
              <div className="relative z-20" ref={sortMenuRef}>
                   <button 
                       onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                       className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[160px] justify-between h-full"
                   >
                       <span className="flex items-center gap-2">
                           {sortOption === 'Date' && <Calendar className="w-4 h-4 text-gray-400" />}
                           {sortOption === 'Amount' && <DollarSign className="w-4 h-4 text-gray-400" />}
                           {sortOption === 'Client' && <ArrowDownAZ className="w-4 h-4 text-gray-400" />}
                           {t('views.InvoicesDashboardView.sortLabel', { sortOption })}
                       </span>
                       <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
                   </button>
                   {isSortMenuOpen && (
                       <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                           <button onClick={() => { setSortOption('Date'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sortOption === 'Date' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                               <Calendar className="w-3.5 h-3.5" /> {t('views.InvoicesDashboardView.sortDateNewest')}
                           </button>
                           <button onClick={() => { setSortOption('Amount'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sortOption === 'Amount' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                               <DollarSign className="w-3.5 h-3.5" /> {t('views.InvoicesDashboardView.sortAmountHighLow')}
                           </button>
                           <button onClick={() => { setSortOption('Client'); setIsSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sortOption === 'Client' ? 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'}`}>
                               <ArrowDownAZ className="w-3.5 h-3.5" /> {t('views.InvoicesDashboardView.sortClientName')}
                           </button>
                       </div>
                   )}
               </div>
          </div>
      </div>

      {/* List */}
      <div className="space-y-4">
          {sortedInvoices.map(inv => (
              <div 
                key={inv.id} 
                onClick={() => onViewInvoice(inv.id)}
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
              >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                              <span className="font-mono text-xs font-bold text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded border border-gray-100 dark:border-gray-600">{inv.number}</span>
                              <Badge color={getStatusColor(inv.status) as any}>{inv.status}</Badge>
                              <span className="text-xs text-gray-400 font-medium hidden sm:inline-block">• {new Date(inv.createdDate).toLocaleDateString()}</span>
                          </div>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{inv.clientName}</h3>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{inv.projectName}</div>
                      </div>
                      
                      <div className="flex flex-col md:items-end text-left md:text-right min-w-[120px]">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('views.InvoicesDashboardView.balanceDue')}</div>
                          <div className="text-xl font-black text-gray-900 dark:text-white">${inv.balanceDue.toLocaleString()}</div>
                          <div className="text-xs text-gray-400 mt-1">{t('views.InvoicesDashboardView.totalAmount', { amount: inv.totalAmount.toLocaleString() })}</div>
                      </div>
                  </div>
              </div>
          ))}
          
          {sortedInvoices.length === 0 && (
              <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                  <div className="text-gray-400 font-medium">{t('views.InvoicesDashboardView.noInvoicesFound')}</div>
              </div>
          )}
      </div>
    </div>
  );
};
