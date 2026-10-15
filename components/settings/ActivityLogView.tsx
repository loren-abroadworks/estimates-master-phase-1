import React from 'react';
import { History, User, ShieldCheck, CalendarClock, Inbox } from 'lucide-react';
import { Badge } from '../UI';
import { ActivityLogEntry } from '../../types';
import { CURRENT_USER } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

interface ActivityLogViewProps {
  entries: ActivityLogEntry[];
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

export const ActivityLogView = ({ entries }: ActivityLogViewProps) => {
  const { t } = useTranslation();
  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <History className="w-7 h-7 text-primary-600 dark:text-primary-400" /> {t('settings.ActivityLogView.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {t('settings.ActivityLogView.description')}
        </p>
      </div>

      {/* Current user / role */}
      <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
          <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-gray-900 dark:text-white">{CURRENT_USER.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t('settings.ActivityLogView.actionsRecorded')}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5" /> {CURRENT_USER.role}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <Inbox className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('settings.ActivityLogView.emptyHeading')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t('settings.ActivityLogView.emptyBody')}
          </p>
        </div>
      ) : (
        <ol className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-3 space-y-6">
          {entries.map((e) => (
            <li key={e.id} className="ml-6">
              <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 ring-4 ring-white dark:ring-gray-950" />
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{e.action}</p>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> {fmtTime(e.timestamp)}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">{e.user}</span>
                  <Badge color="gray">{e.role}</Badge>
                  {e.affectedJobIds.length > 0 && (
                    <Badge color="blue">{e.affectedJobIds.length} job{e.affectedJobIds.length === 1 ? '' : 's'}</Badge>
                  )}
                  {e.details && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{e.details}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
