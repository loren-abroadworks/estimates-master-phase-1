
import React, { useState } from 'react';
import { LayoutDashboard, Menu, Calculator, FolderKanban, Users, PieChart, Settings, ChevronLeft, ChevronRight, LayoutTemplate, ClipboardList, UserPlus, Kanban, Receipt, Briefcase, Paintbrush, Calendar, MonitorPlay, LogOut, BookOpen, Rocket, Play, X, HelpCircle, FileText, BarChart3, School, Clock } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export const Sidebar = ({ 
  currentScreen,
  onNavigate,
  onLogout,
  onboardingProgress = 0,
  onStartTour,
  onDismissOnboarding,
  isOnboardingDismissed = false,
  createFlowSource = 'estimate'
}: { 
  currentScreen?: string;
  onNavigate?: (screen: any) => void;
  onLogout?: () => void;
  onboardingProgress?: number; // 0 to 100
  onStartTour?: () => void;
  onDismissOnboarding?: () => void;
  isOnboardingDismissed?: boolean;
  createFlowSource?: 'estimate' | 'invoice';
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { t } = useTranslation();

  return (
    <aside 
      className={`hidden lg:block h-screen sticky top-0 z-[60] shrink-0 transition-[width] duration-300 ease-in-out print:hidden ${isCollapsed ? 'w-[104px]' : 'w-80'}`}
    >
      <div className={`
        h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col py-5 
        transition-all duration-300 ease-in-out group
        ${isCollapsed ? 'w-[104px] hover:w-80 absolute top-0 left-0 shadow-none hover:shadow-2xl z-[60]' : 'w-full relative'}
      `}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
            absolute top-8 -right-3 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center 
            text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 shadow-md z-[70] transition-opacity duration-200
            ${isCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
          title={isCollapsed ? "Pin Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* Brand Logo - Fixed Header */}
        <div className="px-4 w-full flex-shrink-0 mb-6">
          <div 
            className={`flex items-center px-3 transition-all duration-300 ${isCollapsed ? 'justify-center group-hover:justify-start' : 'justify-start'}`}
          >
            <div className={`aspect-square h-12 rounded-lg flex items-center justify-center bg-gray-900 dark:bg-gray-800 text-white shadow-lg transition-all duration-200 ${isCollapsed ? 'block group-hover:hidden' : 'hidden'}`}>
                <Paintbrush className="w-6 h-6" />
            </div>
            <div className={`flex items-center gap-3 transition-all duration-200 ${isCollapsed ? 'hidden group-hover:flex' : 'flex'}`}>
                <div className="aspect-square h-12 rounded-lg flex items-center justify-center bg-gray-900 dark:bg-gray-800 text-white shadow-lg">
                    <Paintbrush className="w-6 h-6" />
                </div>
                <div className="flex flex-col justify-center">
                    <span className="font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none text-lg text-nowrap">Estimate Master</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest leading-none text-[0.6rem]">{t('sidebar.tagline')}</span>
                </div>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex flex-col w-full px-4 overflow-y-auto no-scrollbar flex-1">
          {/* Navigation Items */}
          <nav className="flex flex-col gap-1 w-full mb-6">
            <div id="nav-dashboard">
                <SidebarItem 
                icon={LayoutDashboard} 
                label={t('nav.dashboard')}
                isCollapsed={isCollapsed} 
                isActive={currentScreen === 'dashboard'}
                onClick={() => onNavigate && onNavigate('dashboard')}
                />
            </div>
            <div id="nav-calendar">
                <SidebarItem 
                icon={Calendar} 
                label={t('nav.calendar')}
                isCollapsed={isCollapsed} 
                isActive={currentScreen === 'calendar'}
                onClick={() => onNavigate && onNavigate('calendar')}
                />
            </div>
            <div id="nav-scheduling">
                <SidebarItem 
                icon={Clock} 
                label={t('nav.scheduling')}
                isCollapsed={isCollapsed} 
                isActive={currentScreen === 'job_scheduling'}
                onClick={() => onNavigate && onNavigate('job_scheduling')}
                />
            </div>
            <div id="nav-leads">
                <SidebarItem 
                icon={Kanban} 
                label={t('nav.leads')}
                isActive={currentScreen === 'leads'}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('leads')}
                />
            </div>
            <div id="nav-contacts">
                <SidebarItem 
                icon={Users} 
                label={t('nav.contacts')}
                isActive={currentScreen === 'contacts' || currentScreen === 'contact_detail'}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('contacts')}
                />
            </div>
            <div id="nav-estimates">
                <SidebarItem 
                    icon={Calculator} 
                    label={t('nav.estimates')}
                    isActive={(currentScreen === 'estimates' || currentScreen === 'estimate') && createFlowSource !== 'invoice'}
                    isCollapsed={isCollapsed} 
                    onClick={() => onNavigate && onNavigate('estimates')}
                />
            </div>
            <div id="nav-presentation_builder">
                <SidebarItem 
                    icon={MonitorPlay} 
                    label={t('nav.presentationBuilder')}
                    isActive={currentScreen === 'presentation_builder'}
                    isCollapsed={isCollapsed} 
                    onClick={() => onNavigate && onNavigate('presentation_builder')}
                />
            </div>
            <div id="nav-jobs">
                <SidebarItem 
                icon={Briefcase} 
                label={t('nav.jobs')}
                isActive={currentScreen === 'jobs' || currentScreen === 'job_detail'}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('jobs')}
                />
            </div>
            <div id="nav-workorders">
                <SidebarItem 
                icon={ClipboardList} 
                label={t('nav.workOrders')}
                isActive={currentScreen === 'workorders' || currentScreen === 'workorder_detail'}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('workorders')}
                />
            </div>
            <div id="nav-invoices">
                <SidebarItem 
                icon={Receipt} 
                label={t('nav.invoices')}
                isActive={currentScreen === 'invoices' || currentScreen === 'invoice_detail' || (currentScreen === 'estimate' && createFlowSource === 'invoice')}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('invoices')}
                />
            </div>
            <div id="nav-reports">
                <SidebarItem 
                    icon={BarChart3} 
                    label={t('nav.reports')}
                    isActive={currentScreen === 'reports'}
                    isCollapsed={isCollapsed} 
                    onClick={() => onNavigate && onNavigate('reports')}
                />
            </div>
          </nav>

          {/* Onboarding Widget */}
          {(onboardingProgress < 100 && !isOnboardingDismissed) && (
            <div className={`mt-2 mb-6 px-3 transition-all duration-300 ${isCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-4 border border-primary-100 dark:border-primary-800 shadow-sm relative group/widget">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDismissOnboarding?.(); }}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 rounded-full transition-all opacity-0 group-hover/widget:opacity-100"
                        title={t('sidebar.dismiss')}
                    >
                        <X className="w-3 h-3" />
                    </button>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-primary-700 dark:text-primary-300 uppercase tracking-widest">{t('sidebar.setupProgress')}</span>
                        <span className="text-[10px] font-black text-primary-800 dark:text-primary-200">{onboardingProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-primary-200/50 dark:bg-primary-900/50 rounded-full overflow-hidden mb-4">
                        <div 
                            className="h-full bg-primary-600 dark:bg-primary-500 transition-all duration-500 ease-out" 
                            style={{ width: `${onboardingProgress}%` }}
                        />
                    </div>
                    <button 
                        onClick={onStartTour}
                        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-primary-500/10 flex items-center justify-center gap-2"
                    >
                        <Play className="w-3 h-3 fill-current" /> {t('sidebar.resumeTour')}
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Bottom Actions - Fixed Footer */}
        <div className="flex flex-col w-full px-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-auto gap-1 flex-shrink-0">
          <div id="nav-support">
              <SidebarItem 
                icon={HelpCircle} 
                label={t('sidebar.help')}
                isActive={currentScreen === 'support'}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('support')}
              />
          </div>
          <div id="nav-settings">
              <SidebarItem 
                icon={Settings} 
                label={t('sidebar.settings')}
                isActive={currentScreen === 'settings'}
                isCollapsed={isCollapsed} 
                onClick={() => onNavigate && onNavigate('settings')}
              />
          </div>
          <SidebarItem 
            icon={LogOut} 
            label={t('sidebar.logout')}
            isActive={false}
            isCollapsed={isCollapsed} 
            onClick={onLogout}
          />
        </div>
      </div>
    </aside>
  );
};

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  isActive = false, 
  isCollapsed,
  onClick 
}: { 
  icon: React.ElementType, 
  label: string, 
  isActive?: boolean, 
  isCollapsed: boolean,
  onClick?: () => void
}) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 overflow-hidden whitespace-nowrap group/item
      ${isActive 
        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm border border-primary-100 dark:border-primary-800 font-bold' 
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'}
      ${isCollapsed ? 'justify-center group-hover:justify-start gap-0 group-hover:gap-4' : 'gap-4 justify-start'}
    `}
    title={isCollapsed ? label : ''}
  >
    <Icon className={`w-6 h-6 shrink-0 transition-colors ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500 group-hover/item:text-gray-600 dark:group-hover/item:text-gray-300'}`} />
    <span className={`transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 group-hover:w-auto group-hover:opacity-100' : 'w-auto opacity-100'}`}>
      {label}
    </span>
  </button>
);
