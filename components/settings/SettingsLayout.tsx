
import React, { useState } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Target, Grid, Settings2, Clock, Paintbrush, Package, FileText, ScrollText, 
  Users, MapPin, TrendingUp, Tag, Signal, LayoutTemplate, Layers, Ruler, Wallet, Kanban, Mail, CreditCard, User, Building2, CalendarClock, History
} from 'lucide-react';
import { GlobalSettings, ProductionRate, Material, LineItemTemplate, TermsTemplate, PackageDescriptionTemplate, ConfiguredScope, AreaTemplate, TaxRegion, CrewMember, ActivityLogEntry } from '../../types';

import { ScopeManagerView } from './ScopeManagerView';
import { AreaManagerView } from './AreaManagerView';
import { ColumnManagerView } from './ColumnManagerView';
import { ProductionRateView } from './ProductionRateView';
import { ProductListView } from './ProductListView';
import { LineItemManagerView } from './LineItemManagerView';
import { TermsManagerView } from './TermsManagerView';
import { PackageDescriptionManagerView } from './PackageDescriptionManagerView';
import { LaborConfigView } from './LaborConfigView';
import { TaxRegionView } from './TaxRegionView';
import { GoalsAndProfitView } from './GoalsAndProfitView';
import { TiersView } from './TiersView';
import { DiscountsView } from './DiscountsView';
import { TemplateManagerView } from '../views/TemplateManagerView';
import { PaymentConfigView } from './PaymentConfigView';
import { EmployeeManagerView } from './EmployeeManagerView';
import { PipelineConfigView } from './PipelineConfigView';
import { MessageTemplatesView } from './MessageTemplatesView';
import { SubscriptionView } from './SubscriptionView';
import { ProfileSettingsView } from './ProfileSettingsView';
import { BusinessSettingsView } from './BusinessSettingsView';
import { GeneralConfigView } from './GeneralConfigView';
import { SchedulingConfigView } from './SchedulingConfigView';
import { ActivityLogView } from './ActivityLogView';

type SettingsViewType = 'general' | 'profile' | 'business' | 'goals-profit' | 'financial' | 'labor' | 'tiers' | 'discounts' | 'scopes' | 'areas' | 'columns' | 'pipeline' | 'messages' | 'rates' | 'paints' | 'materials' | 'line-items' | 'terms' | 'package-descriptions' | 'tax-regions' | 'templates' | 'employees' | 'subscription' | 'scheduling' | 'activity';

