
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  ChevronRight, ChevronLeft, X, Target,
  Ruler, Layout, Settings, Rocket,
  BookOpen, Calendar, Briefcase, Users, Kanban,
  Search, Play, CheckCircle2, Info,
  Plus, Paintbrush, DollarSign, Edit2, Layers, Calculator, FileText, Clock, Package,
  Receipt, ClipboardList
} from 'lucide-react';
import { Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  icon: React.ElementType;
  targetId: string; 
  route: string;
  detailId?: string; // Optional ID for specific detail views (e.g. est-2)
  position: 'right' | 'bottom' | 'left' | 'top' | 'center';
  isOverview?: boolean; // If true, shows the "Deep Dive" option
  subSteps?: string[]; // IDs of steps that belong to this module's deep dive
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Estimate Masterclass',
    content: 'Welcome! This walkthrough will show you how to leverage the full power of our estimation engine. Ready to scale your speed and accuracy?',
    icon: Rocket,
    targetId: 'root',
    route: 'dashboard',
    position: 'center'
  },
  {
    id: 'dashboard_overview',
    title: 'Business Health',
    content: 'Monitor your pipeline value, active production, and pending tasks from this command center.',
    icon: Target,
    targetId: 'dashboard-stats',
    route: 'dashboard',
    position: 'bottom',
    isOverview: true
  },
  // --- CALENDAR ---
  {
    id: 'calendar_overview',
    title: 'Schedule & Dispatch',
    content: 'Drag-and-drop sales appointments and production jobs. Switch between Month, Week, and Day views to manage your team\'s time.',
    icon: Calendar,
    targetId: 'calendar-view', // Target the calendar container
    route: 'calendar',
    position: 'bottom'
  },
  // --- LEADS ---
  {
    id: 'leads_overview',
    title: 'Lead Pipeline',
    content: 'Track potential customers from initial contact to booking. Drag cards to update status and convert leads into contacts and estimates.',
    icon: Kanban,
    targetId: 'leads-pipeline-board', // Target the board
    route: 'leads',
    position: 'bottom'
  },
  // --- CONTACTS ---
  {
    id: 'contacts_overview',
    title: 'Client Database',
    content: 'Manage relationships, view interaction history, and track lifetime value for every client.',
    icon: Users,
    targetId: 'contacts-list', // Target the list
    route: 'contacts',
    position: 'bottom'
  },
  // --- ESTIMATE MODULE ---
  {
    id: 'estimates_overview',
    title: 'Estimation Engine',
    content: 'This is the heart of the platform. We use high-fidelity production rates to ensure you never under-bid a project again.',
    icon: Ruler,
    targetId: 'nav-estimates',
    route: 'estimates',
    position: 'right',
    isOverview: true,
    subSteps: ['est_create', 'est_client', 'est_paint', 'est_scope', 'est_add_item', 'est_misc_items', 'est_materials', 'est_labor_summary', 'est_finalize']
  },
  {
      id: 'est_create',
      title: 'Starting a Project',
      content: 'Start from a clean slate or choose from your pre-designed templates to fill a 10-room estimate in seconds.',
      icon: Plus,
      targetId: 'create-estimate-btn',
      route: 'estimates',
      position: 'bottom'
  },
  {
      id: 'est_client',
      title: 'Data Reconciliation',
      content: 'Associate customers with specific properties. Perfect for property managers or homeowners with multiple sites.',
      icon: Users,
      targetId: 'estimate-client-section',
      route: 'estimate',
      detailId: 'est-2',
      position: 'bottom'
  },
  {
      id: 'est_paint',
      title: 'The Paint Card',
      content: 'Define your products globally for the project here. Any changes here sync instantly across all areas.',
      icon: Paintbrush,
      targetId: 'paint-card-section',
      route: 'estimate',
      detailId: 'est-2',
      position: 'top'
  },
  {
      id: 'est_scope',
      title: 'Dynamic Areas',
      content: 'Input L x W x H to auto-calculate all surfaces. Our math engine handles the "unfolded" surface area of complex architectural details.',
      icon: Layers,
      targetId: 'scope-section',
      route: 'estimate',
      detailId: 'est-2',
      position: 'top'
  },
  {
      id: 'est_add_item',
      title: 'Injecting Rates',
      content: 'Click "Add Line Item" inside an area to search your production rate library. It pulls in your specific efficiency speeds automatically.',
      icon: Plus,
      targetId: 'add-item-btn-trigger',
      route: 'estimate',
      detailId: 'est-2',
      position: 'bottom'
  },
  {
      id: 'est_misc_items',
      title: 'Priced & Descriptive Items',
      content: 'Use this button to add miscellaneous items. "Priced Items" are for flat fees (like wallpaper removal), while "Descriptive Items" are for project terms or scope exclusions.',
      icon: Calculator,
      targetId: 'add-misc-item-trigger',
      route: 'estimate',
      detailId: 'est-2',
      position: 'top'
  },
  {
      id: 'est_materials',
      title: 'Material Intelligence',
      content: 'The engine automatically determines exactly how many gallon containers you need, optimized for cost and waste.',
      icon: Package,
      targetId: 'paint-materials-summary-section',
      route: 'estimate',
      detailId: 'est-2',
      position: 'top'
  },
  {
      id: 'est_labor_summary',
      title: 'Operational Vision',
      content: 'Review total production hours by area. This gives your crew a precise target and helps you schedule production accurately.',
      icon: Clock,
      targetId: 'labor-summary-section',
      route: 'estimate',
      detailId: 'est-2',
      position: 'top'
  },
  {
      id: 'est_finalize',
      title: 'Financial Calibration',
      content: 'Toggle between Hourly or OpEx pricing. We calculate your "Fully Burdened" labor cost to protect your net profit margin.',
      icon: DollarSign,
      targetId: 'estimate-finalize-section',
      route: 'estimate',
      detailId: 'est-2',
      position: 'top'
  },
  // --- JOBS MODULE ---
  {
    id: 'jobs_overview',
    title: 'Active Operations',
    content: 'Once a bid is sold, it moves here for production. Track your crews and project milestones in real-time.',
    icon: Briefcase,
    targetId: 'nav-jobs',
    route: 'jobs',
    position: 'right',
    isOverview: true,
    subSteps: ['job_header', 'job_progress', 'job_financials']
  },
  {
    id: 'job_header',
    title: 'Job Dashboard',
    content: 'Manage status, access the work order, or launch a marketing campaign from the main header.',
    icon: Info,
    targetId: 'job-header',
    route: 'job_detail',
    detailId: 'job-2',
    position: 'bottom'
  },
  {
    id: 'job_progress',
    title: 'Milestone Tracker',
    content: 'Visualize the project lifecycle from "Confirmed" to "Completed". Click any stage to update the job status instantly.',
    icon: CheckCircle2,
    targetId: 'job-progress-tracker',
    route: 'job_detail',
    detailId: 'job-2',
    position: 'top'
  },
  {
    id: 'job_financials',
    title: 'Job Financials',
    content: 'Track total contract value, payments received, and outstanding balance in real-time.',
    icon: DollarSign,
    targetId: 'job-financial-summary',
    route: 'job_detail',
    detailId: 'job-2',
    position: 'right'
  },
  // --- WORK ORDERS (Separate Module) ---
  {
    id: 'workorders_overview',
    title: 'Work Orders',
    content: 'Digital work orders provide crews with clear instructions, site access info, and task lists without revealing pricing.',
    icon: ClipboardList,
    targetId: 'nav-workorders',
    route: 'workorders',
    position: 'right',
    isOverview: true,
    subSteps: ['wo_header', 'wo_tasks']
  },
  {
      id: 'wo_header',
      title: 'Work Order Details',
      content: 'Manage schedule, crew assignment, and site access codes. Crews can view this on their mobile devices.',
      icon: Info,
      targetId: 'wo-header',
      route: 'workorder_detail',
      detailId: 'wo-2',
      position: 'bottom'
  },
  {
      id: 'wo_tasks',
      title: 'Field Access',
      content: 'Crews can view work orders, site photos, and specific instructions without seeing any of your pricing data.',
      icon: CheckCircle2,
      targetId: 'wo-job-details', // Targeting specific Job Details section
      route: 'workorder_detail',
      detailId: 'wo-2',
      position: 'top'
  },
  // --- INVOICES ---
  {
    id: 'invoices_overview',
    title: 'Invoicing',
    content: 'Generate professional invoices, track payments, and manage outstanding balances.',
    icon: Receipt,
    targetId: 'invoices-list',
    route: 'invoices',
    position: 'bottom'
  },
  // --- PRESENTATION MODULE ---
  {
    id: 'presentations_overview',
    title: 'Artisan Proposals',
    content: 'Don’t just send a PDF. Send a stunning, interactive web experience that sells your story and expertise.',
    icon: Layout,
    targetId: 'nav-presentations',
    route: 'presentation_builder',
    position: 'right',
    isOverview: true,
    subSteps: ['pres_canvas']
  },
  {
      id: 'pres_canvas',
      title: 'Design Blocks',
      content: 'Drag design blocks onto the page. Edit text, swap photos, and brand the entire experience to your company.',
      icon: Edit2,
      targetId: 'builder-canvas-area',
      route: 'presentation_editor',
      detailId: 'pres-1',
      position: 'left'
  },
  // --- SETTINGS ---
  {
    id: 'settings_overview',
    title: 'The Brain',
    content: 'Input your payroll taxes, overhead, and output speeds. This calibrates the entire engine for your specific business.',
    icon: Settings,
    targetId: 'nav-settings',
    route: 'settings',
    position: 'right',
    isOverview: true
  }
];

