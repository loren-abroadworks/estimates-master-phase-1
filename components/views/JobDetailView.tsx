
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Calendar, MapPin, DollarSign,
  ClipboardList, User, ArrowUpRight, Check, ChevronDown,
  CreditCard, Clock, Briefcase, FileText, Edit2, PlusCircle, Lock, Unlock
} from 'lucide-react';
import { Job, Invoice, WorkOrder, CrewMember, JobStage, JobPriority, JobNote } from '../../types';
import { Button, Badge, Card, Select, Tooltip } from '../UI';
import { Typography } from '../../theme/designSystem';
import { ScheduleJobModal } from '../modals/ScheduleJobModal';
import { DEFAULT_WORKING_TIME_CONFIG } from '../../constants';
import { PrioritySelect } from './JobScheduling/PrioritySelect';
import { JobNotes } from './JobScheduling/JobNotes';
import { Flag } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

// Format a job date for display, defaulting to the work-day start/end time when
// no explicit time is stored (mirrors the calendar + cascade engine behavior).
const formatSchedule = (iso: string, isEnd: boolean) => {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    d.setHours(isEnd ? DEFAULT_WORKING_TIME_CONFIG.workDayEndHour : DEFAULT_WORKING_TIME_CONFIG.workDayStartHour, 0, 0, 0);
  }
  return {
    date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
};

interface JobDetailViewProps {
  job: Job;
  onBack: () => void;
  onUpdateJob: (job: Job) => void;
  invoice?: Invoice;
  workOrder?: WorkOrder;
  onViewWorkOrder?: (id: string) => void;
  onViewInvoice?: (id: string) => void;
  onViewClient?: (id: string) => void;
  employees?: CrewMember[];
  onGenerateWorkOrder?: () => void;
}

const JOB_STAGES: JobStage[] = ['Confirmed', 'Scheduled', 'In Production', 'Touch Up', 'Ready for Inspection', 'Completed', 'Marketing'];

