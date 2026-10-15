
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { ChevronLeft, ChevronRight, User, MapPin, CheckCircle2, Clock, Filter, Plus, ChevronDown, Calendar, LayoutGrid, List, Columns, Trash2, Edit2, GripVertical, Briefcase, Ruler, AlertCircle, PanelRight, X, UserCircle, Check, Users, Lock, CloudRain, CalendarRange } from 'lucide-react';
import { Appointment, CrewMember, Job, WorkOrder, GlobalSettings, CalendarDayMark } from '../../types';
import { Typography, Spacing } from '../../theme/designSystem';
import { Button, Card, Badge, Modal, Tooltip } from '../UI';
import { ScheduleJobModal } from '../modals/ScheduleJobModal';
import { configFromSettings } from '../../services/scheduleEngine';

interface SalesCalendarViewProps {
  appointments: Appointment[];
  allStaff: CrewMember[];

  // Production Data
  jobs?: Job[];
  workOrders?: WorkOrder[];
  onUpdateJob?: (job: Job) => void;
  settings?: GlobalSettings;
  onViewJob?: (id: string) => void;

  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onUpdateAppointment?: (appointment: Appointment) => void;
  onDeleteAppointment?: (id: string) => void;
  onEditAppointment?: (appointment: Appointment) => void;
  onCreateEstimateFromAppointment: (appointment: Appointment) => void;
  onScheduleNew: () => void;
}

type ViewRange = 'Month' | 'Week' | 'Day';
type TabMode = 'Sales' | 'Production';

// Time Grid Constants
const START_HOUR = 0; 
const END_HOUR = 24; 
const HOURS_COUNT = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 64; 
const COLUMN_WIDTH_DAY = 140; 
const COLUMN_WIDTH_WEEK = 240;
const COLUMN_WIDTH_MONTH = 180;

const EMPTY_IMAGE = new Image();
EMPTY_IMAGE.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Lay overlapping events into side-by-side columns so none are hidden behind
// another. Returns a map of event id -> { col, cols }: the column index and the
// number of columns in that event's overlap cluster.
const computeOverlapLayout = (events: { id: string; start: Date; end: Date }[]) => {
  const layout = new Map<string, { col: number; cols: number }>();
  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  );
  let cluster: typeof sorted = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columnEnds: number[] = [];
    const colOf = new Map<string, number>();
    for (const ev of cluster) {
      const s = ev.start.getTime();
      let placed = -1;
      for (let i = 0; i < columnEnds.length; i++) {
        if (columnEnds[i] <= s) { columnEnds[i] = ev.end.getTime(); placed = i; break; }
      }
      if (placed === -1) { placed = columnEnds.length; columnEnds.push(ev.end.getTime()); }
      colOf.set(ev.id, placed);
    }
    const cols = Math.max(1, columnEnds.length);
    for (const ev of cluster) layout.set(ev.id, { col: colOf.get(ev.id) ?? 0, cols });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of sorted) {
    if (cluster.length && ev.start.getTime() >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end.getTime());
  }
  if (cluster.length) flush();
  return layout;
};

