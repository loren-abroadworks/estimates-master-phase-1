
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, Button, KebabMenu } from '../UI';
import { GlobalSettings, ConfiguredScope } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface ScopeManagerViewProps {
  settings: GlobalSettings;
  onAdd: () => void;
  onEdit: (s: ConfiguredScope) => void;
  onDelete: (id: string) => void;
}

export const ScopeManagerView = ({ settings, onAdd, onEdit, onDelete }: ScopeManagerViewProps) => {
  const { t } = useTranslation();
  return (
  <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
     <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.ScopeManagerView.estimateTypes')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.ScopeManagerView.estimateTypesSubheading')}</p>
        </div>
        <Button onClick={onAdd} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center"> <Plus className="w-5 h-5 mr-2" /> {t('settings.ScopeManagerView.addType')} </Button>
     </div>

     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {settings.scopes.map((scope) => {
          return (
          <Card key={scope.id} className="relative p-6 md:p-8 flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group border-0 shadow-lg bg-white dark:bg-gray-800">
             <div className="absolute top-6 right-6">
                <KebabMenu onEdit={() => onEdit(scope)} onDelete={() => onDelete(scope.id)} />
             </div>
             <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-2 pr-12">{scope.name}</h3>
             <p className="text-base text-gray-500 dark:text-gray-400 mb-8 min-h-[60px] line-clamp-3 leading-relaxed">{scope.description || t('settings.ScopeManagerView.noDescription')}</p>
             <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6 mt-auto">
                <div className="flex justify-between items-center text-base">
                    <span className="text-gray-500 dark:text-gray-400">{t('settings.ScopeManagerView.hourlyRate')}</span>
                    <span className="font-bold text-gray-900 dark:text-white">${scope.defaultLaborRate.toFixed(2)}/hr</span>
                </div>
             </div>
          </Card>
        )})}
     </div>
  </div>
  );
};