interface SettingsLayoutProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  rates: ProductionRate[];
  setRates: (r: ProductionRate[]) => void;
  materials: Material[];
  setMaterials: (m: Material[]) => void;
  lineItemTemplates: LineItemTemplate[];
  setLineItemTemplates: (t: LineItemTemplate[]) => void;
  termsTemplates: TermsTemplate[];
  setTermsTemplates: (t: TermsTemplate[]) => void;
  
  // Templates Management Props
  templates: any[];
  onCreateTemplate: () => void;
  onEditTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;

  // Modals Control Props
  onAddConfigItem: (type: 'discount' | 'height' | 'access') => void;
  onEditConfigItem: (type: 'discount' | 'height' | 'access', item: any) => void;
  onDeleteConfigItem: (type: 'discount' | 'height' | 'access', id: string) => void;
  
  onAddScope: () => void;
  onEditScope: (s: ConfiguredScope) => void;
  onDeleteScope: (id: string) => void;
  
  onAddArea: () => void;
  onEditArea: (a: AreaTemplate) => void;
  onDeleteArea: (id: string) => void;
  
  onAddRate: (category?: string) => void;
  onEditRate: (r: ProductionRate) => void;
  onDeleteRate: (id: string) => void;
  onAddCategory: () => void;
  onEditCategory: (catName: string) => void;
  onDeleteCategory: (cat: string) => void;
  
  onAddMaterial: () => void;
  onAddPaint: () => void;
  onEditMaterial: (m: Material) => void;
  onDeleteMaterial: (id: string) => void;
  onToggleDefaultMaterial: (m: Material) => void;
  
  onAddLineItem: () => void;
  onEditLineItem: (t: LineItemTemplate) => void;
  onDeleteLineItem: (id: string) => void;
  
  onAddTerms: () => void;
  onEditTerms: (t: TermsTemplate) => void;
  onDeleteTerms: (id: string) => void;
  packageDescriptionTemplates: PackageDescriptionTemplate[];
  onAddPkgDesc: () => void;
  onEditPkgDesc: (t: PackageDescriptionTemplate) => void;
  onDeletePkgDesc: (id: string) => void;

  onAddTaxRegion: () => void;
  onEditTaxRegion: (t: TaxRegion) => void;
  onDeleteTaxRegion: (id: string) => void;

  // Employee Props
  employees: CrewMember[];
  onAddEmployee: () => void;
  onEditEmployee: (e: CrewMember, tab?: 'profile' | 'schedule') => void;
  onDeleteEmployee: (id: string) => void;
  
  // Onboarding
  onRestartTour?: () => void;

  // Schedule activity log (audit trail of reschedules / moves / locks)
  activityLog?: ActivityLogEntry[];

  // Theme Props
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const SidebarItem: React.FC<{ 
  label: string; 
  icon: React.ElementType; 
  active: boolean; 
  onClick: () => void; 
}> = ({ 
  label, 
  icon: Icon, 
  active, 
  onClick 
}) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 lg:gap-3 lg:px-4 lg:py-3 rounded-xl transition-all text-left group whitespace-nowrap lg:w-full border ${
      active 
        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-200 font-bold border-primary-100 dark:border-primary-800 shadow-sm' 
        : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium border-transparent'
    }`}
  >
    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary-600 dark:text-primary-300' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
    <span className="text-sm lg:text-[0.95rem] leading-tight truncate">{label}</span>
  </button>
);

export const SettingsLayout = (props: SettingsLayoutProps) => {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<SettingsViewType>('profile');

  const orgItems = [
    { id: 'profile', label: t('settings.SettingsLayout.myProfile'), icon: User },
    { id: 'business', label: t('settings.SettingsLayout.businessProfile'), icon: Building2 },
    { id: 'employees', label: t('settings.SettingsLayout.teamAccess'), icon: Users },
    { id: 'subscription', label: t('settings.SettingsLayout.subscriptionBilling'), icon: CreditCard },
  ];

  const configItems = [
    { id: 'general', label: t('settings.SettingsLayout.generalConfiguration'), icon: Settings2 },
    { id: 'goals-profit', label: t('settings.SettingsLayout.goalsProfit'), icon: TrendingUp },
    { id: 'financial', label: t('settings.SettingsLayout.financialSettings'), icon: Wallet },
    { id: 'labor', label: t('settings.SettingsLayout.laborConfig'), icon: Users },
    { id: 'tiers', label: t('settings.SettingsLayout.difficultyTiers'), icon: Signal },
    { id: 'discounts', label: t('settings.SettingsLayout.projectDiscounts'), icon: Tag },
    { id: 'tax-regions', label: t('settings.SettingsLayout.taxRegions'), icon: MapPin },
    { id: 'columns', label: t('settings.SettingsLayout.tableColumns'), icon: Settings2 },
    { id: 'pipeline', label: t('settings.SettingsLayout.pipelineStages'), icon: Kanban },
    { id: 'scheduling', label: t('settings.SettingsLayout.schedulingRainDays'), icon: CalendarClock },
    { id: 'activity', label: t('settings.SettingsLayout.scheduleActivityLog'), icon: History },
    { id: 'messages', label: t('settings.SettingsLayout.automatedMessages'), icon: Mail },
  ];

  const libraryItems = [
    { id: 'templates', label: t('settings.SettingsLayout.estimateTemplates'), icon: LayoutTemplate },
    { id: 'scopes', label: t('settings.SettingsLayout.estimateTypes'), icon: Layers },
    { id: 'areas', label: t('settings.SettingsLayout.areaTemplates'), icon: Grid },
    { id: 'rates', label: t('settings.SettingsLayout.surfaceRates'), icon: Ruler },
    { id: 'paints', label: t('settings.SettingsLayout.paintLibrary'), icon: Paintbrush },
    { id: 'materials', label: t('settings.SettingsLayout.materialsSupplies'), icon: Package },
    { id: 'line-items', label: t('settings.SettingsLayout.lineItems'), icon: FileText },
    { id: 'terms', label: t('settings.SettingsLayout.termsConditions'), icon: ScrollText },
    { id: 'package-descriptions', label: t('settings.SettingsLayout.packageDescriptions'), icon: FileText },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-full bg-gray-50/50 dark:bg-gray-950/50">
      <aside className="w-full lg:w-72 bg-white dark:bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 flex-shrink-0 z-20 shadow-sm lg:shadow-none sticky top-0 self-start lg:h-[calc(100vh-5rem)] flex flex-col">
        <div className="flex lg:flex-col overflow-x-auto lg:overflow-y-auto p-2 lg:px-6 lg:py-10 gap-2 lg:gap-1.5 custom-scrollbar items-center lg:items-stretch h-auto lg:h-full pb-2 lg:pb-12">
          
          <h2 className="hidden lg:block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 mt-2 px-2">{t('settings.SettingsLayout.organization')}</h2>
          {orgItems.map(item => (
            <SidebarItem 
                key={item.id}
                label={item.label} 
                icon={item.icon} 
                active={activeView === item.id} 
                onClick={() => setActiveView(item.id as SettingsViewType)} 
            />
          ))}

          <div className="hidden lg:block h-px w-full bg-gray-100 dark:bg-gray-800 my-4"></div>
          <h2 className="hidden lg:block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 mt-2 px-2">{t('settings.SettingsLayout.configuration')}</h2>
          
          {configItems.map(item => (
            <SidebarItem 
                key={item.id}
                label={item.label} 
                icon={item.icon} 
                active={activeView === item.id} 
                onClick={() => setActiveView(item.id as SettingsViewType)} 
            />
          ))}

          <div className="hidden lg:block h-px w-full bg-gray-100 dark:bg-gray-800 my-6"></div>
          <h2 className="hidden lg:block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2 mb-3 px-2">{t('settings.SettingsLayout.libraries')}</h2>
          
          <div className="lg:hidden h-6 w-px bg-gray-200 mx-1 flex-shrink-0"></div>

          {libraryItems.map(item => (
            <SidebarItem 
                key={item.id}
                label={item.label} 
                icon={item.icon} 
                active={activeView === item.id} 
                onClick={() => setActiveView(item.id as SettingsViewType)} 
            />
          ))}
        </div>
      </aside>

      <main className="flex-1 overflow-visible bg-gray-50 dark:bg-gray-950 pb-24 lg:pb-0">
        {activeView === 'general' && (
            <GeneralConfigView 
                settings={props.settings}
                setSettings={props.setSettings}
                onAddConfigItem={props.onAddConfigItem}
                onEditConfigItem={props.onEditConfigItem}
                onDeleteConfigItem={props.onDeleteConfigItem}
                onRestartTour={props.onRestartTour}
            />
        )}
        {activeView === 'profile' && (
          <ProfileSettingsView 
            settings={props.settings}
            setSettings={props.setSettings}
            isDarkMode={props.isDarkMode}
            onToggleDarkMode={props.onToggleDarkMode}
          />
        )}
        {activeView === 'business' && (
          <BusinessSettingsView 
            settings={props.settings}
            setSettings={props.setSettings}
          />
        )}
        {activeView === 'goals-profit' && (
          <GoalsAndProfitView 
            settings={props.settings}
            setSettings={props.setSettings}
          />
        )}
        {activeView === 'financial' && (
          <PaymentConfigView 
            settings={props.settings} 
            setSettings={props.setSettings} 
          />
        )}
        {activeView === 'subscription' && (
          <SubscriptionView />
        )}
        {activeView === 'employees' && (
          <EmployeeManagerView
            employees={props.employees}
            onAdd={props.onAddEmployee}
            onEdit={props.onEditEmployee}
            onDelete={props.onDeleteEmployee}
          />
        )}
        {activeView === 'tiers' && (
          <TiersView 
            settings={props.settings} 
            setSettings={props.setSettings}
            onAddConfigItem={props.onAddConfigItem}
            onEditConfigItem={props.onEditConfigItem}
            onDeleteConfigItem={props.onDeleteConfigItem}
          />
        )}
        {activeView === 'discounts' && (
          <DiscountsView
            settings={props.settings}
            setSettings={props.setSettings}
            onAddConfigItem={props.onAddConfigItem}
            onEditConfigItem={props.onEditConfigItem}
            onDeleteConfigItem={props.onDeleteConfigItem}
          />
        )}
        {activeView === 'labor' && (
          <LaborConfigView 
            settings={props.settings} 
            setSettings={props.setSettings}
          />
        )}
        {activeView === 'tax-regions' && (
          <TaxRegionView 
            taxRegions={props.settings.taxRegions}
            onAdd={props.onAddTaxRegion}
            onEdit={props.onEditTaxRegion}
            onDelete={props.onDeleteTaxRegion}
          />
        )}
        {activeView === 'scopes' && (
          <ScopeManagerView 
            settings={props.settings} 
            onAdd={props.onAddScope}
            onEdit={props.onEditScope}
            onDelete={props.onDeleteScope}
          />
        )}
        {activeView === 'areas' && (
          <AreaManagerView 
            settings={props.settings} 
            rates={props.rates}
            onAdd={props.onAddArea}
            onEdit={props.onEditArea}
            onDelete={props.onDeleteArea}
          />
        )}
        {activeView === 'columns' && (
          <ColumnManagerView 
            settings={props.settings} 
            onUpdateSettings={props.setSettings} 
          />
        )}
        {activeView === 'pipeline' && (
          <PipelineConfigView 
            settings={props.settings}
            setSettings={props.setSettings}
          />
        )}
        {activeView === 'messages' && (
          <MessageTemplatesView
            settings={props.settings}
            setSettings={props.setSettings}
          />
        )}
        {activeView === 'scheduling' && (
          <SchedulingConfigView
            settings={props.settings}
            setSettings={props.setSettings}
          />
        )}
        {activeView === 'activity' && (
          <ActivityLogView entries={props.activityLog || []} />
        )}
        {activeView === 'rates' && (
          <ProductionRateView 
            rates={props.rates} 
            scopes={props.settings.scopes} 
            settings={props.settings} 
            onAdd={props.onAddRate} 
            onEdit={props.onEditRate} 
            onDelete={props.onDeleteRate} 
            onAddCategory={props.onAddCategory} 
            onEditCategory={props.onEditCategory}
            onDeleteCategory={props.onDeleteCategory} 
          />
        )}
        {activeView === 'paints' && (
          <ProductListView
            title={t('settings.SettingsLayout.paintLibrary')}
            subtitle={t('settings.SettingsLayout.paintLibrarySubtitle')}
            materials={props.materials} 
            filterFn={(m) => ['Paint', 'Primer', 'Stain'].includes(m.category)} 
            onAdd={props.onAddPaint} 
            onEdit={props.onEditMaterial} 
            onDelete={props.onDeleteMaterial} 
            onToggleDefault={props.onToggleDefaultMaterial} 
          />
        )}
        {activeView === 'materials' && (
          <ProductListView
            title={t('settings.SettingsLayout.materialsSupplies')}
            subtitle={t('settings.SettingsLayout.materialsSuppliesSubtitle')}
            materials={props.materials} 
            filterFn={(m) => !['Paint', 'Primer', 'Stain'].includes(m.category)} 
            onAdd={props.onAddMaterial} 
            onEdit={props.onEditMaterial} 
            onDelete={props.onDeleteMaterial} 
            onToggleDefault={props.onToggleDefaultMaterial} 
            showBrandCode={false} 
          />
        )}
        {activeView === 'line-items' && (
          <LineItemManagerView 
            templates={props.lineItemTemplates} 
            onAdd={props.onAddLineItem} 
            onEdit={props.onEditLineItem} 
            onDelete={props.onDeleteLineItem}
            settings={props.settings} 
          />
        )}
        {activeView === 'terms' && (
          <TermsManagerView
            templates={props.termsTemplates}
            onAdd={props.onAddTerms}
            onEdit={props.onEditTerms}
            onDelete={props.onDeleteTerms}
          />
        )}
        {activeView === 'package-descriptions' && (
          <PackageDescriptionManagerView
            templates={props.packageDescriptionTemplates}
            onAdd={props.onAddPkgDesc}
            onEdit={props.onEditPkgDesc}
            onDelete={props.onDeletePkgDesc}
          />
        )}
        {activeView === 'templates' && (
          <TemplateManagerView
            templates={props.templates}
            onCreate={props.onCreateTemplate}
            onEdit={props.onEditTemplate}
            onDelete={props.onDeleteTemplate}
          />
        )}
      </main>
    </div>
  );
};
