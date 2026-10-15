
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Users, Calendar, Clock, MapPin, Phone, Mail, FileText, 
  Plus, Upload, AlertCircle, CheckCircle2, Edit2, Crown, Image as ImageIcon, File, X, Eye, Download, Check, Trash2, PlayCircle, StopCircle, Share2, Send, RotateCcw, Paperclip, AlertTriangle, User, UserCheck
} from 'lucide-react';
import { WorkOrder, CrewMember, Material, Attachment, WorkOrderTask, WorkOrderNote, Job, JobCrewAllocation, GlobalSettings } from '../../types';
import { companyStandardDay } from '../../services/crewAvailability';
import { Card, Badge, KebabMenu, Button, Modal } from '../UI';
import { Typography } from '../../theme/designSystem';
import { CrewSelectionModal } from '../modals/CrewSelectionModal';
import { EditWorkOrderDetailsModal } from '../modals/EditWorkOrderDetailsModal';
import { FilePreviewModal } from '../modals/FilePreviewModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface WorkOrderViewProps {
  workOrder: WorkOrder;
  onBack: () => void;
  onUpdate: (wo: WorkOrder) => void;
  onDelete?: (id: string) => void;
  materials?: Material[];
  onViewClient?: (clientId: string) => void;
  employees?: CrewMember[];
  allJobs?: Job[];
  /** Company settings; drives the crew modal's work window, weekend days, and capacity. */
  settings?: GlobalSettings;
}

const MOCK_ATTACHMENTS: Attachment[] = [
  { 
    id: 'att-1', 
    type: 'image', 
    url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=300&auto=format&fit=crop', 
    name: 'Living_Room_Before.jpg', 
    date: 'Today, 9:41 AM' 
  },
  { 
    id: 'att-2', 
    type: 'image', 
    url: 'https://images.unsplash.com/photo-1562663474-6cbb3eaa4d14?q=80&w=300&auto=format&fit=crop', 
    name: 'Paint_Match_Swatch.jpg', 
    date: 'Today, 9:45 AM' 
  },
  { 
    id: 'att-3', 
    type: 'file', 
    name: 'HOA_Approval_Letter.pdf', 
    size: '2.4 MB', 
    date: 'Yesterday',
    url: 'https://pdfobject.com/pdf/sample.pdf' 
  }
];

