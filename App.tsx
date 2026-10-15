
import React, { useState, useEffect } from 'react';
import {
  GlobalSettings, Estimate, Client, Lead, Job, WorkOrder, Invoice, Appointment,
  ProductionRate, Material, LineItemTemplate, TermsTemplate, PackageDescriptionTemplate, CrewMember, ActivityLogEntry
} from './types';
import {
  DEFAULT_SETTINGS, INITIAL_MATERIALS, INITIAL_PRODUCTION_RATES,
  INITIAL_LINE_ITEM_TEMPLATES, INITIAL_TERMS_TEMPLATES, INITIAL_PACKAGE_DESCRIPTION_TEMPLATES, INITIAL_EMPLOYEES,
  CURRENT_USER, canManageSchedule
} from './constants';
import { 
  MOCK_ESTIMATES, MOCK_CLIENTS, MOCK_LEADS, MOCK_JOBS, MOCK_WORK_ORDERS,
  MOCK_INVOICES, MOCK_APPOINTMENTS, MOCK_WEATHER
} from './data/mockData';

// Layout
import { Sidebar } from './components/layout/Sidebar';
import { MobileSidebar } from './components/layout/MobileSidebar';
import { AppHeader } from './components/layout/AppHeader';

// Auth
import { AuthView } from './components/auth/AuthView';

// Views
import { DashboardHomeView } from './components/views/DashboardHomeView';
import { EstimatesDashboardView } from './components/views/EstimatesDashboardView';
import { EstimateFormView } from './components/views/EstimateFormView';
import { SettingsPage } from './components/settings/SettingsPage';
import { JobsDashboardView } from './components/views/JobsDashboardView';
import { JobDetailView } from './components/views/JobDetailView';
import { WorkOrdersDashboardView } from './components/views/WorkOrdersDashboardView';
import { WorkOrderView } from './components/views/WorkOrderView';
import { InvoicesDashboardView } from './components/views/InvoicesDashboardView';
import { InvoiceDetailView } from './components/views/InvoiceDetailView';
import { ContactsDashboardView } from './components/views/ContactsDashboardView';
import { ContactDetailView } from './components/views/ContactDetailView';
import { LeadsDashboardView } from './components/views/LeadsDashboardView';
import { LeadDetailView } from './components/views/LeadDetailView';
import { SalesCalendarView } from './components/views/SalesCalendarView';
import { JobSchedulingView } from './components/views/JobSchedulingView';
import { PresentationsDashboardView } from './components/views/PresentationsDashboardView';
import { PresentationBuilderView } from './components/views/PresentationBuilderView';
import { ReportsView } from './components/views/ReportsView';
import { SupportView } from './components/views/SupportView';

// Onboarding
import { OnboardingTour } from './components/onboarding/OnboardingTour';

// Services
import { createWorkOrderFromEstimate } from './services/workOrderMapper';
import { createInvoiceFromEstimate } from './services/invoiceService';
import { ProposedChange, configFromSettings, toLocalDateKey } from './services/scheduleEngine';
import { applyChangeToJobPinningPast } from './services/shifts';
import { availabilityTrims, applyAvailabilityTrims } from './services/availabilityTrim';
import { companyStandardDay } from './services/crewAvailability';
import { migrateEstimate, getActivePackage } from './services/packages';

// UI
import { Toast } from './components/UI';

// i18n
import { LanguageProvider } from './i18n/LanguageContext';
import { translate } from './i18n/translate';

interface UndoEntry {
  id: string;
  label: string;
  inverse: { jobId: string; startDate?: string; endDate?: string; dailyHours?: Job['dailyHours']; allocations?: Job['allocations'] }[];
  // Optional extra revert (e.g. un-mark a rain day) run alongside the job revert.
  extraUndo?: () => void;
}

