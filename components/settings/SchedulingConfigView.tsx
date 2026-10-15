import React, { useState } from 'react';
import { CalendarClock, CloudRain, Plus, Trash2, CalendarDays, Coffee } from 'lucide-react';
import { Card, Button, Toggle, TextInput, NumberInput } from '../UI';
import { Typography } from '../../theme/designSystem';
import { DatePicker } from '../ui/DatePicker';
import { BreakTimeField } from '../views/JobScheduling/BreakTimeField';
import { GlobalSettings, SchedulingSettings, CalendarDayMark, CrewBreak } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface SchedulingConfigViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const DEFAULTS: SchedulingSettings = {
  nonWorkingWeekdays: [0, 6],
  holidays: [],
  rainDays: [],
  workDayStartHour: 8,
  workDayEndHour: 17,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDate = (key: string) => new Date(`${key}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

export const SchedulingConfigView = ({ settings, setSettings }: SchedulingConfigViewProps) => {
  const { t } = useTranslation();
  const sched = settings.scheduling ?? DEFAULTS;
  const update = (patch: Partial<SchedulingSettings>) =>
    setSettings({ ...settings, scheduling: { ...sched, ...patch } });

  const [newHolidayDate, setNewHolidayDate] = useState(todayKey());
  const [newHolidayLabel, setNewHolidayLabel] = useState('');

  const toggleWorkday = (dayIdx: number) => {
    const isNonWorking = sched.nonWorkingWeekdays.includes(dayIdx);
    update({
      nonWorkingWeekdays: isNonWorking
        ? sched.nonWorkingWeekdays.filter((d) => d !== dayIdx)
        : [...sched.nonWorkingWeekdays, dayIdx],
    });
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    if (sched.holidays.some((h) => h.date === newHolidayDate)) return;
    const mark: CalendarDayMark = { date: newHolidayDate, type: 'holiday', label: newHolidayLabel.trim() || 'Holiday' };
    update({ holidays: [...sched.holidays, mark].sort((a, b) => a.date.localeCompare(b.date)) });
    setNewHolidayLabel('');
  };

  const removeHoliday = (date: string) => update({ holidays: sched.holidays.filter((h) => h.date !== date) });
  const removeRainDay = (date: string) => update({ rainDays: sched.rainDays.filter((r) => r.date !== date) });

  const breaks = sched.defaultBreaks ?? [];
  const updateBreak = (id: string, patch: Partial<CrewBreak>) =>
    update({ defaultBreaks: breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const addBreak = () =>
    update({ defaultBreaks: [...breaks, { id: `brk-${breaks.length + 1}-${breaks.reduce((s, b) => s + b.durationMinutes, 0)}`, label: 'Break', durationMinutes: 30, paid: false }] });
  const removeBreak = (id: string) => update({ defaultBreaks: breaks.filter((b) => b.id !== id) });

  return (
    <div className="p-4 md:p-12 max-w-5xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-8 md:mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.SchedulingConfigView.pageTitle')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.SchedulingConfigView.pageSubtitle')}</p>
      </div>

      <div className="space-y-8">
        {/* Working days */}
        <Card className="p-6 md:p-8 shadow-lg border-0 bg-white dark:bg-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-white text-xl font-heading mb-1 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-600 dark:text-primary-400" /> {t('settings.SchedulingConfigView.workWeekTitle')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('settings.SchedulingConfigView.workWeekDesc')}</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {WEEKDAYS.map((label, idx) => {
              const isWorking = !sched.nonWorkingWeekdays.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleWorkday(idx)}
                  className={`py-3 rounded-xl text-sm font-bold border transition-colors ${
                    isWorking
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Crew breaks (company default) */}
        <Card className="p-6 md:p-8 shadow-lg border-0 bg-white dark:bg-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-white text-xl font-heading mb-1 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-primary-600 dark:text-primary-400" /> {t('settings.SchedulingConfigView.crewBreaksTitle')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('settings.SchedulingConfigView.crewBreaksDesc')}
          </p>

          <div className="space-y-3">
            {breaks.length === 0 && <div className="text-center py-6 text-gray-400 dark:text-gray-500 italic">{t('settings.SchedulingConfigView.noBreaksEmpty')}</div>}
            {breaks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex-1 min-w-[140px]">
                  <TextInput label={t('settings.SchedulingConfigView.breakName')} placeholder={t('settings.SchedulingConfigView.breakNamePlaceholder')} value={b.label ?? ''} onChange={(v) => updateBreak(b.id, { label: v })} />
                </div>
                <div className="w-32">
                  <NumberInput label={t('settings.SchedulingConfigView.breakMinutes')} step={5} value={b.durationMinutes} onChange={(v) => updateBreak(b.id, { durationMinutes: Math.max(0, v) })} />
                </div>
                <div className="w-48">
                  <BreakTimeField value={b.startTime} onChange={(v) => updateBreak(b.id, { startTime: v })} />
                </div>
                <div className="flex flex-col gap-2">
                  <span className={Typography.label}>{t('settings.SchedulingConfigView.breakPaid')}</span>
                  <div className="h-[52px] flex items-center"><Toggle checked={b.paid} onChange={(v) => updateBreak(b.id, { paid: v })} /></div>
                </div>
                <button onClick={() => removeBreak(b.id)} aria-label={t('settings.SchedulingConfigView.removeBreakAriaLabel', { label: b.label || t('settings.SchedulingConfigView.breakFallback') })} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mb-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">{t('settings.SchedulingConfigView.flexibleBreakHint')}</p>
          <Button onClick={addBreak} variant="secondary" className="mt-4"><Plus className="w-4 h-4 mr-2" /> {t('settings.SchedulingConfigView.addBreakBtn')}</Button>
        </Card>

        {/* Holidays */}
        <Card className="p-6 md:p-8 shadow-lg border-0 bg-white dark:bg-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-white text-xl font-heading mb-1 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-500" /> {t('settings.SchedulingConfigView.holidaysTitle')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('settings.SchedulingConfigView.holidaysDesc')}</p>

          <div className="flex flex-col sm:flex-row gap-3 items-end mb-6">
            <div className="flex-1 w-full">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2">{t('settings.SchedulingConfigView.holidayDateLabel')}</span>
              <DatePicker value={newHolidayDate} onChange={setNewHolidayDate} />
            </div>
            <div className="flex-1 w-full">
              <TextInput label={t('settings.SchedulingConfigView.holidayLabelField')} placeholder={t('settings.SchedulingConfigView.holidayLabelPlaceholder')} value={newHolidayLabel} onChange={setNewHolidayLabel} />
            </div>
            <Button onClick={addHoliday} className="w-full sm:w-auto justify-center"><Plus className="w-4 h-4 mr-2" /> {t('settings.SchedulingConfigView.addHolidayBtn')}</Button>
          </div>

          <div className="space-y-2">
            {sched.holidays.length === 0 && <div className="text-center py-6 text-gray-400 dark:text-gray-500 italic">{t('settings.SchedulingConfigView.noHolidaysEmpty')}</div>}
            {sched.holidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{h.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(h.date)}</div>
                </div>
                <button onClick={() => removeHoliday(h.date)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Rain days (reporting) */}
        <Card className="p-6 md:p-8 shadow-lg border-0 bg-white dark:bg-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-white text-xl font-heading mb-1 flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-blue-500" /> {t('settings.SchedulingConfigView.rainDaysTitle')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('settings.SchedulingConfigView.rainDaysDesc')}</p>

          <div className="space-y-2">
            {sched.rainDays.length === 0 && <div className="text-center py-6 text-gray-400 dark:text-gray-500 italic">{t('settings.SchedulingConfigView.noRainDaysEmpty')}</div>}
            {sched.rainDays.map((r) => (
              <div key={r.date} className="flex items-center justify-between p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-900/10">
                <div className="flex items-center gap-3">
                  <CloudRain className="w-4 h-4 text-blue-500" />
                  <div className="font-bold text-gray-900 dark:text-white">{fmtDate(r.date)}</div>
                </div>
                <button onClick={() => removeRainDay(r.date)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
