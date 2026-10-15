
import React from 'react';
import { Kanban } from 'lucide-react';
import { Card, TextInput } from '../UI';
import { GlobalSettings, PipelineStage } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface PipelineConfigViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

export const PipelineConfigView = ({ settings, setSettings }: PipelineConfigViewProps) => {
  const { t } = useTranslation();

  const updateStageName = (id: string, newLabel: string) => {
      const updatedStages = settings.pipelineStages.map(stage => 
          stage.id === id ? { ...stage, label: newLabel } : stage
      );
      setSettings({
          ...settings,
          pipelineStages: updatedStages
      });
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-8 md:mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.PipelineConfigView.pipelineConfiguration')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.PipelineConfigView.customizeColumnNames')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.pipelineStages.map((stage) => (
              <Card key={stage.id} className="p-6 relative group border-0 shadow-lg hover:shadow-xl transition-all bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stage.color}`}>
                          <Kanban className="w-5 h-5" />
                      </div>
                      <div>
                          <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('settings.PipelineConfigView.stageId')}</div>
                          <div className="font-mono text-sm font-medium text-gray-600 dark:text-gray-300">{stage.id}</div>
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('settings.PipelineConfigView.displayName')}</label>
                      <TextInput 
                          value={stage.label} 
                          onChange={(val) => updateStageName(stage.id, val)}
                          className="font-bold bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      />
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                      <div className={`w-full h-2 rounded-full ${stage.color.split(' ')[0]}`}></div>
                  </div>
              </Card>
          ))}
      </div>
    </div>
  );
};
