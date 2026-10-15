
import React, { useState } from 'react';
import { LayoutDashboard, Calculator, FolderKanban, Users, PieChart, Settings, X, ClipboardList, Kanban, Receipt, Briefcase, Calendar, MonitorPlay, Paintbrush, LogOut, HelpCircle, FileText, BarChart3, BookOpen, Clock } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: string;
  onNavigate: (screen: 'dashboard' | 'estimates' | 'settings' | 'templates' | 'workorders' | 'leads' | 'contacts' | 'invoices' | 'jobs' | 'calendar' | 'job_scheduling' | 'presentation_builder' | 'support' | 'reports') => void;
  onLogout?: () => void;
  createFlowSource?: 'estimate' | 'invoice';
}

export const MobileSidebar = ({ isOpen, onClose, currentScreen, onNavigate, onLogout, createFlowSource = 'estimate' }: MobileSidebarProps) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleNav = (screen: any) => {
    onNavigate(screen);
    onClose();
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    onClose();
  };

  const navItems = [
    { id: 'dashboard', label: t('layout.MobileSidebar.dashboard'), icon: LayoutDashboard },
    { id: 'calendar', label: t('layout.MobileSidebar.salesCalendar'), icon: Calendar },
    { id: 'job_scheduling', label: t('layout.MobileSidebar.jobScheduling'), icon: Clock },
    { id: 'leads', label: t('layout.MobileSidebar.leadPipeline'), icon: Kanban },
    { id: 'contacts', label: t('layout.MobileSidebar.contacts'), icon: Users },
    { id: 'estimates', label: t('layout.MobileSidebar.estimates'), icon: Calculator },
    { id: 'presentation_builder', label: t('layout.MobileSidebar.presentationBuilder'), icon: MonitorPlay },
    { id: 'jobs', label: t('layout.MobileSidebar.jobs'), icon: Briefcase },
    { id: 'workorders', label: t('layout.MobileSidebar.workOrders'), icon: ClipboardList },
    { id: 'invoices', label: t('layout.MobileSidebar.invoices'), icon: Receipt },
    { id: 'reports', label: t('layout.MobileSidebar.reports'), icon: BarChart3 },
  ];

  return (
    <div className="fixed inset-0 z-[60] lg:hidden print:hidden">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white border-r border-gray-200 shadow-2xl animate-in slide-in-from-left duration-200 flex flex-col">
        <div className="p-6 flex justify-between items-center border-b border-gray-100">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                    <Paintbrush className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-sm font-black uppercase tracking-tighter text-gray-900 leading-none">{t('layout.MobileSidebar.appName')}</h2>
                    <p className="text-[8px] font-bold text-primary-600 uppercase tracking-widest mt-0.5">{t('layout.MobileSidebar.appTagline')}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              
              let isItemActive = false;
              let targetScreen: any = item.id;

              if (item.id === 'estimates') {
                 isItemActive = (currentScreen === 'estimates' || currentScreen === 'estimate') && createFlowSource !== 'invoice';
              } else if (item.id === 'contacts') {
                 isItemActive = currentScreen === 'contacts' || currentScreen === 'contact_detail';
              } else if (item.id === 'workorders') {
                 isItemActive = currentScreen === 'workorders' || currentScreen === 'workorder_detail';
              } else if (item.id === 'invoices') {
                 isItemActive = currentScreen === 'invoices' || currentScreen === 'invoice_detail' || (currentScreen === 'estimate' && createFlowSource === 'invoice');
              } else if (item.id === 'jobs') {
                 isItemActive = currentScreen === 'jobs' || currentScreen === 'job_detail';
              } else {
                 isItemActive = currentScreen === item.id;
              }

              return (
                <button 
                  key={item.id}
                  onClick={() => handleNav(targetScreen)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
                    isItemActive 
                      ? 'bg-primary-50 text-primary-900 font-bold shadow-sm border border-primary-100' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                  }`}
                >
                    <item.icon className={`w-5 h-5 ${isItemActive ? 'text-primary-700' : 'text-gray-400'}`} /> 
                    {item.label}
                </button>
              );
            })}
        </nav>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
            <button 
              onClick={() => handleNav('support')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
                currentScreen === 'support'
                  ? 'bg-primary-50 text-primary-900 font-bold shadow-sm border border-primary-100'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 border border-transparent'
              }`}
            >
                <HelpCircle className={`w-5 h-5 ${currentScreen === 'support' ? 'text-primary-700' : 'text-gray-400'}`} />
                {t('layout.MobileSidebar.support')}
            </button>
            <button
              onClick={() => handleNav('settings')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-colors ${
                currentScreen === 'settings'
                  ? 'bg-primary-50 text-primary-900 font-bold shadow-sm border border-primary-100'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 border border-transparent'
              }`}
            >
                <Settings className={`w-5 h-5 ${currentScreen === 'settings' ? 'text-primary-700' : 'text-gray-400'}`} />
                {t('layout.MobileSidebar.settings')}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors border border-transparent"
            >
                <LogOut className="w-5 h-5" />
                {t('layout.MobileSidebar.logout')}
            </button>
        </div>
      </div>
    </div>
  );
};
