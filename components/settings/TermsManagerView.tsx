
import React, { useState, useMemo } from 'react';
import { Plus, ScrollText } from 'lucide-react';
import { Card, Button, KebabMenu, SearchInput } from '../UI';
import { TermsTemplate } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface TermsManagerViewProps {
  templates: TermsTemplate[];
  onAdd: () => void;
  onEdit: (t: TermsTemplate) => void;
  onDelete: (id: string) => void;
}

export const TermsManagerView = ({ templates, onAdd, onEdit, onDelete }: TermsManagerViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      return t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             t.content.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [templates, searchTerm]);

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.TermsManagerView.heading')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.TermsManagerView.subheading')}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> 
          <Plus className="w-5 h-5 mr-2" /> {t('settings.TermsManagerView.addTerms')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.TermsManagerView.searchPlaceholder')} className="md:max-w-md w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="p-6 md:p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg relative group bg-white dark:bg-gray-800">
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <KebabMenu onEdit={() => onEdit(template)} onDelete={() => onDelete(template.id)} />
            </div>

            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{template.name}</h3>
            </div>
            <div className="text-base text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-4 whitespace-pre-line line-clamp-6">
              {template.content}
            </div>
          </Card>
        ))}
        
        {filteredTemplates.length === 0 && (
           <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                 <ScrollText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.TermsManagerView.emptyHeading')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">{t('settings.TermsManagerView.emptyBody')}</p>
           </div>
        )}
      </div>
    </div>
  );
};
