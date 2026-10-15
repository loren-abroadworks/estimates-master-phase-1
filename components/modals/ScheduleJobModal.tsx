
import React, { useState, useEffect } from 'react';
import { Modal, Button, TimeInput } from '../UI';
import { Job } from '../../types';
import { Calendar, AlertCircle, Clock } from 'lucide-react';
import { DatePicker } from '../ui/DatePicker';
import { useTranslation } from '@/i18n/LanguageContext';

interface ScheduleJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  onSave: (scheduleData: { startDate: string; endDate: string; crewIds: string[] }) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Split a stored ISO datetime into a local date key + time, falling back to a
// default time when none is stored (jobs default to the work day).
const splitISO = (iso: string | undefined, defaultTime: string): { date: string; time: string } => {
  if (!iso) return { date: '', time: defaultTime };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: defaultTime };
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = !(d.getHours() === 0 && d.getMinutes() === 0);
  const time = hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : defaultTime;
  return { date, time };
};

export const ScheduleJobModal = ({ isOpen, onClose, job, onSave }: ScheduleJobModalProps) => {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && job) {
      const s = splitISO(job.startDate, '08:00');
      const e = splitISO(job.endDate, '17:00');
      setStartDate(s.date);
      setStartTime(s.time);
      setEndDate(e.date);
      setEndTime(e.time);
      setError(null);
    }
  }, [isOpen, job]);

  const handleSave = () => {
    if (!startDate || !endDate) {
      setError(t('modals.ScheduleJobModal.errorBothDatesRequired'));
      return;
    }

    const start = new Date(`${startDate}T${startTime || '08:00'}`);
    const end = new Date(`${endDate}T${endTime || '17:00'}`);

    if (start > end) {
      setError(t('modals.ScheduleJobModal.errorEndBeforeStart'));
      return;
    }

    onSave({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      crewIds: job.crewMemberIds || [],
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.ScheduleJobModal.title')}>
      <div className="space-y-6">

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Date + time selection */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> {t('modals.ScheduleJobModal.productionDates')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start */}
            <div className="space-y-3">
              <DatePicker
                label={t('modals.ScheduleJobModal.startDate')}
                value={startDate}
                onChange={(d) => { setStartDate(d); setError(null); }}
              />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('modals.ScheduleJobModal.startTime')}</span>
                <TimeInput value={startTime} onChange={(v) => { setStartTime(v); setError(null); }} />
              </div>
            </div>
            {/* End */}
            <div className="space-y-3">
              <DatePicker
                label={t('modals.ScheduleJobModal.endDate')}
                value={endDate}
                onChange={(d) => { setEndDate(d); setError(null); }}
              />
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('modals.ScheduleJobModal.endTime')}</span>
                <TimeInput value={endTime} onChange={(v) => { setEndTime(v); setError(null); }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.ScheduleJobModal.cancel')}</Button>
          <Button onClick={handleSave} className="flex-1 shadow-lg shadow-primary-500/20">{t('modals.ScheduleJobModal.saveSchedule')}</Button>
        </div>
      </div>
    </Modal>
  );
};