export const JobDetailView = ({ 
  job, 
  onBack, 
  onUpdateJob,
  invoice,
  workOrder,
  onViewWorkOrder,
  onViewInvoice,
  onViewClient,
  employees = [],
  onGenerateWorkOrder
}: JobDetailViewProps) => {
  const { t } = useTranslation();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const handleStageChange = (newStage: JobStage) => {
    onUpdateJob({ ...job, stage: newStage });
  };

  const handleScheduleSave = (data: { startDate: string; endDate: string; crewIds: string[] }) => {
      onUpdateJob({
          ...job,
          startDate: data.startDate,
          endDate: data.endDate,
          crewMemberIds: data.crewIds,
          stage: job.stage === 'Confirmed' ? 'Scheduled' : job.stage
      });
      setIsScheduleModalOpen(false);
  };

  const setPriority = (p: JobPriority) => onUpdateJob({ ...job, priority: p });
  const setNotes = (n: JobNote[]) => onUpdateJob({ ...job, notes: n.length ? n : undefined });

  const getStageLabel = (stage: string) => {
      if (stage === 'Ready for Inspection') return 'INSPECTION';
      return stage.toUpperCase();
  };

  const renderedHours = useMemo(() => {
    if (!workOrder?.tasks) return 0;
    return workOrder.tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);
  }, [workOrder]);

  const isStageSelectable = (stage: JobStage) => {
      // Prevent manual selection of Scheduled and In Production as they are driven by specific actions
      if (['Scheduled', 'In Production'].includes(stage)) return false;

      // Restrict access to post-production stages (Touch Up and above) until actually in production
      const productionIndex = JOB_STAGES.indexOf('In Production');
      const targetIndex = JOB_STAGES.indexOf(stage);
      const currentIndex = JOB_STAGES.indexOf(job.stage);

      // If trying to move to Touch Up (index > productionIndex) or later...
      if (targetIndex > productionIndex) {
          // Must be currently in In Production or a later stage
          return currentIndex >= productionIndex;
      }

      return true;
  };

  return (
    <div className="w-full mx-auto p-4 md:p-8 pb-32 animate-in fade-in duration-300 min-h-screen bg-gray-50/50 dark:bg-gray-950">
        
        <ScheduleJobModal 
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            job={job}
            onSave={handleScheduleSave}
        />

        {/* Back Link */}
        <div className="mb-6">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-2 font-bold text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" /> {t('views.JobDetailView.backToJobs')}
            </button>
        </div>

        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 mb-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${job.stage === 'Completed' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${job.stage === 'Completed' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            {job.stage}
                        </span>
                        <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{job.jobNumber}</span>
                        {job.is_locked && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Lock className="w-3 h-3" /> {t('views.JobDetailView.locked')}
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white font-heading tracking-tight">{job.name}</h1>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Tooltip content={job.is_locked ? t('views.JobDetailView.tooltipLocked') : t('views.JobDetailView.tooltipUnlocked')}>
                        <button
                            onClick={() => onUpdateJob({ ...job, is_locked: !job.is_locked })}
                            aria-label={job.is_locked ? t('views.JobDetailView.ariaUnlockJob') : t('views.JobDetailView.ariaLockJob')}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-all border ${
                                job.is_locked
                                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                        >
                            {job.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {job.is_locked ? t('views.JobDetailView.locked') : t('views.JobDetailView.lock')}
                        </button>
                    </Tooltip>
                    <div className="relative group">
                        <button className="px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 flex items-center gap-2 shadow-sm transition-all">
                            {t('views.JobDetailView.changeStatus')} <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-20 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200">
                             {JOB_STAGES.map(s => {
                                 if (!isStageSelectable(s)) return null; // Hide restricted stages from quick menu
                                 return (
                                     <button 
                                        key={s} 
                                        onClick={() => handleStageChange(s)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 uppercase tracking-wider transition-colors"
                                     >
                                         {s}
                                     </button>
                                 );
                             })}
                        </div>
                    </div>
                    {workOrder && (
                        <Button 
                            variant="primary" 
                            onClick={() => onViewWorkOrder?.(workOrder.id)}
                            className="bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/20 px-6 py-2.5 h-auto rounded-xl"
                        >
                            <ClipboardList className="w-4 h-4 mr-2" /> {t('views.JobDetailView.viewWorkOrder')}
                        </Button>
                    )}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Sidebar: Financials & Schedule */}
            <div className="lg:col-span-4 space-y-8">
                
                {/* Financials Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-500" /> {t('views.JobDetailView.financials')}
                        </h3>
                        {invoice && (
                            <button 
                                onClick={() => onViewInvoice?.(invoice.id)}
                                className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 transition-all"
                            >
                                {t('views.JobDetailView.viewInvoice')}
                            </button>
                        )}
                    </div>
                    
                    {invoice ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('views.JobDetailView.totalPrice')}</span>
                                <span className="text-lg font-bold text-gray-900 dark:text-white">${invoice.totalAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('views.JobDetailView.paidToDate')}</span>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400">${invoice.amountPaid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('views.JobDetailView.balanceDue')}</span>
                                <span className={`text-xl font-black ${invoice.balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                    ${invoice.balanceDue.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ) : (
                         <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                            {t('views.JobDetailView.noInvoice')}
                         </div>
                    )}
                </div>

                {/* Schedule Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm min-h-[240px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-500" /> {t('views.JobDetailView.schedule')}
                        </h3>
                        <button 
                            onClick={() => setIsScheduleModalOpen(true)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                             <Edit2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
                         {job.startDate ? (
                            <div className="w-full text-left">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 mb-2">
                                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{t('views.JobDetailView.startDate')}</div>
                                    <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatSchedule(job.startDate, false).date}</div>
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                                        <Clock className="w-3.5 h-3.5" /> {formatSchedule(job.startDate, false).time}
                                    </div>
                                </div>
                                {job.endDate && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">{t('views.JobDetailView.endDate')}</div>
                                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{formatSchedule(job.endDate, true).date}</div>
                                        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                                            <Clock className="w-3.5 h-3.5" /> {formatSchedule(job.endDate, true).time}
                                        </div>
                                    </div>
                                )}
                            </div>
                         ) : (
                             <>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('views.JobDetailView.noDatesScheduled')}</p>
                                <Button
                                    variant="secondary"
                                    className="mt-2"
                                    onClick={() => setIsScheduleModalOpen(true)}
                                >
                                    {t('views.JobDetailView.scheduleJob')}
                                </Button>
                             </>
                         )}
                    </div>
                </div>

                {/* Priority Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                            <Flag className="w-5 h-5 text-amber-500" /> {t('views.JobDetailView.priority')}
                        </h3>
                        <PrioritySelect value={job.priority || 'Normal'} onChange={setPriority} />
                    </div>
                </div>

                {/* Notes Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-500" /> {t('views.JobDetailView.notes')}
                        </h3>
                        {(job.notes?.length ?? 0) > 0 && (
                            <span className="text-xs font-bold text-gray-400">{job.notes!.length} {job.notes!.length === 1 ? t('views.JobDetailView.note') : t('views.JobDetailView.notes_plural')}</span>
                        )}
                    </div>
                    <JobNotes notes={job.notes ?? []} onChange={setNotes} />
                </div>

            </div>

            {/* Right Main Content */}
            <div className="lg:col-span-8 space-y-8">
                
                {/* Job Progress */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-8">{t('views.JobDetailView.jobProgress')}</h3>
                    
                    <div className="relative px-2">
                        {/* Progress Line */}
                        <div className="absolute top-[15px] left-0 w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full -z-0"></div>
                        <div 
                            className="absolute top-[15px] left-0 h-1 bg-primary-600 dark:bg-primary-500 rounded-full -z-0 transition-all duration-500"
                            style={{ width: `${(JOB_STAGES.indexOf(job.stage) / (JOB_STAGES.length - 1)) * 100}%` }}
                        ></div>

                        {/* Steps */}
                        <div className="flex justify-between w-full relative z-10 overflow-x-auto md:overflow-visible pb-4 md:pb-0 px-1 hide-scrollbar">
                            {JOB_STAGES.map((stage, idx) => {
                                const currentIdx = JOB_STAGES.indexOf(job.stage);
                                const isCompleted = idx <= currentIdx;
                                const isCurrent = idx === currentIdx;
                                const isSelectable = isStageSelectable(stage);

                                let label = getStageLabel(stage);

                                return (
                                    <button 
                                        key={stage} 
                                        onClick={() => isSelectable && handleStageChange(stage)}
                                        disabled={!isSelectable}
                                        className={`flex flex-col items-center gap-3 group focus:outline-none min-w-[60px] ${!isSelectable ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                                    >
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-300
                                            ${isCurrent 
                                                ? 'bg-primary-600 dark:bg-primary-500 border-white dark:border-gray-800 ring-2 ring-primary-600 dark:ring-primary-500 text-white shadow-lg scale-110' 
                                                : isCompleted 
                                                    ? 'bg-white dark:bg-gray-800 border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-500 ' + (isSelectable ? 'group-hover:bg-primary-50 dark:group-hover:bg-gray-700' : '')
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 ' + (isSelectable ? 'group-hover:border-gray-300 dark:group-hover:border-gray-500' : '')
                                            }
                                        `}>
                                            {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[4]" /> : <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-white' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-wider text-center max-w-[80px] transition-colors ${isCurrent ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'} ${isSelectable ? 'group-hover:text-gray-600 dark:group-hover:text-gray-400' : ''}`}>
                                            {label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Work Order Details */}
                <div 
                    onClick={() => workOrder && onViewWorkOrder?.(workOrder.id)}
                    className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all ${workOrder ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md' : ''}`}
                    title={workOrder ? t('views.JobDetailView.titleViewWorkOrder') : t('views.JobDetailView.titleNoWorkOrder')}
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">{t('views.JobDetailView.workOrderDetails')}</h3>
                        </div>
                        <div className="flex gap-6 items-center">
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.JobDetailView.rendered')}</div>
                                <div className={`text-xl font-black ${renderedHours > (workOrder?.totalProductionHours || 0) ? 'text-amber-600 dark:text-amber-500' : 'text-primary-600 dark:text-primary-400'}`}>{renderedHours.toFixed(1)} {t('views.JobDetailView.hrs')}</div>
                            </div>
                            <div className="w-px h-8 bg-gray-100 dark:bg-gray-700 hidden sm:block"></div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.JobDetailView.estHours')}</div>
                                <div className="text-xl font-black text-gray-900 dark:text-white">{workOrder?.totalProductionHours || 0} {t('views.JobDetailView.hrs')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-0">
                        {workOrder ? (
                            <>
                                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('views.JobDetailView.crewInstructions')}
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {workOrder.tasks.map((task) => (
                                        <div key={task.id} className="p-5 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">{task.areaName} - {task.description}</div>
                                                <div className="flex gap-2">
                                                    {task.prepWash && <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 uppercase">{t('views.JobDetailView.wash')}</span>}
                                                    {task.prepScrape && <span className="text-[10px] font-bold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-800 uppercase">{t('views.JobDetailView.prep')}</span>}
                                                    {task.prepPrime && <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 uppercase">{t('views.JobDetailView.prime')}</span>}
                                                </div>
                                            </div>
                                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                {task.estimatedHours} hrs
                                            </div>
                                        </div>
                                    ))}
                                    {workOrder.tasks.length === 0 && (
                                        <div className="p-8 text-center text-gray-400 dark:text-gray-500 italic">{t('views.JobDetailView.noTasks')}</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col items-center justify-center gap-4">
                                <p>{t('views.JobDetailView.workOrderMissing')}</p>
                                <Button variant="secondary" size="sm" onClick={onGenerateWorkOrder}>
                                    <PlusCircle className="w-4 h-4 mr-2" /> {t('views.JobDetailView.generateWorkOrder')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