export const WorkOrderView = ({ workOrder, onBack, onUpdate, onDelete, materials, onViewClient, employees = [], allJobs = [], settings }: WorkOrderViewProps) => {
  const { t } = useTranslation();
  // Scheduling defaults from company settings, so the crew modal's "8am–5pm" captions
  // and capacity figures follow the configured work hours instead of a hardcoded day.
  const sched = settings?.scheduling;
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const availabilityWindow = useMemo(
    () => ({ startTime: hh(sched?.workDayStartHour ?? 8), endTime: hh(sched?.workDayEndHour ?? 17) }),
    [sched?.workDayStartHour, sched?.workDayEndHour],
  );
  // UI State for Modals
  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isLogHoursOpen, setIsLogHoursOpen] = useState(false);
  const [allocationToEdit, setAllocationToEdit] = useState<JobCrewAllocation | undefined>(undefined);

  // Data State
  const [accessCode, setAccessCode] = useState(workOrder.accessCode); // Keep local for quick edit
  const [newNote, setNewNote] = useState('');
  const [noteAttachment, setNoteAttachment] = useState<{ url: string, name: string, type: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>(MOCK_ATTACHMENTS);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Flatten all crew members from all allocations for header stats
  const allAssignedMembers = useMemo(() => {
      const ids = new Set<string>();
      if (workOrder.allocations) {
          workOrder.allocations.forEach(a => a.memberIds.forEach(id => ids.add(id)));
      }
      // Legacy fallback
      if (workOrder.crewMemberIds) {
          workOrder.crewMemberIds.forEach(id => ids.add(id));
      }
      return Array.from(ids).map(id => employees.find(e => e.id === id)).filter(Boolean) as CrewMember[];
  }, [workOrder, employees]);

  const handleUpdateCrewAllocation =(newCrew: CrewMember[], allocationData?: Partial<JobCrewAllocation>) => {
    if (!allocationData) return;

    const newAllocation: JobCrewAllocation = {
        id: allocationData.id || `alloc-${Date.now()}`,
        name: allocationData.name || 'Crew Shift',
        startDate: allocationData.startDate || workOrder.startDate,
        endDate: allocationData.endDate || workOrder.endDate || workOrder.startDate,
        startTime: allocationData.startTime || availabilityWindow.startTime,
        endTime: allocationData.endTime || availabilityWindow.endTime,
        memberIds: newCrew.map(c => c.id),
        color: allocationData.color
    };

    let updatedAllocations = workOrder.allocations ? [...workOrder.allocations] : [];
    
    if (allocationData.id) {
        // Edit existing
        updatedAllocations = updatedAllocations.map(a => a.id === allocationData.id ? newAllocation : a);
    } else {
        // Add new
        updatedAllocations.push(newAllocation);
    }

    // Determine primary leader from first allocation or logic
    const primaryLeader = updatedAllocations.length > 0 && updatedAllocations[0].memberIds.length > 0 
        ? updatedAllocations[0].memberIds[0] 
        : null;
    
    // Aggregate unique IDs for legacy field support
    const allIds = Array.from(new Set(updatedAllocations.flatMap(a => a.memberIds)));

    onUpdate({
        ...workOrder,
        allocations: updatedAllocations,
        crewMemberIds: allIds, // Keep legacy synced
        crewLeaderId: primaryLeader
    });
  };

  const handleDeleteAllocation = (id: string) => {
      if (!workOrder.allocations) return;
      const updatedAllocations = workOrder.allocations.filter(a => a.id !== id);
      const allIds = Array.from(new Set(updatedAllocations.flatMap(a => a.memberIds)));
      onUpdate({
          ...workOrder,
          allocations: updatedAllocations,
          crewMemberIds: allIds
      });
  };

  const handleUpdateLocation = (data: any) => {
    onUpdate({
      ...workOrder,
      jobAddress: data.jobAddress,
      accessCode: data.accessCode
    });
    setAccessCode(data.accessCode);
  };

  const handleUpdateSchedule = (data: any) => {
    onUpdate({
      ...workOrder,
      startDate: data.startDate,
      endDate: data.endDate
    });
  };

  const handleTaskActualHoursChange = (taskId: string, hours: number) => {
      const updatedTasks = workOrder.tasks.map(t => 
          t.id === taskId ? { ...t, actualHours: hours } : t
      );
      onUpdate({ ...workOrder, tasks: updatedTasks });
  };

  const handleAddNote = () => {
      if (!newNote.trim() && !noteAttachment) return;
      const note: WorkOrderNote = {
          id: `note-${Date.now()}`,
          author: 'Mike Smith', // Mocked user
          text: newNote,
          date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      };
      
      if (noteAttachment) {
          const newAtt: Attachment = {
              id: `att-note-${Date.now()}`,
              type: noteAttachment.type === 'image' ? 'image' : 'file',
              url: noteAttachment.url,
              name: noteAttachment.name,
              date: 'Just now'
          };
          setAttachments(prev => [newAtt, ...prev]);
      }

      onUpdate({
          ...workOrder,
          notes: [...(workOrder.notes || []), note]
      });
      setNewNote('');
      setNoteAttachment(null);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setNoteAttachment({
                  url: reader.result as string,
                  name: file.name,
                  type: file.type.startsWith('image/') ? 'image' : 'file'
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDeleteAttachment = (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleStatusChange = (status: WorkOrder['status']) => {
      onUpdate({ ...workOrder, status });
  };

  const tasksByArea = useMemo(() => {
      return workOrder.tasks.reduce((acc, task) => {
          if (!acc[task.areaName]) {
              acc[task.areaName] = [];
          }
          acc[task.areaName].push(task);
          return acc;
      }, {} as Record<string, WorkOrderTask[]>);
  }, [workOrder.tasks]);

  const totalActualHours = useMemo(() => {
      return workOrder.tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
  }, [workOrder.tasks]);

  const totalAssignedHours = useMemo(() => {
      const allocations = workOrder.allocations || [];
      return allocations.reduce((total, alloc) => {
          // Parse dates as local YYYY-MM-DD
          const [sy, sm, sd] = alloc.startDate.split('-').map(Number);
          const [ey, em, ed] = alloc.endDate.split('-').map(Number);
          
          // Create dates at noon to avoid DST issues when calculating diff
          const start = new Date(sy, sm - 1, sd, 12, 0, 0);
          const end = new Date(ey, em - 1, ed, 12, 0, 0);
          
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1; 
          
          const [startH, startM] = (alloc.startTime || '08:00').split(':').map(Number);
          const [endH, endM] = (alloc.endTime || '17:00').split(':').map(Number);
          const dailyHours = Math.max(0, (endH + endM / 60) - (startH + startM / 60));
          
          return total + (days * dailyHours * (alloc.memberIds?.length || 0));
      }, 0);
  }, [workOrder.allocations]);

  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(workOrder.jobAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div id="work-order-view" className="bg-gray-50 dark:bg-gray-950 min-h-screen pb-32 font-sans text-gray-900 dark:text-gray-100 animate-in fade-in duration-300">
      
      {/* --- PREVIEW OVERLAY --- */}
      <FilePreviewModal file={viewingAttachment} onClose={() => setViewingAttachment(null)} />

      {/* --- MODALS --- */}
      <ConfirmationModal 
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => onDelete && onDelete(workOrder.id)}
        title={t('views.WorkOrderView.deleteWorkOrder')}
        message={t('views.WorkOrderView.deleteWorkOrderMessage')}
        confirmLabel={t('views.WorkOrderView.delete')}
      />

      <CrewSelectionModal 
        isOpen={isCrewModalOpen}
        onClose={() => { setIsCrewModalOpen(false); setAllocationToEdit(undefined); }}
        currentCrew={allocationToEdit ? employees.filter(e => allocationToEdit.memberIds.includes(e.id)) : []}
        onSave={handleUpdateCrewAllocation}
        allStaff={employees}
        jobStartDate={workOrder.startDate}
        jobEndDate={workOrder.endDate}
        existingJobs={allJobs}
        allocationToEdit={allocationToEdit}
        workOrderNumber={workOrder.id}
        estHours={workOrder.totalProductionHours}
        assignedHours={totalAssignedHours}
        renderedHours={totalActualHours}
        weekendDays={sched?.nonWorkingWeekdays}
        dailyCapacityHours={companyStandardDay(sched)}
        availabilityWindow={availabilityWindow}
        defaultBreaks={sched?.defaultBreaks ?? []}
      />

      <EditWorkOrderDetailsModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        type="location"
        initialData={{ jobAddress: workOrder.jobAddress, accessCode: workOrder.accessCode }}
        onSave={handleUpdateLocation}
      />

      <EditWorkOrderDetailsModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        type="schedule"
        initialData={{ startDate: workOrder.startDate, endDate: workOrder.endDate }}
        onSave={handleUpdateSchedule}
      />

      <Modal isOpen={isLogHoursOpen} onClose={() => setIsLogHoursOpen(false)} title={t('views.WorkOrderView.logRenderedHours')} maxWidth="max-w-xl">
        <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('views.WorkOrderView.updateActualHours')}</p>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {Object.entries(tasksByArea).map(([areaName, areaTasks]: [string, WorkOrderTask[]]) => (
                    <div key={areaName} className="space-y-2">
                        <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">{areaName}</h4>
                        {areaTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{task.description}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">{t('views.WorkOrderView.estimated', { hours: task.estimatedHours })}</div>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">{t('views.WorkOrderView.rendered')}</div>
                                        <input 
                                            type="number"
                                            step="0.5"
                                            value={task.actualHours || ''}
                                            onChange={(e) => handleTaskActualHoursChange(task.id, parseFloat(e.target.value) || 0)}
                                            className="w-16 text-center text-base font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded-lg border border-primary-200 dark:border-primary-800 py-1.5 focus:ring-2 focus:ring-primary-400 outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('views.WorkOrderView.totalRendered')}</span>
                    <div className="text-xl font-black text-primary-600 dark:text-primary-400">{totalActualHours.toFixed(1)} hrs</div>
                </div>
                <Button onClick={() => setIsLogHoursOpen(false)}>{t('views.WorkOrderView.done')}</Button>
            </div>
        </div>
      </Modal>

      <div className="max-w-[1100px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* --- 1. HEADER SECTION --- */}
        <div id="wo-header" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-8 relative overflow-visible">
            <div className="flex flex-wrap lg:flex-nowrap justify-between items-start lg:items-center gap-6 relative z-10">
                <div className="space-y-3 w-full lg:flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <Badge color={workOrder.status === 'Pending Deposit' ? 'amber' : (workOrder.status === 'Completed' ? 'green' : (workOrder.status === 'In Progress' ? 'purple' : (workOrder.status === 'Unscheduled' ? 'gray' : 'blue')))}>
                            {workOrder.status}
                        </Badge>
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider font-mono">#{workOrder.id}</span>
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white font-heading tracking-tight leading-tight mb-1">
                            {workOrder.jobName}
                        </h1>
                        {/* Client identity + contact — the name clicks through to the client profile. */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500 dark:text-gray-400">
                            {workOrder.clientId && onViewClient ? (
                                <button
                                    onClick={() => onViewClient(workOrder.clientId!)}
                                    className="flex items-center gap-2 font-semibold hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-4 decoration-blue-300 dark:decoration-blue-700 transition-colors"
                                    title={t('views.WorkOrderView.viewProfile')}
                                >
                                    <Users className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span>{workOrder.customerName}</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 font-semibold">
                                    <Users className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span>{workOrder.customerName}</span>
                                </div>
                            )}
                            {workOrder.customerEmail && (
                                <a
                                    href={`mailto:${workOrder.customerEmail}`}
                                    className="flex items-center gap-1.5 text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {workOrder.customerEmail}
                                </a>
                            )}
                            {workOrder.customerPhone && (
                                <a
                                    href={`tel:${workOrder.customerPhone}`}
                                    className="flex items-center gap-1.5 text-sm font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {workOrder.customerPhone}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full lg:w-auto mt-2 lg:mt-0 relative shrink-0">
                    <div className="flex items-center gap-4 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto max-w-full no-scrollbar">
                        <div className="flex flex-col min-w-[60px]">
                            <span className="text-gray-400 text-[9px] font-black uppercase tracking-[0.15em] mb-0.5">{t('views.WorkOrderView.estHours')}</span>
                            <div className="flex items-center gap-1.5 font-black text-gray-900 dark:text-white">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-lg leading-none">{workOrder.totalProductionHours}</span>
                            </div>
                        </div>

                        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 shrink-0" />
                        
                        <div className="flex flex-col min-w-[60px]">
                            <span className="text-gray-400 text-[9px] font-black uppercase tracking-[0.15em] mb-0.5">{t('views.WorkOrderView.assigned')}</span>
                            <div className="flex items-center gap-1.5 font-black text-gray-900 dark:text-white">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-lg leading-none">{totalAssignedHours.toFixed(1)}</span>
                            </div>
                        </div>

                        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 shrink-0" />

                        <div className="flex flex-col p-1 -m-1 rounded-lg text-left min-w-[60px]">
                            <span className="text-primary-500 text-[9px] font-black uppercase tracking-[0.15em] mb-0.5">{t('views.WorkOrderView.rendered')}</span>
                            <div className="flex items-center gap-1.5 font-black text-primary-600 dark:text-primary-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-lg leading-none">{totalActualHours.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                        <Button 
                            size="md" 
                            variant="secondary"
                            className="font-bold px-4 h-11 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800"
                            onClick={() => setIsLogHoursOpen(true)}
                        >
                            <Clock className="w-4 h-4 mr-2" /> {t('views.WorkOrderView.logHours')}
                        </Button>

                        {workOrder.status === 'Scheduled' && (
                            <Button 
                                size="md" 
                                variant="primary" 
                                className="shadow-lg shadow-primary-500/20 font-black h-11 px-5"
                                onClick={() => handleStatusChange('In Progress')}
                            >
                                <PlayCircle className="w-4 h-4 mr-2" /> {t('views.WorkOrderView.startJob')}
                            </Button>
                        )}

                        {workOrder.status === 'In Progress' && (
                            <Button 
                                size="md" 
                                variant="primary" 
                                className="shadow-lg shadow-blue-500/20 font-black h-11 px-5"
                                onClick={() => handleStatusChange('Completed')}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {t('views.WorkOrderView.markComplete')}
                            </Button>
                        )}
                        
                        {workOrder.status === 'Completed' && (
                            <Button 
                                size="md" 
                                variant="secondary" 
                                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold h-11 px-5"
                                onClick={() => handleStatusChange('In Progress')}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" /> {t('views.WorkOrderView.revertStatus')}
                            </Button>
                        )}
                        
                        {workOrder.status === 'Unscheduled' && (
                            <Button 
                                size="md" 
                                variant="primary"
                                className="font-black h-11 px-5"
                                onClick={() => setIsScheduleModalOpen(true)}
                            >
                                <Calendar className="w-4 h-4 mr-2" /> {t('views.WorkOrderView.schedule')}
                            </Button>
                        )}

                        <div className="ml-1">
                            <KebabMenu 
                                items={[
                                    { label: t('views.WorkOrderView.shareWorkOrder'), icon: Share2, onClick: () => {} },
                                    { label: t('views.WorkOrderView.editSchedule'), icon: Calendar, onClick: () => setIsScheduleModalOpen(true) },
                                    { label: t('views.WorkOrderView.markUnscheduled'), icon: Clock, onClick: () => handleStatusChange('Unscheduled') },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* --- 2. LOCATION & CREW ALLOCATIONS (SIDE BY SIDE) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Location Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative flex flex-col h-full">
                <button 
                    onClick={() => setIsLocationModalOpen(true)}
                    className="absolute top-4 right-4 z-20 p-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-full transition-all"
                    title={t('views.WorkOrderView.editLocation')}
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <div className="p-6 pb-2">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">{t('views.WorkOrderView.jobLocation')}</h4>
                    </div>
                    <div className="font-medium text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-4">
                        {workOrder.jobAddress}
                    </div>
                    
                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 block">{t('views.WorkOrderView.gateAccessCode')}</label>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 w-full">
                            <input 
                                type="text" 
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="bg-transparent border-none text-xl font-bold text-gray-900 dark:text-white w-full focus:ring-0 placeholder-gray-300 dark:placeholder-gray-600"
                                placeholder="----"
                            />
                        </div>
                    </div>
                </div>
                
                {/* Map - Fixed Height at bottom */}
                <div className="flex-1 min-h-[180px] bg-gray-100 dark:bg-gray-800 relative border-t border-gray-200 dark:border-gray-700">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        scrolling="no" 
                        marginHeight={0} 
                        marginWidth={0} 
                        src={mapUrl}
                        className="absolute inset-0 w-full h-full grayscale-[20%] dark:invert-[.85] hover:grayscale-0 transition-all duration-500"
                        title={t('views.WorkOrderView.jobLocationMap')}
                    ></iframe>
                </div>
            </div>

            {/* Crew Allocations Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-0 flex flex-col relative group h-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"><Users className="w-4 h-4" /></div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('views.WorkOrderView.crewAndSchedule')}</h3>
                    </div>
                    <button 
                        onClick={() => { setAllocationToEdit(undefined); setIsCrewModalOpen(true); }} 
                        className="text-xs font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('views.WorkOrderView.addShift')}
                    </button>
                </div>
                
                <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                    {workOrder.allocations && workOrder.allocations.length > 0 ? (
                        workOrder.allocations.map((alloc) => (
                            <div key={alloc.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:border-primary-200 dark:hover:border-primary-800 transition-all group/alloc relative">
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/alloc:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => { setAllocationToEdit(alloc); setIsCrewModalOpen(true); }}
                                        className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors shadow-sm"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteAllocation(alloc.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors shadow-sm"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex justify-between items-start mb-3 pr-16">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{alloc.name}</h4>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(alloc.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                                            {alloc.endDate !== alloc.startDate && ` - ${new Date(alloc.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700">
                                            {alloc.startTime} - {alloc.endTime}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {alloc.memberIds.map(mid => {
                                        const mem = employees.find(e => e.id === mid);
                                        if (!mem) return null;
                                        return (
                                            <div key={mid} className="flex items-center gap-2 bg-white dark:bg-gray-800 pl-1 pr-2 py-1 rounded-full border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <img src={mem.photo} className="w-5 h-5 rounded-full bg-gray-200" alt={mem.name} />
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{mem.name.split(' ')[0]}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        // Fallback for legacy data or empty state
                        <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3 text-gray-400">
                                <Users className="w-6 h-6" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t('views.WorkOrderView.noCrewsAssigned')}</p>
                            <Button
                                variant="secondary"
                                onClick={() => { setAllocationToEdit(undefined); setIsCrewModalOpen(true); }}
                                className="text-xs mx-auto"
                            >
                                {t('views.WorkOrderView.assignCrew')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* --- 3. GENERAL INSTRUCTIONS (One Row Per Card) --- */}
        <div className="flex flex-col gap-6">
            {workOrder.areasExcluded && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base mb-4">
                        {t('views.WorkOrderView.areasExcluded')}
                    </h4>
                    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {workOrder.areasExcluded}
                    </div>
                </div>
            )}
            
            {workOrder.existingConditions && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base mb-4">
                        {t('views.WorkOrderView.existingConditions')}
                    </h4>
                    <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {workOrder.existingConditions}
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-4">{t('views.WorkOrderView.companyResponsibilities')}</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        {t('views.WorkOrderView.companyResp1')}
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        {t('views.WorkOrderView.companyResp2')}
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        {t('views.WorkOrderView.companyResp3')}
                    </li>
                </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-4">{t('views.WorkOrderView.customerResponsibilities')}</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        {t('views.WorkOrderView.customerResp1')}
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        {t('views.WorkOrderView.customerResp2')}
                    </li>
                </ul>
            </div>
        </div>

        {/* --- 4. PAINT SCHEDULE --- */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-700 dark:text-primary-400"><Users className="w-4 h-4" /></div> 
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('views.WorkOrderView.paintColorCard')}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrder.paintSchedule.map(paint => {
                    const product = materials?.find(m => m.id === paint.productId);
                    return (
                    <div key={paint.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center font-bold text-sm text-gray-800 dark:text-gray-200 shadow-sm">
                                {paint.colorCode}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-white text-sm">{paint.colorName}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    {product ? product.name : (paint.productId || t('views.WorkOrderView.unknownProduct'))}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{paint.finish}</div>
                            </div>
                        </div>
                    </div>
                )})}
                {workOrder.paintSchedule.length === 0 && <p className="text-gray-400 dark:text-gray-500 italic text-sm p-4">{t('views.WorkOrderView.noPaintAssigned')}</p>}
            </div>
        </div>

        {/* --- 5. JOB DETAILS (Tasks) - Grouped by Area --- */}
        <div className="space-y-6" id="wo-job-details">
           <div className="flex items-center justify-between px-1 mb-2">
              <h2 className={Typography.h3}>{t('views.WorkOrderView.jobDetails')}</h2>
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">{t('views.WorkOrderView.totalSurfaces', { count: workOrder.tasks.length })}</span>
           </div>

           {Object.entries(tasksByArea).map(([areaName, areaTasks]: [string, WorkOrderTask[]]) => {
              const areaTotalHours = areaTasks.reduce((sum, t) => sum + t.estimatedHours, 0);
              
              return (
                <div key={areaName} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                   {/* Area Header */}
                   <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">{areaName}</h3>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('views.WorkOrderView.totalAreaHours')}</span>
                         <span className="font-black text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm text-sm">{areaTotalHours.toFixed(1)}</span>
                      </div>
                   </div>
                   
                   {/* Task Rows */}
                   <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {areaTasks.map(task => {
                         // Resolve Paint Info
                         const paintDetails = workOrder.paintSchedule.find(p => p.colorCode === task.paintColorCode);
                         
                         return (
                         <div key={task.id} className="p-6 hover:bg-gray-50/30 dark:hover:bg-gray-700/30 transition-colors">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                               
                               {/* Description & Qty & Coats - Updated for prominence */}
                               <div className="md:col-span-4 space-y-2">
                                  <h4 className="font-bold text-gray-900 dark:text-white text-lg">{task.description}</h4>
                                  <div className="flex flex-wrap items-center gap-3">
                                     {/* Quantity with Unit */}
                                     <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm">
                                         {task.quantity} <span className="text-gray-500 dark:text-gray-400 font-normal text-xs uppercase ml-0.5">{task.uom}</span>
                                     </span>
                                     
                                     {/* Coats - Prominent */}
                                     <span className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold text-sm flex items-center gap-1.5 shadow-sm">
                                         <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-extrabold">Coats</span>
                                         {task.coats}
                                     </span>
                                  </div>
                               </div>

                               {/* Preparation Checklist - Updated for clarity */}
                               <div className="md:col-span-4">
                                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{t('views.WorkOrderView.preparation')}</div>
                                  <div className="flex flex-wrap gap-2">
                                     {['Wash', 'Scrape', 'Caulk', 'Prime'].map(step => {
                                        const key = `prep${step}` as keyof WorkOrderTask;
                                        // Some records might use generic 'prep' for scrape
                                        const isActive = task[key] || (step === 'Scrape' && task.prepScrape) || (step === 'Prime' && task.prepPrime);
                                        
                                        return (
                                           <div key={step} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${isActive ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-100 dark:border-gray-600 text-gray-400 dark:text-gray-500'}`}>
                                              {isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-500" /> : <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
                                              <span className="text-xs font-bold uppercase tracking-wide">{step}</span>
                                           </div>
                                        )
                                     })}
                                  </div>
                               </div>

                               {/* Paint Info */}
                               <div className="md:col-span-2">
                                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{t('views.WorkOrderView.paint')}</div>
                                  {task.paintColorCode ? (
                                     <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-black text-gray-700 dark:text-gray-300 shadow-sm shrink-0">
                                           {task.paintColorCode}
                                        </div>
                                        <div className="min-w-0">
                                           {/* Updated Order: Color Name -> Product -> Sheen */}
                                           <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                {paintDetails?.colorName || t('views.WorkOrderView.unknownColor')}
                                           </div>
                                           <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                {task.paintProduct}
                                           </div>
                                           <div className="text-[10px] text-gray-500 dark:text-gray-400">{task.paintSheen}</div>
                                        </div>
                                     </div>
                                  ) : (
                                     <span className="text-xs text-gray-400 dark:text-gray-500 italic">{t('views.WorkOrderView.noneAssigned')}</span>
                                  )}
                               </div>

                               {/* Hours - Added Rendered Column - Darkened Est. Hrs as requested */}
                               <div className="md:col-span-2 flex justify-between md:justify-around text-center border-l border-gray-100 dark:border-gray-700 md:pl-4">
                                   <div>
                                       <div className="text-lg font-bold text-gray-900 dark:text-white">{task.estimatedHours.toFixed(1)}</div>
                                       <div className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">{t('views.WorkOrderView.estHrs')}</div>
                                   </div>
                                   <div className="h-8 w-px bg-gray-100 dark:bg-gray-700 mx-2 hidden md:block"></div>
                                   <div>
                                       <input 
                                          type="number"
                                          step="0.5"
                                          value={task.actualHours || ''}
                                          onChange={(e) => handleTaskActualHoursChange(task.id, parseFloat(e.target.value) || 0)}
                                          className="w-12 text-center text-lg font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded-lg border border-primary-100 dark:border-primary-800 focus:ring-2 focus:ring-primary-400 outline-none"
                                          placeholder="0"
                                       />
                                       <div className="text-[9px] font-bold text-primary-400 uppercase">{t('views.WorkOrderView.rendered')}</div>
                                   </div>
                               </div>

                            </div>
                         </div>
                      )})}
                   </div>
                </div>
              );
           })}
        </div>

        {/* --- 6. FIELD NOTES & ATTACHMENTS - Redesigned as a standard notes entry thing --- */}
        <Card className="p-6 flex flex-col border border-gray-200 dark:border-gray-700 shadow-sm mt-8 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary-500" /> {t('views.WorkOrderView.fieldNotesFeed')}
                </h4>
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.WorkOrderView.projectLog')}</span>
            </div>

            {/* Note Thread */}
            <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {(workOrder.notes || []).map((note, idx) => (
                    <div key={note.id || idx} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold shrink-0">
                            {note.author.charAt(0)}
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-2xl rounded-tl-none p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black text-gray-900 dark:text-white">{note.author}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">{note.date}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                        </div>
                    </div>
                ))}
                {(workOrder.notes || []).length === 0 && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic text-sm bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        {t('views.WorkOrderView.noNotesLogged')}
                    </div>
                )}
            </div>
            
            {/* Note Entry Area - Refined as a standard notes block per request */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 block">{t('views.WorkOrderView.addNewNote')}</label>
                <div className="space-y-4">
                    <textarea 
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-gray-800 transition-all resize-none min-h-[120px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                        placeholder={t('views.WorkOrderView.notePlaceholder')}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                    />
                    
                    {noteAttachment && (
                        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                            {noteAttachment.type === 'image' ? (
                                <img src={noteAttachment.url} className="w-full h-full object-cover" alt={t('views.WorkOrderView.attachmentPreview')} />
                            ) : (
                                <div className="flex flex-col items-center gap-1 p-2 text-center">
                                    <File className="w-8 h-8 text-blue-500" />
                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 line-clamp-2">{noteAttachment.name}</span>
                                </div>
                            )}
                            <button 
                                onClick={() => setNoteAttachment(null)}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <div>
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                accept="*" 
                                onChange={handleFileAttach} 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white transition-all rounded-xl font-bold text-sm border border-gray-200 dark:border-gray-600"
                            >
                                <Paperclip className="w-4 h-4" /> {t('views.WorkOrderView.attachFile')}
                            </button>
                        </div>
                        <Button 
                            onClick={handleAddNote}
                            disabled={!newNote.trim() && !noteAttachment}
                            className="shadow-lg shadow-primary-500/20 font-bold px-6"
                        >
                            {t('views.WorkOrderView.saveNote')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Photos & Files Section */}
            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-gray-400" /> {t('views.WorkOrderView.sitePhotosAttachments')}
                    </h4>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.WorkOrderView.itemsCount', { count: attachments.length })}</span>
                </div>

                {attachments.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
                        {attachments.map((file) => (
                            <div key={file.id} className="relative group rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-xl transition-all h-[280px] flex flex-col">
                                {file.type === 'image' ? (
                                    <div className="h-48 bg-gray-50 dark:bg-gray-900 relative flex flex-col shrink-0">
                                        <div className="flex-1 relative cursor-pointer overflow-hidden" onClick={() => setViewingAttachment(file)}>
                                            <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <div className="p-2 bg-white/90 rounded-xl text-gray-900 font-bold text-xs flex items-center gap-2 shadow-lg">
                                                    <Eye className="w-4 h-4" /> {t('views.WorkOrderView.view')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-48 bg-gray-50 dark:bg-gray-900 flex flex-col relative group cursor-pointer border-b border-gray-100 dark:border-gray-700 shrink-0" onClick={() => setViewingAttachment(file)}>
                                        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                                                <File className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 line-clamp-2 leading-tight break-all px-2 w-full">{file.name}</span>
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-black uppercase tracking-tight">{file.size}</span>
                                        </div>
                                        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                    </div>
                                )}
                                <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-50 dark:border-gray-700 flex-1 flex flex-col justify-between">
                                    <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate mb-1">{file.name}</div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-wider">{file.date}</div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(file.id); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-white dark:hover:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 transition-all cursor-pointer group bg-gray-50/50 dark:bg-gray-900/50">
                    <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 mb-2 transition-colors" />
                    <span className="text-xs font-black text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 uppercase tracking-widest">{t('views.WorkOrderView.uploadPhotosFiles')}</span>
                </div>
            </div>
        </Card>

        <div className="h-12"></div> 
      </div>
    </div>
  );
};
