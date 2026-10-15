
import React from 'react';
import { FileText } from 'lucide-react';
import { TextArea } from '../../../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface NotesProps {
  notes: { customer: string; internal: string; };
  setNotes: React.Dispatch<React.SetStateAction<{ customer: string; internal: string; }>>;
}

export const Notes: React.FC<NotesProps> = ({ notes, setNotes }) => {
  const { t } = useTranslation();
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-b border-gray-100 dark:border-gray-700 pb-10">
        <div>
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center border border-primary-100 dark:border-primary-800">
                    <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.Notes.customerNotes')}</h3>
            </div>
            <TextArea placeholder={t('views.EstimateForm.sections.Notes.customerPlaceholder')} value={notes.customer} onChange={(v) => setNotes({...notes, customer: v})} rows={5} />
        </div>
        <div>
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center border border-amber-100 dark:border-amber-800">
                    <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.Notes.internalNotes')}</h3>
            </div>
            <TextArea placeholder={t('views.EstimateForm.sections.Notes.internalPlaceholder')} value={notes.internal} onChange={(v) => setNotes({...notes, internal: v})} rows={5} />
        </div>
    </section>
  );
};
