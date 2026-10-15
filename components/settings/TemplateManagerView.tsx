
import React from 'react';
import { Plus, LayoutTemplate } from 'lucide-react';
import { Button, Card, SearchInput, KebabMenu } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface TemplateManagerViewProps {
  templates: any[]; // Using any for simplicity as it mirrors EstimateData structure
  onEdit: (templateId: string) => void;
  onCreate: () => void;
  onDelete: (templateId: string) => void;
}

export const TemplateManagerView = ({ templates, onEdit, onCreate, onDelete }: TemplateManagerViewProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTemplates = templates.filter(t => 
    (t.projectName || t.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.TemplateManagerView.estimateTemplates')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.TemplateManagerView.subtitle')}</p>
        </div>
        <Button onClick={onCreate} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center">
          <Plus className="w-5 h-5 mr-2" /> {t('settings.TemplateManagerView.newTemplate')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('settings.TemplateManagerView.searchPlaceholder')} className="md:max-w-md w-full" />
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredTemplates.map(template => (
                <Card key={template.id} className="group relative p-6 md:p-8 flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-0 shadow-lg cursor-pointer bg-white dark:bg-gray-800" onClick={() => onEdit(template.id)}>
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <KebabMenu 
                            onEdit={() => onEdit(template.id)}
                            onDelete={() => onDelete(template.id)}
                        />
                    </div>
                    
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2 font-heading pr-8 pt-4">{template.projectName || template.name || t('settings.TemplateManagerView.untitledTemplate')}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-3 h-12 mb-6">{template.description || t('settings.TemplateManagerView.noDescription')}</p>

                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                        <span>{t('settings.TemplateManagerView.areaCount', { count: template.estimateAreas?.length || 0 })}</span>
                        <span>
                            {t('settings.TemplateManagerView.itemCount', { count: (template.estimateAreas || []).reduce((acc: number, area: any) => acc + (area.rows || []).length, 0) + Object.keys(template.lineItems || {}).length })}
                        </span>
                    </div>
                </Card>
            ))}
        </div>
      ) : (
        <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                <LayoutTemplate className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('settings.TemplateManagerView.noTemplatesFound')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{t('settings.TemplateManagerView.emptyStateHint')}</p>
            <Button onClick={onCreate} variant="secondary" className="mt-6 w-full md:w-auto bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">{t('settings.TemplateManagerView.createFirstTemplate')}</Button>
        </div>
      )}
    </div>
  );
};
