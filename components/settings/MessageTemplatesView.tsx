
import React, { useState } from 'react';
import { Mail, MessageSquare, Save, Info } from 'lucide-react';
import { Card, Button, TextArea, TextInput } from '../UI';
import { GlobalSettings, MessageTemplate } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface MessageTemplatesViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

export const MessageTemplatesView = ({ settings, setSettings }: MessageTemplatesViewProps) => {
  const { t } = useTranslation();
  const [activeTemplateId, setActiveTemplateId] = useState<string>(settings.messageTemplates[0]?.id || '');
  
  const activeTemplate = settings.messageTemplates.find(t => t.id === activeTemplateId);

  const handleUpdate = (field: keyof MessageTemplate, value: string) => {
      if (!activeTemplate) return;
      const updatedTemplates = settings.messageTemplates.map(t => 
          t.id === activeTemplateId ? { ...t, [field]: value } : t
      );
      setSettings({ ...settings, messageTemplates: updatedTemplates });
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="mb-8 md:mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.MessageTemplatesView.automatedMessages')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.MessageTemplatesView.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar List */}
          <div className="lg:col-span-4 space-y-3">
              {settings.messageTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => setActiveTemplateId(template.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                        activeTemplateId === template.id 
                        ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 shadow-sm ring-1 ring-primary-200 dark:ring-primary-800' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          activeTemplateId === template.id ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                          <Mail className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                          <div className={`font-bold text-sm truncate ${activeTemplateId === template.id ? 'text-primary-900 dark:text-primary-200' : 'text-gray-900 dark:text-white'}`}>{template.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">{template.subject}</div>
                      </div>
                  </button>
              ))}
          </div>

          {/* Editor Area */}
          <div className="lg:col-span-8">
              {activeTemplate ? (
                  <Card className="p-6 md:p-8 h-full border-0 shadow-lg flex flex-col bg-white dark:bg-gray-800">
                      <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading">{activeTemplate.label}</h3>
                          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full text-xs font-bold uppercase tracking-wider">
                             {t('settings.MessageTemplatesView.templateBadge')}
                          </div>
                      </div>

                      <div className="space-y-6 flex-1">
                          <TextInput
                              label={t('settings.MessageTemplatesView.emailSubject')}
                              value={activeTemplate.subject}
                              onChange={(v) => handleUpdate('subject', v)}
                          />
                          
                          <div>
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 block">{t('settings.MessageTemplatesView.messageBody')}</label>
                              <TextArea 
                                  value={activeTemplate.body} 
                                  onChange={(v) => handleUpdate('body', v)} 
                                  rows={12}
                                  className="font-mono text-sm leading-relaxed bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                              />
                          </div>
                          
                          {/* Variables Helper */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2 text-blue-800 dark:text-blue-300 font-bold text-sm">
                                  <Info className="w-4 h-4" /> {t('settings.MessageTemplatesView.availableVariables')}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {activeTemplate.availableVariables.map(variable => (
                                      <span key={variable} className="px-2 py-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded text-xs font-mono text-blue-700 dark:text-blue-400 select-all cursor-copy" title={t('settings.MessageTemplatesView.clickToSelect')}>
                                          {variable}
                                      </span>
                                  ))}
                              </div>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                  {t('settings.MessageTemplatesView.variablesHelperText')}
                              </p>
                          </div>
                      </div>
                  </Card>
              ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                      {t('settings.MessageTemplatesView.selectTemplateToEdit')}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