export const App = () => {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // --- Navigation State ---
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Data State ---
  const [settings, setSettings] = useState<GlobalSettings>({
    ...DEFAULT_SETTINGS,
    scheduling: { ...DEFAULT_SETTINGS.scheduling, mockWeather: MOCK_WEATHER },
  });
  const [estimates, setEstimates] = useState<Estimate[]>(MOCK_ESTIMATES.map(migrateEstimate));
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(MOCK_WORK_ORDERS);
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [employees, setEmployees] = useState<CrewMember[]>(INITIAL_EMPLOYEES);

  // --- Reschedule (cascade) State ---
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [toast, setToast] = useState<{ id: string; message: string; onUndo?: () => void } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // --- Library State ---
  const [materials, setMaterials] = useState<Material[]>(INITIAL_MATERIALS);
  const [rates, setRates] = useState<ProductionRate[]>(INITIAL_PRODUCTION_RATES);
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>(INITIAL_LINE_ITEM_TEMPLATES);
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplate[]>(INITIAL_TERMS_TEMPLATES);
  const [packageDescriptionTemplates, setPackageDescriptionTemplates] = useState<PackageDescriptionTemplate[]>(INITIAL_PACKAGE_DESCRIPTION_TEMPLATES);
  const [templates, setTemplates] = useState<any[]>([]); // Estimate templates

  // --- Onboarding State ---
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // --- Navigation Handler ---
  const navigate = (screen: string, id: string | null = null) => {
    setCurrentScreen(screen);
    setCurrentId(id);
    window.scrollTo(0, 0);
  };

  // --- Reschedule Actions ---
  const showToast = (message: string, onUndo?: () => void) => {
    setToast({ id: `toast-${Date.now()}`, message, onUndo });
  };

  // App renders the LanguageProvider, so it sits above the hook and resolves keys
  // directly instead.
  const tr = (key: string, vars?: Record<string, string | number>) =>
    translate(settings.appLanguage, key, vars);

  // Saving a member's schedule is the newer instruction, so bookings that no longer fit
  // it are trimmed: a half day comes down to the hours they now work, an off day drops
  // its bookings. Undo restores the hours, not the schedule — that leaves them as an
  // override, which the grid flags amber, exactly as if a scheduler had typed them back.
  const handleEditEmployee = (emp: CrewMember) => {
    const prev = employees.find(e => e.id === emp.id);
    setEmployees(prevList => prevList.map(e => (e.id === emp.id ? emp : e)));

    const defaultBreaks = settings.scheduling?.defaultBreaks ?? [];
    const trims = availabilityTrims(jobs, emp, prev, defaultBreaks);
    if (!trims.length) return;

    const standardDay = companyStandardDay(settings.scheduling);
    const weekendDays = configFromSettings(settings.scheduling, false).weekendDays;
    const affected = new Set(trims.map(t => t.jobId));
    const snapshot = jobs.filter(j => affected.has(j.id));
    setJobs(prevJobs => applyAvailabilityTrims(prevJobs, trims, weekendDays, standardDay));
    logActivity(
      'Trimmed bookings to availability',
      [...affected],
      trims.map(t => `${t.jobNumber} ${t.dateKey}: ${t.from}h → ${t.to}h`).join('; '),
    );
    showToast(
      trims.length === 1
        ? tr('App.trimmedBooking', { name: emp.name })
        : tr('App.trimmedBookings', { count: trims.length, name: emp.name }),
      () => setJobs(prevJobs => prevJobs.map(j => snapshot.find(s => s.id === j.id) ?? j)),
    );
  };

  // Append an audit-log record (most-recent first), stamped with the current user.
  const logActivity = (action: string, affectedJobIds: string[], details?: string) => {
    setActivityLog(prev => [
      {
        id: `log-${Date.now()}-${prev.length}`,
        timestamp: new Date().toISOString(),
        user: CURRENT_USER.name,
        role: CURRENT_USER.role,
        action,
        affectedJobIds,
        details,
      },
      ...prev,
    ]);
  };

  // Simulate notifying each affected job's customer of a schedule change
  // (mock-consistent with services/calendarService.queueReminders). Returns the
  // count of distinct customers contacted.
  const notifyCustomers = (jobIds: string[]): number => {
    const notified = new Set<string>();
    jobIds.forEach(id => {
      const job = jobs.find(j => j.id === id);
      if (!job) return;
      const client = clients.find(c => c.id === job.clientId);
      const key = client?.id ?? job.clientId ?? id;
      if (notified.has(key)) return;
      notified.add(key);
      console.log('--- SIMULATED CUSTOMER NOTIFICATION ---');
      console.log(`To: ${client ? `${client.name} <${client.email}>` : `Client ${job.clientId}`}`);
      console.log(`Re: Updated schedule for "${job.name}" (${job.jobNumber})`);
      console.log('Channels: Email, SMS');
    });
    return notified.size;
  };

  // Apply a batch of schedule changes in a single immutable pass.
  const applyScheduleChanges = (changes: ProposedChange[]) => {
    // Today's date enters the scheduling code ONLY here. The engine is pure by design
    // (scheduleEngine.ts:8), so the boundary between history and the future is injected
    // rather than read from the clock downstream.
    const todayKey = toLocalDateKey(new Date());
    const nonWorkingWeekdays = configFromSettings(settings.scheduling, false).weekendDays;
    setJobs(prev => prev.map(j => {
      const forJob = changes.filter(ch => ch.jobId === j.id && !ch.skipped);
      if (forJob.length === 0) return j;
      // Apply every change for this job in turn (multi-shift cascade); each shift edit
      // recomputes the envelope, so folding preserves earlier moves. Legacy job changes
      // are one-per-job, so this reduces to a single application for them.
      return forJob.reduce(
        (acc, ch) => applyChangeToJobPinningPast(acc, ch, { todayKey, nonWorkingWeekdays }),
        j,
      );
    }));
  };

  // Restore the jobs touched by an undo entry to their pre-cascade schedule,
  // plus any extra revert the action registered (e.g. un-marking a rain day).
  const undoReschedule = (entryId: string) => {
    setUndoStack(prev => {
      const entry = prev.find(e => e.id === entryId);
      if (entry) {
        if (entry.inverse.length > 0) {
          setJobs(js => js.map(j => {
            const inv = entry.inverse.find(i => i.jobId === j.id);
            return inv ? { ...j, startDate: inv.startDate, endDate: inv.endDate, dailyHours: inv.dailyHours, allocations: inv.allocations } : j;
          }));
        }
        entry.extraUndo?.();
        logActivity(`Undid: ${entry.label}`, entry.inverse.map(i => i.jobId));
      }
      return prev.filter(e => e.id !== entryId);
    });
  };

  // Commit a cascade: apply, record the inverse diff (and any extra revert) for
  // undo, and toast.
  const handleApplySchedule = (changes: ProposedChange[], label: string, extraUndo?: () => void) => {
    // Permission gate: only Owners/Admins may commit schedule changes.
    if (!canManageSchedule(CURRENT_USER.role)) {
      showToast('You do not have permission to reschedule jobs.');
      return;
    }
    const applied = changes.filter(c => !c.skipped);
    if (applied.length === 0 && !extraUndo) return;
    // One inverse entry per job (a job may carry several shift changes; they share the
    // same pre-commit snapshot, so the first is the correct restore point).
    const seenInverse = new Set<string>();
    const inverse = applied
      .filter(c => { if (seenInverse.has(c.jobId)) return false; seenInverse.add(c.jobId); return true; })
      .map(c => {
        const pre = jobs.find(j => j.id === c.jobId);
        return {
          jobId: c.jobId,
          startDate: c.oldStart ?? undefined,
          endDate: c.oldEnd ?? undefined,
          // Snapshot the pre-commit per-day windows AND allocations so undo restores
          // the true pre-move state — the commit may rewrite both.
          dailyHours: pre?.dailyHours,
          allocations: pre?.allocations,
        };
      });
    const entryId = `undo-${Date.now()}`;
    if (applied.length > 0) applyScheduleChanges(changes);
    setUndoStack(prev => [{ id: entryId, label, inverse, extraUndo }, ...prev]);

    // Simulate customer notifications + record the action in the activity log.
    const affectedIds = [...new Set(applied.map(c => c.jobId))];
    const notified = applied.length > 0 ? notifyCustomers(affectedIds) : 0;
    logActivity(label, affectedIds, notified > 0 ? `${notified} customer${notified === 1 ? '' : 's'} notified` : undefined);

    const toastMsg = notified > 0 ? `${label} · ${notified} notified` : label;
    showToast(toastMsg, () => undoReschedule(entryId));
  };

  // --- Actions ---
  const handleCreateEstimate = (data: any) => {
    // In a real app, this would use the template to create a new estimate object
    const newEstimate = { ...data, id: `est-${Date.now()}` }; 
    // This logic should be expanded based on template type
    navigate('estimate', newEstimate.id);
  };

  if (!isAuthenticated) {
    return <AuthView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <LanguageProvider appLanguage={settings.appLanguage} clientLanguage={settings.clientLanguage}>
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-sans overflow-hidden">
        {showOnboarding && (
            <OnboardingTour 
                activeStepIdx={onboardingStep}
                onNavigateStep={setOnboardingStep}
                onComplete={() => setShowOnboarding(false)}
                onSkip={() => setShowOnboarding(false)}
            />
        )}

        <Sidebar 
            currentScreen={currentScreen} 
            onNavigate={(s) => navigate(s)} 
            onLogout={() => setIsAuthenticated(false)}
            onboardingProgress={Math.round((onboardingStep / 10) * 100)} 
            onStartTour={() => { setOnboardingStep(0); setShowOnboarding(true); }}
        />
        
        <MobileSidebar 
            isOpen={isMobileMenuOpen} 
            onClose={() => setIsMobileMenuOpen(false)} 
            currentScreen={currentScreen} 
            onNavigate={(s) => navigate(s)}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            <AppHeader 
                onMenuClick={() => setIsMobileMenuOpen(true)} 
                canGoBack={currentScreen.includes('_detail') || currentScreen === 'estimate' || currentScreen === 'template_edit' || currentScreen === 'presentation_editor'}
                onBack={() => {
                    if(currentScreen === 'estimate') navigate('estimates');
                    else if(currentScreen === 'template_edit') navigate('settings');
                    else if(currentScreen === 'lead_detail') navigate('leads');
                    else if(currentScreen === 'contact_detail') navigate('contacts');
                    else if(currentScreen === 'job_detail') navigate('jobs');
                    else if(currentScreen === 'workorder_detail') navigate('workorders');
                    else if(currentScreen === 'invoice_detail') navigate('invoices');
                    else if(currentScreen === 'presentation_editor') navigate('presentation_builder');
                    else navigate('dashboard');
                }}
                title={currentScreen.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            />

            <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth" id="main-content">
                {(() => {
                    switch (currentScreen) {
                        case 'dashboard':
                            return <DashboardHomeView 
                                leads={leads} estimates={estimates} jobs={jobs} invoices={invoices} appointments={appointments} clients={clients}
                                onNavigate={navigate}
                                scopes={settings.scopes}
                                templates={templates}
                            />;
                        case 'calendar':
                            return <SalesCalendarView
                                appointments={appointments}
                                allStaff={employees}
                                jobs={jobs}
                                workOrders={workOrders}
                                onUpdateAppointmentStatus={(id, status) => setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))}
                                onCreateEstimateFromAppointment={(apt) => navigate('estimate', `new?client=${apt.clientId}`)}
                                onScheduleNew={() => navigate('contacts')}
                                onUpdateJob={(updated) => setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))}
                                settings={settings}
                                onViewJob={(id) => navigate('job_detail', id)}
                                onUpdateAppointment={(updated) => setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))}
                                onDeleteAppointment={(id) => setAppointments(prev => prev.filter(a => a.id !== id))}
                                onEditAppointment={(updated) => setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))}
                            />;
                        case 'job_scheduling':
                            return <JobSchedulingView
                                jobs={jobs}
                                clients={clients}
                                workOrders={workOrders}
                                allStaff={employees}
                                onUpdateJob={(updated) => setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))}
                                onEditEmployee={handleEditEmployee}
                                onViewJob={(id) => navigate('job_detail', id)}
                                onViewWorkOrder={(id) => navigate('workorder_detail', id)}
                                onApplySchedule={handleApplySchedule}
                                onToast={showToast}
                                settings={settings}
                                onUpdateSettings={setSettings}
                            />;
                        case 'leads':
                            return <LeadsDashboardView 
                                leads={leads}
                                clients={clients}
                                onAddLead={(l) => setLeads([...leads, l])}
                                onConvertLead={(id) => navigate('estimate', `new?lead=${id}`)}
                                onUpdateLeadStatus={(id, status) => setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))}
                                onViewLead={(id) => navigate('lead_detail', id)}
                                onEditLead={(l) => setLeads(prev => prev.map(lead => lead.id === l.id ? l : lead))}
                                onDeleteLead={(id) => setLeads(prev => prev.filter(l => l.id !== id))}
                            />;
                        case 'lead_detail': {
                            const lead = leads.find(l => l.id === currentId);
                            if (!lead) return <div>Lead not found</div>;
                            return <LeadDetailView 
                                lead={lead}
                                allLeads={leads}
                                allClients={clients}
                                onBack={() => navigate('leads')}
                                onUpdateStatus={(id, status) => setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))}
                                onConvert={(id) => navigate('estimate', `new?lead=${id}`)}
                                onEditLead={(l) => setLeads(prev => prev.map(lead => lead.id === l.id ? l : lead))}
                                onDeleteLead={(id) => setLeads(prev => prev.filter(l => l.id !== id))}
                                onSchedule={(apt) => setAppointments([...appointments, apt])}
                            />;
                        }
                        case 'contacts':
                            return <ContactsDashboardView 
                                clients={clients}
                                onViewClient={(id) => navigate('contact_detail', id)}
                                onAddClient={(c) => setClients([...clients, c])}
                                onEditClient={(c) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli))}
                                onDeleteClient={(id) => setClients(prev => prev.filter(c => c.id !== id))}
                            />;
                        case 'contact_detail': {
                            const client = clients.find(c => c.id === currentId);
                            if (!client) return <div>Client not found</div>;
                            return <ContactDetailView 
                                client={client}
                                onBack={() => navigate('contacts')}
                                onAddProperty={(cid, prop) => setClients(prev => prev.map(c => c.id === cid ? { ...c, properties: [...c.properties, prop] } : c))}
                                onStartEstimate={(client, prop, selection) => navigate('estimate', 'new')}
                                scopes={settings.scopes}
                                templates={templates}
                                onEditClient={(c) => setClients(prev => prev.map(cli => cli.id === c.id ? c : cli))}
                                onDeleteClient={(id) => { setClients(prev => prev.filter(c => c.id !== id)); navigate('contacts'); }}
                                invoices={invoices}
                                workOrders={workOrders}
                                estimates={estimates}
                                jobs={jobs}
                                onViewInvoice={(id) => navigate('invoice_detail', id)}
                                onViewEstimate={(id) => navigate('estimate', id)}
                                onViewJob={(id) => navigate('job_detail', id)}
                                onSaveAppointment={(apt) => setAppointments([...appointments, apt])}
                                salesStaff={employees}
                                leads={leads}
                            />;
                        }
                        case 'estimates':
                            return <EstimatesDashboardView 
                                onCreateNew={handleCreateEstimate}
                                onEditEstimate={(id) => navigate('estimate', id)}
                                scopes={settings.scopes}
                                templates={templates}
                                estimates={estimates}
                                onApproveEstimate={(id) => {
                                    const est = estimates.find(e => e.id === id);
                                    if (est) {
                                        setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: 'Approved', selectedPackageId: e.selectedPackageId ?? e.activePackageId } : e));
                                        // Logic to create job/invoice would go here
                                    }
                                }}
                            />;
                        case 'estimate':
                        case 'template_edit': {
                            const isTemplateMode = currentScreen === 'template_edit';
                            const template = currentId === 'new' ? null : estimates.find(e => e.id === currentId) || templates.find(t => t.id === currentId);
                            
                            return <EstimateFormView
                                settings={settings}
                                materials={materials}
                                areaTemplates={settings.areaTemplates}
                                rates={rates}
                                termsTemplates={termsTemplates}
                                packageDescriptionTemplates={packageDescriptionTemplates}
                                setPackageDescriptionTemplates={setPackageDescriptionTemplates}
                                onAddMaterial={() => {}}
                                setMaterials={setMaterials}
                                onUpdateSettings={setSettings}
                                template={template}
                                estimateType={(template?.scopeId || (template?.packages ? getActivePackage(template).scopeId : ''))?.includes('ext') ? 'exterior' : 'interior'}
                                mode={isTemplateMode ? 'template' : 'estimate'}
                                onSaveTemplate={(t) => {
                                    if (template) setTemplates(prev => prev.map(tp => tp.id === t.id ? t : tp));
                                    else setTemplates([...templates, t]);
                                    navigate('settings');
                                }}
                                onSaveEstimate={(e) => {
                                    if (currentId && currentId !== 'new') setEstimates(prev => prev.map(est => est.id === e.id ? e : est));
                                    else setEstimates([...estimates, e]);
                                }}
                                onBack={() => isTemplateMode ? navigate('settings') : navigate('estimates')}
                                onAcceptEstimate={(e) => {
                                    setEstimates(prev => prev.map(est => est.id === e.id ? { ...e, status: 'Approved', selectedPackageId: e.selectedPackageId ?? est.selectedPackageId ?? est.activePackageId } : est));
                                    // Trigger job creation logic here
                                }}
                                onEstimateSent={(e) => setEstimates(prev => prev.map(est => est.id === e.id ? { ...est, status: 'Sent' } : est))}
                                onDeleteEstimate={(id) => { setEstimates(prev => prev.filter(e => e.id !== id)); navigate('estimates'); }}
                                formTitle={template?.projectName}
                                isTourActive={showOnboarding}
                            />;
                        }
                        case 'presentation_builder':
                            return <PresentationsDashboardView 
                                onCreate={() => navigate('presentation_editor', 'new')}
                                onEdit={(id) => navigate('presentation_editor', id)}
                            />;
                        case 'presentation_editor': {
                            // Use the first estimate as a base for the presentation data if 'new' or specific id
                            // For demo, just picking first estimate data or finding by ID
                            const rawEstimate = currentId && currentId !== 'new' ? estimates.find(e => e.id === currentId) : estimates[0];
                            
                            // Inject necessary global context that isn't stored on the estimate object itself
                            // Safe fallback if rawEstimate is missing (e.g. no estimates yet)
                            const presentationData = rawEstimate ? {
                                ...rawEstimate,
                                settings: settings,
                                materials: materials,
                                rates: rates
                            } : {
                                projectInfo: { name: 'New Project' },
                                settings, materials, rates
                            };

                            return (
                                <PresentationBuilderView 
                                    data={presentationData} 
                                    onBack={() => navigate('presentation_builder')}
                                    onUpdateVisibility={() => {}}
                                    onReorder={() => {}}
                                    onGlobalVisibility={() => {}}
                                />
                            );
                        }
                        case 'jobs':
                            return <JobsDashboardView 
                                jobs={jobs}
                                onViewJob={(id) => navigate('job_detail', id)}
                            />;
                        case 'job_detail': {
                            const job = jobs.find(j => j.id === currentId);
                            if (!job) return <div>Job not found</div>;
                            const inv = invoices.find(i => i.id === job.invoiceId);
                            const wo = workOrders.find(w => w.id === job.workOrderId);
                            
                            return <JobDetailView 
                                job={job}
                                onBack={() => navigate('jobs')}
                                onUpdateJob={(updated) => setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))}
                                invoice={inv}
                                workOrder={wo}
                                onViewWorkOrder={(id) => navigate('workorder_detail', id)}
                                onViewInvoice={(id) => navigate('invoice_detail', id)}
                                onViewClient={(id) => navigate('contact_detail', id)}
                                employees={employees}
                                onGenerateWorkOrder={() => {
                                    // Logic to generate WO from linked estimate
                                    const est = estimates.find(e => e.id === job.estimateId);
                                    if (est) {
                                        const newWO = createWorkOrderFromEstimate(est, materials, settings);
                                        setWorkOrders([...workOrders, newWO]);
                                        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, workOrderId: newWO.id } : j));
                                    }
                                }}
                            />;
                        }
                        case 'workorders':
                            return <WorkOrdersDashboardView 
                                workOrders={workOrders}
                                employees={employees}
                                onViewWorkOrder={(id) => navigate('workorder_detail', id)}
                            />;
                        case 'workorder_detail': {
                            const wo = workOrders.find(w => w.id === currentId);
                            if (!wo) return <div>Work Order not found</div>;
                            return <WorkOrderView 
                                workOrder={wo}
                                onBack={() => navigate('workorders')}
                                onUpdate={(updated) => setWorkOrders(prev => prev.map(w => w.id === updated.id ? updated : w))}
                                onDelete={(id) => { setWorkOrders(prev => prev.filter(w => w.id !== id)); navigate('workorders'); }}
                                materials={materials}
                                onViewClient={(id) => navigate('contact_detail', id)}
                                employees={employees}
                                allJobs={jobs}
                                settings={settings}
                            />;
                        }
                        case 'invoices':
                            return <InvoicesDashboardView 
                                invoices={invoices}
                                onViewInvoice={(id) => navigate('invoice_detail', id)}
                                onCreateNew={() => navigate('estimate', 'new')} // Just redirect to estimate creation for now
                            />;
                        case 'invoice_detail': {
                            const inv = invoices.find(i => i.id === currentId);
                            if (!inv) return <div>Invoice not found</div>;
                            return <InvoiceDetailView 
                                invoice={inv}
                                onBack={() => navigate('invoices')}
                                onRecordPayment={(inv, amt, method, ref) => {
                                    // Logic handled inside view or passed down
                                    console.log('Payment recorded', amt);
                                }}
                                onSendInvoice={() => {}}
                            />;
                        }
                        case 'reports':
                            return <ReportsView settings={settings} onUpdateSettings={setSettings} />;
                        case 'support':
                            return <SupportView onNavigate={navigate} />;
                        case 'settings':
                            return <SettingsPage
                                settings={settings}
                                setSettings={setSettings}
                                activityLog={activityLog}
                                rates={rates}
                                setRates={setRates}
                                materials={materials}
                                setMaterials={setMaterials}
                                lineItemTemplates={lineItemTemplates}
                                setLineItemTemplates={setLineItemTemplates}
                                termsTemplates={termsTemplates}
                                setTermsTemplates={setTermsTemplates}
                                packageDescriptionTemplates={packageDescriptionTemplates}
                                setPackageDescriptionTemplates={setPackageDescriptionTemplates}
                                templates={templates}
                                onCreateTemplate={() => navigate('template_edit', 'new')} 
                                onEditTemplate={(id) => navigate('template_edit', id)}
                                onDeleteTemplate={(id) => setTemplates(prev => prev.filter(t => t.id !== id))}
                                onAddMaterial={() => {}}
                                onAddPaint={() => {}}
                                onEditMaterial={(m) => setMaterials(prev => prev.map(mat => mat.id === m.id ? m : mat))}
                                onDeleteMaterial={(id) => setMaterials(prev => prev.filter(m => m.id !== id))}
                                onToggleDefaultMaterial={(m) => setMaterials(prev => prev.map(mat => mat.id === m.id ? { ...mat, isDefault: !mat.isDefault } : mat))}
                                employees={employees}
                                onAddEmployee={(e) => setEmployees([...employees, e])}
                                onEditEmployee={handleEditEmployee}
                                onDeleteEmployee={(id) => setEmployees(prev => prev.filter(e => e.id !== id))}
                                onRestartTour={() => { setOnboardingStep(0); setShowOnboarding(true); }}
                            />;
                        default:
                            return <div>Page not found</div>;
                    }
                })()}
            </main>
        </div>

        {toast && (
            <Toast
                key={toast.id}
                message={toast.message}
                onUndo={toast.onUndo}
                onDismiss={() => setToast(null)}
            />
        )}
    </div>
    </LanguageProvider>
  );
};