export const OnboardingTour = ({ 
  activeStepIdx,
  onNavigateStep,
  onComplete, 
  onSkip 
}: { 
  activeStepIdx: number,
  onNavigateStep: (idx: number) => void,
  onComplete: () => void, 
  onSkip: () => void 
}) => {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number; radius: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[activeStepIdx];

  const stepTitle = t(`onboarding.OnboardingTour.step_${currentStep.id}_title`);
  const stepContent = t(`onboarding.OnboardingTour.step_${currentStep.id}_content`);

  const updateSpotlight = () => {
    if (currentStep.position === 'center') {
      setCoords(null);
      return;
    }

    const target = document.getElementById(currentStep.targetId);
    if (target) {
      const rect = target.getBoundingClientRect();
      const padding = 12;
      setCoords({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        radius: 12
      });
    } else {
        setCoords(null);
    }
  };

  useLayoutEffect(() => {
    setIsVisible(false);
    
    // Auto-scroll logic: Bring highlighted section into view
    const target = document.getElementById(currentStep.targetId);
    if (target && currentStep.targetId !== 'root') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const timer = setTimeout(() => {
        updateSpotlight();
        setIsVisible(true);
    }, 600); 
    
    window.addEventListener('resize', updateSpotlight);
    return () => {
        window.removeEventListener('resize', updateSpotlight);
        clearTimeout(timer);
    };
  }, [activeStepIdx]);

  const handleNext = () => {
    if (currentStep.isOverview && currentStep.subSteps) {
        let nextIdx = activeStepIdx + 1;
        while (nextIdx < TOUR_STEPS.length && currentStep.subSteps.includes(TOUR_STEPS[nextIdx].id)) {
            nextIdx++;
        }
        
        if (nextIdx < TOUR_STEPS.length) {
            onNavigateStep(nextIdx);
        } else {
            onComplete();
        }
    } else if (activeStepIdx < TOUR_STEPS.length - 1) {
      onNavigateStep(activeStepIdx + 1);
    } else {
      onComplete();
    }
  };

  const handleDeepDive = () => {
      onNavigateStep(activeStepIdx + 1);
  };

  const handleBack = () => {
    if (activeStepIdx > 0) {
      onNavigateStep(activeStepIdx - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {coords && (
              <rect 
                x={coords.left} 
                y={coords.top} 
                width={coords.width} 
                height={coords.height} 
                rx={coords.radius} 
                fill="black" 
                className="transition-all duration-500 ease-in-out"
              />
            )}
          </mask>
        </defs>
        <rect 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            fill="rgba(15, 23, 42, 0.6)" 
            mask="url(#spotlight-mask)" 
            className="backdrop-blur-[1px] transition-opacity duration-500"
            style={{ opacity: isVisible ? 1 : 0 }}
        />
      </svg>

      <div 
        ref={tooltipRef}
        className={`absolute pointer-events-auto bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-gray-100 p-8 w-[95%] max-w-[440px] transition-all duration-500 ease-in-out ${
          currentStep.position === 'center' || !coords
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' 
            : 'bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-12 md:bottom-12'
        }`}
      >
        <button 
            onClick={onSkip} 
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-20"
        >
            <X className="w-5 h-5" />
        </button>

        <div className="space-y-4 mb-8">
            <h2 className="text-3xl font-black text-gray-900 font-heading tracking-tight leading-none">
                {stepTitle}
            </h2>
            <p className="text-gray-500 text-base leading-relaxed font-medium">
                {stepContent}
            </p>
        </div>

        <div className="flex flex-col gap-4">
            {currentStep.isOverview && currentStep.subSteps && (
                <button 
                    onClick={handleDeepDive}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-primary-700 transition-all border border-primary-500 shadow-xl shadow-primary-500/20 active:scale-95"
                >
                    <Play className="w-4 h-4 fill-current" /> {t('onboarding.OnboardingTour.exploreModuleDetail')}
                </button>
            )}

            <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                    {activeStepIdx > 0 && (
                        <button 
                            onClick={handleBack}
                            className="p-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    <button 
                        onClick={onSkip}
                        className="text-xs font-bold text-gray-400 hover:text-gray-600 px-4"
                    >
                        {activeStepIdx === 0 ? t('onboarding.OnboardingTour.maybeLater') : t('onboarding.OnboardingTour.skipModule')}
                    </button>
                </div>
                
                <Button 
                    onClick={handleNext}
                    variant={currentStep.isOverview ? "secondary" : "primary"}
                    className={`px-8 h-14 rounded-2xl font-black text-base transition-all ${currentStep.isOverview ? 'bg-white border-gray-200 hover:bg-gray-50' : 'shadow-xl shadow-primary-500/20'}`}
                >
                    {activeStepIdx === TOUR_STEPS.length - 1 ? t('onboarding.OnboardingTour.finish') : currentStep.isOverview ? t('onboarding.OnboardingTour.continueOverview') : t('onboarding.OnboardingTour.continue')}
                    <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};