export const SalesCalendarView = ({
    appointments,
    allStaff,
    jobs = [],
    workOrders = [],
    onUpdateJob,
    settings,
    onViewJob,
    onUpdateAppointmentStatus,
    onUpdateAppointment,
    onDeleteAppointment,
    onEditAppointment,
    onCreateEstimateFromAppointment,
    onScheduleNew
}: SalesCalendarViewProps) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewRange, setViewRange] = useState<ViewRange>('Month'); 
  const [isDispatchMode, setIsDispatchMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>('Sales');
  
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const hasInitializedStaff = useRef(false);

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{ type: 'appointment' | 'job', data: any } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ date: Date, hour: number, minute: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
  
  const [jobToSchedule, setJobToSchedule] = useState<Job | null>(null);
  const [isJobScheduleModalOpen, setIsJobScheduleModalOpen] = useState(false);


  // Working-time config derived from settings (falls back to defaults).
  const workConfig = useMemo(() => configFromSettings(settings?.scheduling, false), [settings?.scheduling]);
  const WORK_START_HOUR = workConfig.workDayStartHour;
  const WORK_END_HOUR = workConfig.workDayEndHour;

  // Lookup of marked rain days for visual treatment.
  const rainDayMap = useMemo(() => {
    const map = new Map<string, CalendarDayMark>();
    (settings?.scheduling?.rainDays || []).forEach((r) => map.set(r.date, r));
    return map;
  }, [settings?.scheduling?.rainDays]);

  const toLocalDateKey = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  // Each job shows once, on its start day (single-day model). Appointments too.
  const eventOccupiesDay = (ev: any, dayDate: Date) =>
    toLocalDateKey(ev.start) === toLocalDateKey(dayDate);

  // A job's on-screen block is capped to its start day (8am–5pm) even if its
  // end date is later — the end date is metadata, not a multi-day span.
  const blockEnd = (ev: any) => {
    if (toLocalDateKey(ev.start) === toLocalDateKey(ev.end)) return ev.end;
    return new Date(ev.start.getFullYear(), ev.start.getMonth(), ev.start.getDate(), WORK_END_HOUR, 0, 0, 0);
  };

  // Multi-day info for a job whose end date is on a later day than its start.
  // Used to badge a single-day-displayed job so its true span is visible.
  const multiDayInfo = (ev: any): { days: number; endLabel: string } | null => {
    if (ev.type !== 'job') return null;
    if (toLocalDateKey(ev.start) === toLocalDateKey(ev.end)) return null;
    const s = new Date(ev.start); s.setHours(0, 0, 0, 0);
    const e = new Date(ev.end); e.setHours(0, 0, 0, 0);
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    const endLabel = new Date(ev.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { days, endLabel };
  };


  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const dispatchHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (!hasInitializedStaff.current && allStaff.length > 0) {
          setSelectedStaffIds(allStaff.map(s => s.id));
          hasInitializedStaff.current = true;
      }
  }, [allStaff]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
        if (draggedItem) {
            setDraggedItem(null);
            setDragPreview(null);
            setCursorPos(null);
        }
    };
    
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, [draggedItem]);

  // --- Date Helpers ---
  const navigate = (dir: number) => {
     const newDate = new Date(currentDate);
     if (viewRange === 'Month') {
         newDate.setMonth(newDate.getMonth() + dir);
     } else if (viewRange === 'Week') {
         newDate.setDate(newDate.getDate() + (dir * 7));
     } else {
         newDate.setDate(newDate.getDate() + dir);
     }
     setCurrentDate(newDate);
  };

  const getWeekDays = (date: Date) => {
      const start = new Date(date);
      const day = start.getDay();
      const diff = start.getDate() - day;
      start.setDate(diff);
      start.setHours(0,0,0,0);
      
      return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return d;
      });
  };

  const getMonthDays = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  };

  const isToday = (date: Date) => {
      const today = new Date();
      return date.getDate() === today.getDate() && 
             date.getMonth() === today.getMonth() && 
             date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getFullYear() === d2.getFullYear();
  }

  const getHeaderDateLabel = () => {
      if (viewRange === 'Month') {
          return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      }
      if (viewRange === 'Day') {
          return currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
      }
      if (viewRange === 'Week') {
          const days = getWeekDays(currentDate);
          const start = days[0];
          const end = days[6];
          const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          if (start.getFullYear() !== end.getFullYear()) {
             return `${startStr}, ${start.getFullYear()} - ${endStr}, ${end.getFullYear()}`;
          }
          return `${startStr} - ${endStr}, ${start.getFullYear()}`;
      }
      return '';
  };
  
  // Custom Mini Calendar
  const MiniCalendar = () => {
      const [pickerDate, setPickerDate] = useState(new Date(currentDate));
      
      const year = pickerDate.getFullYear();
      const month = pickerDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startDayOffset = new Date(year, month, 1).getDay();
      
      const grid = [];
      for(let i=0; i<startDayOffset; i++) grid.push(null);
      for(let i=1; i<=daysInMonth; i++) grid.push(new Date(year, month, i));

      const busyDateSet = useMemo(() => {
          const set = new Set<string>();
          filteredEvents.forEach(ev => {
              const d = new Date(ev.start);
              if (d.getMonth() === month && d.getFullYear() === year) {
                  set.add(d.getDate().toString());
              }
          });
          return set;
      }, [month, year, filteredEvents]);

      const handlePrev = (e: React.MouseEvent) => { e.stopPropagation(); setPickerDate(new Date(year, month - 1, 1)); }
      const handleNext = (e: React.MouseEvent) => { e.stopPropagation(); setPickerDate(new Date(year, month + 1, 1)); }
      
      const selectDate = (d: Date) => {
          setCurrentDate(d);
          setIsDatePickerOpen(false);
      }

      return (
          <div className="bg-white dark:bg-gray-800 p-4 w-72 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                  <button onClick={handlePrev} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">{pickerDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={handleNext} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-7 mb-2">
                  {[t('views.SalesCalendarView.miniDaySu'), t('views.SalesCalendarView.miniDayMo'), t('views.SalesCalendarView.miniDayTu'), t('views.SalesCalendarView.miniDayWe'), t('views.SalesCalendarView.miniDayTh'), t('views.SalesCalendarView.miniDayFr'), t('views.SalesCalendarView.miniDaySa')].map(d => <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                  {grid.map((d, i) => (
                      <div key={i} className="h-9 flex items-center justify-center">
                          {d ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); selectDate(d); }}
                                className={`w-8 h-8 rounded-full text-sm flex flex-col items-center justify-center transition-all relative ${
                                    isSameDay(d, currentDate) ? 'bg-primary-600 text-white font-bold shadow-md' : 
                                    isToday(d) ? 'text-primary-600 font-bold bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-100 dark:ring-primary-900' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium'
                                }`}
                              >
                                  <span className="z-10">{d.getDate()}</span>
                                  {busyDateSet.has(d.getDate().toString()) && (
                                      <div className={`w-1 h-1 rounded-full absolute bottom-1.5 ${isSameDay(d, currentDate) ? 'bg-white' : 'bg-primary-500'}`}></div>
                                  )}
                              </button>
                          ) : <div />}
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // --- DATA SOURCES ---
  interface CalendarEvent {
      id: string;
      title: string;
      start: Date;
      end: Date;
      status: string;
      type: 'appointment' | 'job';
      data: any; 
      colorClass: string;
      assigneeId?: string | string[]; 
  }

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
      const events: CalendarEvent[] = [];

      appointments.forEach(app => {
          const start = new Date(app.date);
          const end = new Date(start.getTime() + (app.durationMinutes * 60000));
          
          events.push({
              id: app.id,
              title: app.title.replace('Estimate: ', ''),
              start,
              end,
              status: app.status,
              type: 'appointment',
              data: app,
              assigneeId: app.estimatorId,
              colorClass: app.status === 'Completed' 
                  ? 'bg-green-50 border-green-500 text-green-900 dark:bg-green-900/40 dark:text-green-200 dark:border-green-600' 
                  : 'bg-purple-50 border-purple-500 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-600'
          });
      });

      jobs.forEach(job => {
          if (!job.startDate) return;
          
          const start = new Date(job.startDate);
          // Default to the work-day start only when no explicit time is stored,
          // so cascade hour-shifts (which set real times) remain visible.
          if (start.getHours() === 0 && start.getMinutes() === 0) start.setHours(WORK_START_HOUR, 0, 0, 0);
          const end = new Date(job.endDate || job.startDate);
          if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(WORK_END_HOUR, 0, 0, 0);
          
          events.push({
              id: job.id,
              title: job.name,
              start,
              end,
              status: job.stage,
              type: 'job',
              data: job,
              assigneeId: job.crewMemberIds,
              colorClass: job.stage === 'Completed'
                  ? 'bg-green-100 border-green-600 text-green-900 dark:bg-green-900/50 dark:text-green-200 dark:border-green-500'
                  : 'bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-500'
          });
      });
      return events;
  }, [appointments, jobs]);

  // Filter events based on selected staff
  const filteredEvents = useMemo(() => {
      if (selectedStaffIds.length === 0) return [];

      return calendarEvents.filter(ev => {
          if (ev.type === 'appointment') {
              return selectedStaffIds.includes(ev.assigneeId as string);
          } else {
              const assignees = ev.assigneeId as string[];
              if (!assignees || assignees.length === 0) return false;
              return assignees.some(id => selectedStaffIds.includes(id));
          }
      });
  }, [calendarEvents, selectedStaffIds]);

  const upcomingAppointments = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return appointments
          .filter(app => new Date(app.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appointments]);

  const productionJobs = useMemo(() => {
      return {
          unscheduled: jobs.filter(j => !j.startDate),
          scheduled: jobs.filter(j => j.startDate && j.stage !== 'Completed' && j.stage !== 'Marketing')
      };
  }, [jobs]);

  // --- Handlers ---
  const handleMarkComplete = () => {
      if (selectedAppointment) {
          onUpdateAppointmentStatus(selectedAppointment.id, 'Completed');
          onCreateEstimateFromAppointment(selectedAppointment);
          setSelectedAppointment(null);
      }
  };
  
  const getFilterLabel = () => {
      if (selectedStaffIds.length === allStaff.length) return 'All Staff';
      if (selectedStaffIds.length === 0) return 'None';
      if (selectedStaffIds.length === 1) {
          return allStaff.find(s => s.id === selectedStaffIds[0])?.name || '1 Selected';
      }
      return `${selectedStaffIds.length} Selected`;
  };

  // DnD Handlers
  const handleDragStart = (e: React.DragEvent, item: { type: 'appointment' | 'job', data: any }) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(EMPTY_IMAGE, 0, 0);

      let initialDate: Date;
      if (item.type === 'appointment') {
          initialDate = new Date(item.data.date);
      } else {
          initialDate = new Date(); 
      }

      setDragPreview({
          date: initialDate,
          hour: initialDate.getHours(),
          minute: initialDate.getMinutes()
      });
      setCursorPos({ x: e.clientX, y: e.clientY });

      requestAnimationFrame(() => {
          setDraggedItem(item);
      });
  };

  const handleDrag = (e: React.DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) return;
      if (!cursorPos || Math.abs(cursorPos.x - e.clientX) > 5 || Math.abs(cursorPos.y - e.clientY) > 5) {
          setCursorPos({ x: e.clientX, y: e.clientY });
      }
  };

  const handleDragEnd = () => {
      setDraggedItem(null);
      setDragPreview(null);
      setCursorPos(null);
  };

  const handleDragOverSlot = (e: React.DragEvent, date: Date, hour: number, minute: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move"; 

      if (!draggedItem) return;

      if (
          !dragPreview ||
          dragPreview.date.getTime() !== date.getTime() ||
          dragPreview.hour !== hour ||
          dragPreview.minute !== minute
      ) {
          setDragPreview({ date, hour, minute });
      }
  };

  const handleDropOnSlot = (date: Date, hour: number, minuteInterval: number = 0) => {
      if (!draggedItem) return;

      if (draggedItem.type === 'appointment' && onUpdateAppointment) {
          const app = draggedItem.data as Appointment;
          const newStart = new Date(date);
          newStart.setHours(hour, minuteInterval, 0, 0); 
          const updatedApp = { ...app, date: newStart.toISOString() };
          onUpdateAppointment(updatedApp);
      } 
      else if (draggedItem.type === 'job') {
          const job = draggedItem.data as Job;
          const newStart = new Date(date);
          setJobToSchedule({ ...job, startDate: newStart.toISOString() });
          setIsJobScheduleModalOpen(true);
      }

      setDraggedItem(null);
      setDragPreview(null);
      setCursorPos(null);
  };
  
  const handleDeleteClick = () => {
      if (selectedAppointment && onDeleteAppointment) {
          if (window.confirm(t('views.SalesCalendarView.deleteConfirm'))) {
              onDeleteAppointment(selectedAppointment.id);
              setSelectedAppointment(null);
          }
      }
  };
  
  const handleEditClick = () => {
      if (selectedAppointment && onEditAppointment) {
          onEditAppointment(selectedAppointment);
          setSelectedAppointment(null);
      }
  };

  const handleOpenScheduleModal = (job: Job) => {
      setJobToSchedule({ ...job, startDate: new Date().toISOString() });
      setIsJobScheduleModalOpen(true);
  };

  const handleJobScheduleSave = (data: { startDate: string; endDate: string; crewIds: string[] }) => {
      if (jobToSchedule && onUpdateJob) {
          onUpdateJob({
              ...jobToSchedule,
              startDate: data.startDate,
              endDate: data.endDate,
              crewMemberIds: data.crewIds,
              stage: 'Scheduled'
          });
      }
      setIsJobScheduleModalOpen(false);
      setJobToSchedule(null);
  };

  // --- RENDERERS ---

  const renderFloatingCard = () => {
      if (!draggedItem || !cursorPos) return null;

      const title = draggedItem.type === 'appointment' 
        ? draggedItem.data.title.replace('Estimate: ', '') 
        : draggedItem.data.name;

      const color = draggedItem.type === 'appointment' 
        ? 'bg-blue-500 border-blue-700' 
        : 'bg-amber-500 border-amber-700';

      return (
          <div 
            className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 w-48"
            style={{ 
                left: cursorPos.x, 
                top: cursorPos.y,
            }}
          >
             <div className={`rounded-xl border-l-4 shadow-2xl p-3 text-left ${color} text-white ring-2 ring-white opacity-90`}>
                 <div className="font-bold text-sm leading-tight mb-1">
                     {title}
                 </div>
                 <div className="text-xs opacity-90 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 
                      {dragPreview ? (() => {
                          const dt = new Date(dragPreview.date);
                          dt.setHours(dragPreview.hour, dragPreview.minute);
                          return dt.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
                      })() : (draggedItem.type === 'appointment' ? new Date(draggedItem.data.date).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : t('views.SalesCalendarView.newTime'))}
                 </div>
             </div>
          </div>
      );
  };

  const renderDispatchView = () => {
      const relevantStaff = allStaff.filter(s => selectedStaffIds.includes(s.id));
      
      let columns: { id: string, label: string, date?: Date }[] = [];
      let colWidth = COLUMN_WIDTH_DAY;

      if (viewRange === 'Day') {
          columns = Array.from({ length: HOURS_COUNT }, (_, i) => {
              const h = i + START_HOUR;
              return {
                  id: h.toString(),
                  label: h === 0 ? '12 AM' : (h > 12 ? `${h-12} PM` : (h === 12 ? '12 PM' : `${h} AM`))
              };
          });
          colWidth = COLUMN_WIDTH_DAY;
      } else if (viewRange === 'Week') {
          const days = getWeekDays(currentDate);
          columns = days.map(d => ({
              id: d.toISOString(),
              label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
              date: d
          }));
          colWidth = COLUMN_WIDTH_WEEK;
      } else if (viewRange === 'Month') {
          const days = getMonthDays(currentDate);
          columns = days.map(d => ({
              id: d.toISOString(),
              label: d.getDate().toString(),
              date: d
          }));
          colWidth = COLUMN_WIDTH_MONTH;
      }

      const totalWidth = columns.length * colWidth;

      return (
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
              {/* Timeline Header */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 z-20 shadow-sm">
                  <div className="w-64 flex-shrink-0 p-4 border-r border-gray-100 dark:border-gray-700 flex items-end pb-2 bg-white dark:bg-gray-800 z-30">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('views.SalesCalendarView.employeeCol')}</span>
                  </div>
                  <div 
                    className="flex-1 overflow-hidden bg-gray-50/50 dark:bg-gray-800/50" 
                    ref={dispatchHeaderRef}
                  >
                      <div className="flex" style={{ width: totalWidth }}>
                          {columns.map(col => (
                              <div key={col.id} className="flex-shrink-0 border-r border-gray-200/50 dark:border-gray-700 text-xs font-bold text-gray-400 p-2 text-center uppercase tracking-wider" style={{ width: colWidth }}>
                                  {col.label}
                                  {col.date && isToday(col.date) && (
                                      <div className="text-[9px] text-primary-600 dark:text-primary-400 mt-1">{t('views.SalesCalendarView.todayLabel')}</div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Grid Body - FIXED: Changed flex-1 to h-fit max-h-full to keep scrollbar closer to rows */}
              <div 
                className="flex-initial overflow-auto custom-scrollbar h-fit max-h-full"
                onScroll={(e) => {
                    if (dispatchHeaderRef.current) {
                        dispatchHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
                    }
                }}
              >
                  <div className="min-w-max">
                      {relevantStaff.map(employee => {
                          const employeeEvents = calendarEvents.filter(ev => {
                              if (viewRange === 'Day') {
                                  if (!isSameDay(ev.start, currentDate)) return false;
                              } else if (viewRange === 'Week') {
                                  const weekDays = getWeekDays(currentDate);
                                  const start = weekDays[0];
                                  const end = new Date(weekDays[6]);
                                  end.setHours(23,59,59,999);
                                  if (ev.start < start || ev.start > end) return false;
                              } else if (viewRange === 'Month') {
                                  if (ev.start.getMonth() !== currentDate.getMonth() || ev.start.getFullYear() !== currentDate.getFullYear()) return false;
                              }

                              if (ev.type === 'appointment') {
                                  return ev.assigneeId === employee.id;
                              } else {
                                  return Array.isArray(ev.assigneeId) && ev.assigneeId.includes(employee.id);
                              }
                          });

                          return (
                              <div key={employee.id} className="flex border-b border-gray-100 dark:border-gray-700 min-h-[64px] group/row hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                  {/* Employee Column */}
                                  <div className="w-64 flex-shrink-0 p-3 border-r border-gray-100 dark:border-gray-700 flex items-center gap-3 bg-white dark:bg-gray-800 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center border-2 border-white dark:border-gray-600 shadow-sm flex-shrink-0">
                                          {employee.photo ? (
                                              <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                                          ) : (
                                              <UserCircle className="w-full h-full text-gray-300 dark:text-gray-500" />
                                          )}
                                      </div>
                                      <div className="min-w-0">
                                          <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{employee.name}</div>
                                          <div className="text-xs text-gray-500 font-medium truncate">{employee.role}</div>
                                      </div>
                                  </div>

                                  <div className="relative h-full min-h-[64px] flex-shrink-0" style={{ width: totalWidth }}>
                                      {/* Background Grid Lines */}
                                      <div className="absolute inset-0 flex pointer-events-none">
                                          {columns.map(col => (
                                              <div key={col.id} className={`flex-shrink-0 border-r border-gray-100 dark:border-gray-700 h-full ${col.date && isToday(col.date) ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`} style={{ width: colWidth }}></div>
                                          ))}
                                      </div>

                                      {/* Events */}
                                      {employeeEvents.map(ev => {
                                          let left = 0;
                                          let width = 0;

                                          if (viewRange === 'Day') {
                                              const startH = ev.start.getHours();
                                              const startM = ev.start.getMinutes();
                                              const endH = ev.end.getHours();
                                              const endM = ev.end.getMinutes();
                                              const startOffsetHours = (startH - START_HOUR) + (startM / 60);
                                              const durationHours = (endH - startH) + ((endM - startM) / 60);
                                              left = Math.max(0, startOffsetHours * colWidth);
                                              width = Math.max(colWidth/4, durationHours * colWidth);
                                          } else {
                                              // Week or Month
                                              const columnsDates = columns.map(c => new Date(c.id));
                                              const startIdx = columnsDates.findIndex(d => isSameDay(d, ev.start));
                                              if (startIdx === -1) return null;
                                              
                                              // Multi-day block rendering logic
                                              const diffMs = ev.end.getTime() - ev.start.getTime();
                                              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) || 1;
                                              
                                              left = startIdx * colWidth;
                                              width = diffDays * colWidth;
                                          }

                                          let bgClass = "bg-blue-100 text-blue-800 border-l-4 border-blue-500 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-500";
                                          if (ev.type === 'job') {
                                              if (ev.status === 'In Progress') bgClass = "bg-purple-100 text-purple-900 border-l-4 border-purple-500 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-500";
                                              else if (ev.status === 'Completed') bgClass = "bg-green-100 text-green-900 border-l-4 border-green-500 dark:bg-green-900/50 dark:text-green-200 dark:border-green-500";
                                              else bgClass = "bg-blue-100 text-blue-900 border-l-4 border-blue-500 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-500";
                                          } else {
                                              if (ev.status === 'Completed') bgClass = "bg-gray-100 text-gray-700 border-l-4 border-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500";
                                              else bgClass = "bg-pink-50 text-pink-900 border-l-4 border-pink-400 dark:bg-pink-900/50 dark:text-pink-200 dark:border-pink-500";
                                          }

                                          return (
                                              <div 
                                                  key={ev.id}
                                                  onClick={() => {
                                                      if(ev.type === 'appointment') setSelectedAppointment(ev.data);
                                                      if(ev.type === 'job' && onViewJob) onViewJob(ev.data.id);
                                                  }}
                                                  className={`absolute top-0.5 bottom-0.5 rounded-md px-3 py-1 text-xs shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-center overflow-hidden ${bgClass}`}
                                                  style={{ left, width: width - 8 }}
                                              >
                                                  <div className="font-bold truncate text-sm mb-0.5">{ev.title}</div>
                                                  <div className="flex items-center gap-2 opacity-80 font-medium">
                                                      <span>{ev.start.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span>
                                                      {viewRange === 'Day' && <span>- {ev.end.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span>}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
  };

  const renderMonthView = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startDayOffset = new Date(year, month, 1).getDay();

      const grid = [];
      for (let i = 0; i < startDayOffset; i++) grid.push(null);
      for (let i = 1; i <= daysInMonth; i++) {
          const dayDate = new Date(year, month, i);
          const dayEvents = filteredEvents.filter(ev => eventOccupiesDay(ev, dayDate));
          dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
          grid.push({ day: i, date: dayDate, events: dayEvents });
      }

      const MAX_VISIBLE_EVENTS = 3;

      return (
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-col">
             <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0 min-w-full">
                {[t('views.SalesCalendarView.daySun'), t('views.SalesCalendarView.dayMon'), t('views.SalesCalendarView.dayTue'), t('views.SalesCalendarView.dayWed'), t('views.SalesCalendarView.dayThu'), t('views.SalesCalendarView.dayFri'), t('views.SalesCalendarView.daySat')].map(day => (
                    <div key={`head-${day}`} className="py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
             </div>
             
             <div className="grid grid-cols-7 bg-gray-200 dark:bg-gray-700 gap-px flex-1 min-w-full">
                {grid.map((cell, idx) => (
                    <div 
                        key={idx} 
                        className={`bg-white dark:bg-gray-900 relative p-1 md:p-2 min-h-[100px] flex flex-col ${!cell ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''}`}
                        onDragOver={(e) => cell ? handleDragOverSlot(e, cell.date, 8, 0) : undefined}
                        onDrop={(e) => {
                            e.preventDefault();
                            if(cell) handleDropOnSlot(cell.date, 8, 0);
                        }}
                    >
                        {cell && rainDayMap.get(toLocalDateKey(cell.date)) && (
                            <>
                                <div
                                    className="pointer-events-none absolute inset-0 z-0 opacity-70"
                                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(59,130,246,0.14) 6px, rgba(59,130,246,0.14) 12px)' }}
                                />
                                <span className="absolute top-1 right-1 z-10 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full">
                                    <CloudRain className="w-2.5 h-2.5" /> {t('views.SalesCalendarView.rainLabel')}
                                </span>
                            </>
                        )}
                        {cell && (
                            <>
                                <span className={`relative z-10 text-xs md:text-sm font-bold mb-1 md:mb-2 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full ${
                                    isToday(cell.date)
                                    ? 'bg-primary-600 text-white shadow-md'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                    {cell.day}
                                </span>
                                <div className="relative z-10 flex-1 overflow-hidden space-y-1">
                                    {(() => {
                                        const visible = cell.events.slice(0, MAX_VISIBLE_EVENTS);
                                        const hiddenCount = cell.events.length - visible.length;

                                        return (
                                            <>
                                                {visible.map(ev => {
                                                    const md = multiDayInfo(ev);
                                                    return (
                                                        <button
                                                            key={ev.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (ev.type === 'appointment') setSelectedAppointment(ev.data);
                                                                if (ev.type === 'job' && onViewJob) onViewJob(ev.data.id);
                                                            }}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, { type: ev.type, data: ev.data })}
                                                            onDrag={handleDrag}
                                                            onDragEnd={handleDragEnd}
                                                            title={md ? `${ev.title} · ${md.days} days, ends ${md.endLabel}` : ev.title}
                                                            className={`w-full text-left text-[10px] md:text-xs px-1.5 py-1 rounded md:rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all shadow-sm mb-1 truncate block ${ev.colorClass}`}
                                                        >
                                                            {ev.type === 'job' && ev.data.is_locked && <Lock className="w-2.5 h-2.5 inline-block mr-1 text-amber-500 align-middle" />}
                                                            <span className="font-bold mr-1 inline-block">
                                                                {ev.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                            </span>
                                                            <span className="truncate">{ev.title}</span>
                                                            {md && <span className="ml-1 text-[8px] font-black uppercase tracking-wide bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 align-middle">{md.days}d</span>}
                                                        </button>
                                                    );
                                                })}
                                                {hiddenCount > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentDate(cell.date);
                                                            setViewRange('Day');
                                                        }}
                                                        className="w-full text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                                                    >
                                                        {t('views.SalesCalendarView.moreEvents', { count: hiddenCount })}
                                                    </button>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
      );
  };

  const renderWeekView = () => {
      const days = getWeekDays(currentDate);
      const hours = Array.from({ length: HOURS_COUNT }, (_, i) => i + START_HOUR);
      const isDragging = !!draggedItem;

      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-gray-900">
             <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0 overflow-hidden pr-4 ml-16">
                <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700 min-w-[700px]">
                    {days.map((day) => (
                        <div key={day.toISOString()} className={`py-3 text-center ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                            <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday(day) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <div className={`text-lg font-bold ${isToday(day) ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                                {day.getDate()}
                            </div>
                        </div>
                    ))}
                </div>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                 <div className="flex relative min-h-[900px] min-w-[700px]" style={{ height: HOURS_COUNT * HOUR_HEIGHT }}>
                    <div className="w-16 border-r border-gray-100 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900 sticky left-0 z-30">
                        {hours.map(hour => (
                            <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                                <span className="absolute -top-3 right-2 text-xs font-medium text-gray-400 bg-white dark:bg-gray-900 px-1">
                                    {hour === 0 ? '12 AM' : (hour > 12 ? `${hour - 12} PM` : (hour === 12 ? '12 PM' : `${hour} AM`))}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700 relative">
                        <div className="absolute inset-0 z-0 pointer-events-none">
                            {hours.map(hour => (
                                <div key={hour} className="border-b border-gray-50 dark:border-gray-800 w-full" style={{ height: HOUR_HEIGHT }}></div>
                            ))}
                        </div>

                        {days.map((day) => {
                            const dayEvents = filteredEvents.filter(ev => eventOccupiesDay(ev, day));

                            const isPreview = dragPreview && 
                                dragPreview.date.getDate() === day.getDate() && 
                                dragPreview.date.getMonth() === day.getMonth();

                            return (
                                <div key={day.toISOString()} className="relative h-full group/column border-l border-gray-50 dark:border-gray-800 first:border-l-0">
                                    {hours.map(hour => (
                                        <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                                            {[0, 15, 30, 45].map(min => (
                                                <div 
                                                    key={min}
                                                    className={`w-full absolute transition-colors hover:bg-blue-50/20 dark:hover:bg-blue-900/10 ${isDragging ? 'z-40' : 'z-10'}`}
                                                    style={{ top: `${(min/60)*100}%`, height: '25%' }}
                                                    onDragOver={(e) => handleDragOverSlot(e, day, hour, min)}
                                                    onDrop={(e) => { e.preventDefault(); handleDropOnSlot(day, hour, min); }}
                                                />
                                            ))}
                                        </div>
                                    ))}

                                    {isPreview && draggedItem && (
                                        (() => {
                                            const startHour = dragPreview.hour;
                                            const startMin = dragPreview.minute;
                                            const offsetHours = startHour - START_HOUR + (startMin / 60);
                                            const top = offsetHours * HOUR_HEIGHT;
                                            const duration = draggedItem.type === 'appointment' ? (draggedItem.data as Appointment).durationMinutes : 60;
                                            const height = (duration / 60) * HOUR_HEIGHT;
                                            
                                            return (
                                                <div
                                                    className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/30 z-20 opacity-50 pointer-events-none"
                                                    style={{ top, height: Math.max(height, 24) }}
                                                />
                                            );
                                        })()
                                    )}

                                    {(() => {
                                        const weekLayout = computeOverlapLayout(dayEvents.map(ev => ({ id: ev.id, start: ev.start, end: blockEnd(ev) })));
                                        return (
                                          <>
                                            {dayEvents.map(ev => {
                                            const startHour = ev.start.getHours();
                                            const startMin = ev.start.getMinutes();
                                            const offsetHours = startHour - START_HOUR + (startMin / 60);
                                            const top = offsetHours * HOUR_HEIGHT;
                                            const durationMinutes = (blockEnd(ev).getTime() - ev.start.getTime()) / 60000;
                                            const height = (durationMinutes / 60) * HOUR_HEIGHT;
                                            const isDraggingThis = draggedItem && draggedItem.data.id === ev.id;
                                            if (startHour < START_HOUR || startHour >= END_HOUR) return null;
                                            const { col, cols } = weekLayout.get(ev.id) || { col: 0, cols: 1 };
                                            const left = `calc(${(col / cols) * 100}% + 2px)`;
                                            const width = `calc(${100 / cols}% - 4px)`;
                                            return (
                                                <div
                                                    key={ev.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, { type: ev.type, data: ev.data })}
                                                    onDrag={handleDrag}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if(ev.type === 'appointment') setSelectedAppointment(ev.data);
                                                        if(ev.type === 'job' && onViewJob) onViewJob(ev.data.id);
                                                    }}
                                                    className={`absolute rounded-lg border-l-4 shadow-sm p-2 text-xs hover:shadow-md hover:z-30 transition-shadow overflow-hidden flex flex-col justify-start cursor-pointer active:cursor-grabbing ${ev.colorClass} ${isDraggingThis ? 'opacity-0' : ''}`}
                                                    style={{ top, height: Math.max(height, 40), left, width }}
                                                >
                                                    <div className="flex justify-between items-start w-full">
                                                        <span className="font-bold truncate pr-1 flex items-center gap-1">
                                                            {ev.type === 'job' && ev.data.is_locked && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                                            {ev.title}
                                                        </span>
                                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap bg-white/50 opacity-80">
                                                            {ev.start.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                                        </span>
                                                    </div>
                                                    {(() => { const md = multiDayInfo(ev); return md ? (
                                                        <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold bg-white/40 dark:bg-black/20 rounded px-1.5 py-0.5 w-fit"><CalendarRange className="w-2.5 h-2.5" /> {md.days} days · ends {md.endLabel}</span>
                                                    ) : null; })()}
                                                </div>
                                            );
                                            })}
                                          </>
                                        );
                                    })()}

                                    {isToday(day) && (
                                        (() => {
                                            const now = new Date();
                                            const h = now.getHours();
                                            const m = now.getMinutes();
                                            if (h >= START_HOUR && h < END_HOUR) {
                                                const offset = (h - START_HOUR + m/60) * HOUR_HEIGHT;
                                                return (
                                                    <div className="absolute left-0 right-0 h-0.5 bg-red-500 z-30 pointer-events-none" style={{ top: offset }}>
                                                        <div className="w-2 h-2 rounded-full bg-red-500 -mt-[3px] -ml-1"></div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()
                                    )}
                                </div>
                            );
                        })}
                    </div>
                 </div>
             </div>
        </div>
      );
  };

  const renderDayView = () => {
      const dayEvents = filteredEvents.filter(ev => eventOccupiesDay(ev, currentDate));

      const hours = Array.from({ length: HOURS_COUNT }, (_, i) => i + START_HOUR);
      const isDragging = !!draggedItem;
      
      const isPreview = dragPreview && 
          dragPreview.date.getDate() === currentDate.getDate() && 
          dragPreview.date.getMonth() === currentDate.getMonth();

      const pxPerMin = HOUR_HEIGHT / 60; 

      return (
          <div className="flex-1 overflow-y-auto relative bg-white dark:bg-gray-900 custom-scrollbar min-w-[300px]">
                {hours.map(hour => (
                    <div key={hour} className="border-b border-gray-50 dark:border-gray-800 w-full relative group" style={{ height: HOUR_HEIGHT }}>
                        <span className="absolute -top-2.5 left-2 text-xs font-medium text-gray-400 bg-white dark:bg-gray-900 px-1 z-10">
                            {hour === 0 ? '12 AM' : (hour > 12 ? `${hour - 12} PM` : (hour === 12 ? '12 PM' : `${hour} AM`))}
                        </span>
                        <div className="w-full h-full border-l border-gray-100 dark:border-gray-700 ml-16 relative">
                            <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-gray-50 dark:border-gray-800"></div>
                            
                            <div className={`absolute inset-0 flex flex-col ${isDragging ? 'z-40' : 'z-10'}`}>
                                {[0, 15, 30, 45].map(min => (
                                    <div 
                                      key={min}
                                      className="flex-1 transition-colors hover:bg-blue-50/20 dark:hover:bg-blue-900/10"
                                      onDragOver={(e) => handleDragOverSlot(e, currentDate, hour, min)}
                                      onDrop={(e) => { e.preventDefault(); handleDropOnSlot(currentDate, hour, min); }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                
                {isPreview && draggedItem && (
                    (() => {
                        const startHour = dragPreview.hour;
                        const startMin = dragPreview.minute;
                        
                        const startOffsetMin = ((startHour - START_HOUR) * 60) + startMin;
                        const top = startOffsetMin * pxPerMin;
                        const duration = draggedItem.type === 'appointment' ? (draggedItem.data as Appointment).durationMinutes : 60;
                        const height = duration * pxPerMin;
                        
                        return (
                            <div
                                style={{ top: `${top}px`, height: `${height}px`, left: '70px', right: '10px' }}
                                className="absolute rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/30 z-20 opacity-50 pointer-events-none"
                            />
                        );
                    })()
                )}

                {(() => {
                   const dayLayout = computeOverlapLayout(dayEvents.map(ev => ({ id: ev.id, start: ev.start, end: blockEnd(ev) })));
                   return (
                     <>
                       {dayEvents.map(ev => {
                       const startHour = ev.start.getHours();
                       const startMin = ev.start.getMinutes();
                       const startOffsetMin = ((startHour - START_HOUR) * 60) + startMin;
                       const top = startOffsetMin * pxPerMin;
                       const durationMinutes = (blockEnd(ev).getTime() - ev.start.getTime()) / 60000;
                       const height = durationMinutes * pxPerMin;
                       const isDraggingThis = draggedItem && draggedItem.data.id === ev.id;
                       if (startHour < START_HOUR || startHour >= END_HOUR) return null;
                       const { col, cols } = dayLayout.get(ev.id) || { col: 0, cols: 1 };
                       const left = `calc(70px + (100% - 80px) * ${col / cols})`;
                       const width = `calc((100% - 80px) / ${cols} - 4px)`;
                       return (
                           <button
                               key={ev.id}
                               draggable
                               onDragStart={(e) => handleDragStart(e, { type: ev.type, data: ev.data })}
                               onDrag={handleDrag}
                               onDragEnd={handleDragEnd}
                               onClick={() => {
                                   if(ev.type === 'appointment') setSelectedAppointment(ev.data);
                                   if(ev.type === 'job' && onViewJob) onViewJob(ev.data.id);
                               }}
                               style={{ top: `${top}px`, height: `${height}px`, left, width }}
                               className={`absolute rounded-xl border-l-4 shadow-sm p-3 text-left transition-shadow hover:shadow-md hover:z-30 z-20 flex flex-col justify-start cursor-pointer active:cursor-grabbing ${ev.colorClass} ${isDraggingThis ? 'opacity-0' : ''}`}
                           >
                               <div className="font-bold text-sm leading-tight flex items-center justify-between">
                                   <span className="flex items-center gap-1">
                                       {ev.type === 'job' && ev.data.is_locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                                       {ev.title}
                                   </span>
                                   <span className={`text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-white/50 opacity-80`}>
                                       {ev.start.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}
                                   </span>
                               </div>
                               {(() => { const md = multiDayInfo(ev); return md ? (
                                   <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold bg-white/40 dark:bg-black/20 rounded px-1.5 py-0.5 w-fit"><CalendarRange className="w-3 h-3" /> {md.days} days · ends {md.endLabel}</span>
                               ) : null; })()}
                           </button>
                       );
                       })}
                     </>
                   );
               })()}
          </div>
      );
  };
  
  const renderJobCard = (job: Job, isScheduled: boolean) => {
      const wo = workOrders.find(w => w.id === job.workOrderId);
      const hours = wo ? wo.totalProductionHours : 0;
      
      return (
        <div 
            key={job.id} 
            onClick={() => onViewJob?.(job.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, { type: 'job', data: job })}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            className={`p-4 rounded-xl border ${isScheduled ? 'border-blue-100 bg-blue-50/20 dark:border-blue-900 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} hover:border-primary-300 dark:hover:border-primary-500 transition-all group relative overflow-hidden cursor-pointer ${draggedItem && draggedItem.data.id === job.id ? 'opacity-50' : ''}`}
        >
            <div className="pl-1">
                <div className="flex justify-between items-start mb-1">
                    <div className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
                        {job.is_locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                        {job.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                            {hours} hrs
                        </span>
                    </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3" /> {job.address.split(',')[0]}
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-gray-700 inline-block px-1.5 rounded border border-gray-100 dark:border-gray-600">
                        {job.jobNumber}
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            handleOpenScheduleModal(job);
                        }}
                        className={`text-xs font-bold ${isScheduled ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'} px-2 py-1.5 rounded-lg flex items-center gap-1 transition-colors`}
                    >
                        {isScheduled ? t('views.SalesCalendarView.rescheduleBtn') : t('views.SalesCalendarView.scheduleBtn')} <Calendar className="w-3 h-3" />
                    </button>
                </div>
                {isScheduled && (() => {
                    const d = new Date(job.startDate!);
                    if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(WORK_START_HOUR, 0, 0, 0);
                    return (
                        <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-900/50 flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            <Calendar className="w-3 h-3" />
                            {d.toLocaleDateString()}
                            <Clock className="w-3 h-3 ml-1" />
                            {d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                    );
                })()}
            </div>
        </div>
      );
  };

  return (
    <div id="calendar-view" className={`w-full mx-auto min-h-screen ${Spacing.containerPx} py-8 flex flex-col`}>
      {/* Detail Modal */}
      {selectedAppointment && (
          <Modal isOpen={!!selectedAppointment} onClose={() => setSelectedAppointment(null)} title={t('views.SalesCalendarView.appointmentDetails')} maxWidth="max-w-xl">
              <div className="space-y-6">
                  <div className="flex justify-between items-start">
                      <div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedAppointment.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(selectedAppointment.date).toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})} at {new Date(selectedAppointment.date).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                          </div>
                      </div>
                      <Badge color={selectedAppointment.status === 'Completed' ? 'green' : 'blue'}>
                          {selectedAppointment.status}
                      </Badge>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                      <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('views.SalesCalendarView.locationLabel')}</div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white">{selectedAppointment.address}</div>
                          </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                          <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('views.SalesCalendarView.assignedEstimator')}</div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white">
                                  {allStaff.find(e => e.id === selectedAppointment.estimatorId)?.name || t('views.SalesCalendarView.unknownEstimator')}
                              </div>
                          </div>
                      </div>

                      {selectedAppointment.notes && (
                          <div className="flex items-start gap-3">
                              <div className="w-5 shrink-0" />
                              <div>
                                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('views.SalesCalendarView.notesLabel')}</div>
                                  <div className="text-sm text-gray-600 dark:text-gray-300 italic">"{selectedAppointment.notes}"</div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                      {selectedAppointment.status === 'Scheduled' ? (
                        <>
                            <div className="flex gap-2 mr-auto">
                                <Button 
                                    variant="secondary" 
                                    className="px-3" 
                                    title={t('views.SalesCalendarView.editAppointmentTitle')}
                                    onClick={handleEditClick}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="danger" 
                                    className="px-3" 
                                    title={t('views.SalesCalendarView.deleteAppointmentTitle')}
                                    onClick={handleDeleteClick}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <Button onClick={handleMarkComplete} className="flex-1 shadow-lg shadow-primary-500/20 bg-primary-600 hover:bg-primary-700 text-white">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {t('views.SalesCalendarView.completeAndConvert')}
                            </Button>
                        </>
                      ) : (
                        <Button variant="secondary" onClick={() => setSelectedAppointment(null)} className="w-full">
                            {t('views.SalesCalendarView.closeBtn')}
                        </Button>
                      )}
                  </div>
              </div>
          </Modal>
      )}

      {jobToSchedule && (
          <ScheduleJobModal
            isOpen={isJobScheduleModalOpen}
            onClose={() => setIsJobScheduleModalOpen(false)}
            job={jobToSchedule}
            onSave={handleJobScheduleSave}
          />
      )}

      {renderFloatingCard()}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div className="w-full md:w-auto">
          <h1 className={`${Typography.h1} mb-4`}>{t('views.SalesCalendarView.calendarTitle')}</h1>
          
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 mt-4 w-full md:w-fit">
              <button 
                onClick={() => setActiveTab('Sales')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 justify-center flex-1 md:flex-none ${activeTab === 'Sales' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                 <Briefcase className="w-4 h-4" /> {t('views.SalesCalendarView.estimatesTab')}
              </button>
              <button 
                onClick={() => setActiveTab('Production')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 justify-center flex-1 md:flex-none ${activeTab === 'Production' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                 <Ruler className="w-4 h-4" /> {t('views.SalesCalendarView.productionTab')}
              </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {activeTab === 'Sales' && (
                <>
                    <div className="relative flex-1 md:flex-none" ref={filterRef}>
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm min-w-[200px] justify-between w-full md:w-auto h-12"
                        >
                            <span className="flex items-center gap-2 truncate">
                                <Filter className="w-5 h-5 text-gray-400 shrink-0" /> <span className="truncate">{t('views.SalesCalendarView.filterLabel', { label: getFilterLabel() })}</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isFilterOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 p-2">
                                <div className="flex justify-between items-center px-2 py-1 mb-1 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-400 uppercase">{t('views.SalesCalendarView.selectStaff')}</span>
                                    <button
                                        onClick={() => setSelectedStaffIds(allStaff.map(s => s.id))}
                                        className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:text-primary-700 dark:hover:text-primary-300"
                                    >
                                        {t('views.SalesCalendarView.selectAll')}
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    {allStaff.map(e => {
                                        const isSelected = selectedStaffIds.includes(e.id);
                                        return (
                                            <button 
                                                key={e.id}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedStaffIds(prev => prev.filter(id => id !== e.id));
                                                    } else {
                                                        setSelectedStaffIds(prev => [...prev, e.id]);
                                                    }
                                                }}
                                                className={`w-full text-left px-2 py-2 text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                {e.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <Button onClick={onScheduleNew} className="shadow-lg shadow-primary-500/20 h-12 flex-1 md:flex-none justify-center whitespace-nowrap">
                       <Plus className="w-4 h-4 mr-2" /> {t('views.SalesCalendarView.scheduleEstimate')}
                    </Button>
                </>
            )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] relative">
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden order-1 lg:order-1 relative z-10 min-h-0">
              {/* Calendar Header */}
              <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-4 w-full md:w-auto justify-start">
                      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                          <button onClick={() => navigate(-1)} className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all shadow-sm text-gray-600 dark:text-gray-300"><ChevronLeft className="w-5 h-5" /></button>
                          <button onClick={() => navigate(1)} className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all shadow-sm text-gray-600 dark:text-gray-300"><ChevronRight className="w-5 h-5" /></button>
                      </div>
                      
                      <div className="relative group cursor-pointer" ref={datePickerRef}>
                          <button 
                             onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                             className="flex items-center gap-2 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 px-2 py-1 rounded-lg transition-colors"
                          >
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white font-heading group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {getHeaderDateLabel()}
                            </h2>
                            <ChevronDown className={`w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isDatePickerOpen && (
                             <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                 <MiniCalendar />
                             </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
                      {/* Integrated View & Scale Switcher */}
                      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                          <button 
                            onClick={() => setIsDispatchMode(false)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${!isDispatchMode ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                             <Calendar className="w-3.5 h-3.5" /> {t('views.SalesCalendarView.calendarViewBtn')}
                          </button>
                          <button
                            onClick={() => setIsDispatchMode(true)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${isDispatchMode ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                             <Users className="w-3.5 h-3.5" /> {t('views.SalesCalendarView.dispatchViewBtn')}
                          </button>
                      </div>

                      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
                          <button 
                            onClick={() => setViewRange('Month')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${viewRange === 'Month' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                             <LayoutGrid className="w-3.5 h-3.5" /> {t('views.SalesCalendarView.monthBtn')}
                          </button>
                          <button
                            onClick={() => setViewRange('Week')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${viewRange === 'Week' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                             <Columns className="w-3.5 h-3.5" /> {t('views.SalesCalendarView.weekBtn')}
                          </button>
                          <button
                            onClick={() => setViewRange('Day')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${viewRange === 'Day' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-700 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                          >
                             <List className="w-3.5 h-3.5" /> {t('views.SalesCalendarView.dayBtn')}
                          </button>
                      </div>
                      
                      {!isSidebarOpen && (
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="flex h-9 w-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-600 shadow-sm transition-all items-center justify-center flex-shrink-0"
                            title={t('views.SalesCalendarView.showSidebar')}
                        >
                            <PanelRight className="w-5 h-5" />
                        </button>
                      )}
                  </div>
              </div>

              {isDispatchMode ? renderDispatchView() : (
                  viewRange === 'Month' ? renderMonthView() : 
                  viewRange === 'Week' ? renderWeekView() : renderDayView()
              )}
          </div>

          <div className={`
            bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden order-2 lg:order-2 transition-all duration-300 ease-in-out flex-shrink-0
            ${isSidebarOpen ? 'w-full h-96 lg:w-80 lg:h-full opacity-100 scale-100 border-opacity-100 mt-4 lg:mt-0' : 'w-0 h-0 opacity-0 scale-95 p-0 border-0 m-0'}
          `}>
              
              {activeTab === 'Sales' && (
                  <>
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white font-heading text-lg">{t('views.SalesCalendarView.upcomingAppointments')}</h3>
                        <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title={t('views.SalesCalendarView.collapseSidebar')}>
                            <PanelRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                        {upcomingAppointments.map(app => (
                            <div 
                                key={app.id} 
                                onClick={() => setSelectedAppointment(app)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, { type: 'appointment', data: app })}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                className={`p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group ${draggedItem && draggedItem.data.id === app.id ? 'opacity-50' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{app.title}</div>
                                    <Badge color={app.status === 'Completed' ? 'green' : 'blue'} className="scale-75 origin-top-right">{app.status}</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(app.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} • {new Date(app.date).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                                    <User className="w-3.5 h-3.5" />
                                    {allStaff.find(e => e.id === app.estimatorId)?.name || t('views.SalesCalendarView.unknownEstimator')}
                                </div>
                            </div>
                        ))}
                        {upcomingAppointments.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm italic">{t('views.SalesCalendarView.noUpcomingAppointments')}</div>
                        )}
                    </div>
                  </>
              )}

              {activeTab === 'Production' && (
                  <>
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white font-heading text-lg flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-gray-700 dark:text-gray-300" /> {t('views.SalesCalendarView.jobsToDo')}
                        </h3>
                        <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" title={t('views.SalesCalendarView.collapseSidebar')}>
                            <PanelRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30 dark:bg-gray-800/30 min-h-0">
                        {productionJobs.unscheduled.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">{t('views.SalesCalendarView.unscheduled')}</h4>
                                <div className="space-y-3">
                                    {productionJobs.unscheduled.map(job => renderJobCard(job, false))}
                                </div>
                            </div>
                        )}

                        {productionJobs.scheduled.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-blue-400 dark:text-blue-500 uppercase tracking-widest mb-3 ml-1">{t('views.SalesCalendarView.scheduledInProgress')}</h4>
                                <div className="space-y-3">
                                    {productionJobs.scheduled.map(job => renderJobCard(job, true))}
                                </div>
                            </div>
                        )}
                        
                        {productionJobs.unscheduled.length === 0 && productionJobs.scheduled.length === 0 && (
                            <div className="text-center py-10 text-gray-400 italic">{t('views.SalesCalendarView.noActiveJobs')}</div>
                        )}
                    </div>
                  </>
              )}
          </div>
      </div>
    </div>
  );
};
