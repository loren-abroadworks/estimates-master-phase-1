
import React, { useState } from 'react';
import { Home, Sun, Box, Building2, ChevronRight, LayoutTemplate, ArrowLeft } from 'lucide-react';
import { Modal, Button } from '../UI';
import { ConfiguredScope } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

export const CreateEstimateModal = ({ 
  isOpen, 
  onClose, 
  onCreate,
  scopes,
  templates = [],
  mode = 'estimate'
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCreate: (data: { type: string, template: string }) => void;
  scopes?: ConfiguredScope[];
  templates?: any[];
  mode?: 'estimate' | 'invoice';
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleClose = () => {
    setStep(1);
    setSelectedType(null);
    setSelectedTemplate(null);
    onClose();
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    setStep(2);
  };

  const handleCreate = () => {
    if (step === 2 && selectedTemplate) {
      onCreate({ type: selectedType!, template: selectedTemplate! });
      handleClose();
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedTemplate(null);
    }
  };

  const getIconForScope = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('interior')) return Home;
      if (n.includes('exterior')) return Sun;
      if (n.includes('cabinet')) return Box;
      if (n.includes('commercial')) return Building2;
      return LayoutTemplate;
  };

  const filteredTemplates = templates.filter(t => {
      // Check legacy singular scopeId
      const matchesScopeId = t.scopeId === selectedType || t.typeId === selectedType || t.scopeId === 'all';
      
      // Check new array scopeIds
      const matchesScopeIds = t.scopeIds && Array.isArray(t.scopeIds) && (t.scopeIds.includes(selectedType) || t.scopeIds.includes('all'));
      
      return matchesScopeId || matchesScopeIds;
  });

  if (!isOpen) return null;

  // Title Logic
  const getTitle = () => {
      if (step === 2) return t('modals.CreateEstimateModal.selectTemplate');
      return mode === 'invoice' ? t('modals.CreateEstimateModal.startNewInvoice') : t('modals.CreateEstimateModal.startNewEstimate');
  };

  // Button Label Logic
  const getButtonLabel = () => {
      return mode === 'invoice' ? t('modals.CreateEstimateModal.createInvoice') : t('modals.CreateEstimateModal.createEstimate');
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getTitle()}>
      <div className="space-y-6">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
             <p className="text-gray-500 dark:text-gray-400 mb-6">
                {mode === 'invoice'
                    ? t('modals.CreateEstimateModal.chooseProjectTypeInvoice')
                    : t('modals.CreateEstimateModal.chooseProjectTypeEstimate')
                }
             </p>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {scopes?.map(scope => {
                 const Icon = getIconForScope(scope.name);
                 return (
                 <button 
                   key={scope.id}
                   onClick={() => handleTypeSelect(scope.id)}
                   className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg flex flex-col gap-4 ${selectedType === scope.id ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/30 ring-2 ring-primary-200 dark:ring-primary-800' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-200 dark:hover:border-primary-700'}`}
                 >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedType === scope.id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-lg mb-1 ${selectedType === scope.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{scope.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">{scope.description || t('modals.CreateEstimateModal.standardEstimateType')}</p>
                    </div>
                 </button>
               )})}
             </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
               <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm">
                 {(() => {
                    const s = scopes?.find(t => t.id === selectedType);
                    const Icon = s ? getIconForScope(s.name) : LayoutTemplate;
                    return <Icon className="w-5 h-5" />;
                 })()}
               </div>
               <div>
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('modals.CreateEstimateModal.projectType')}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{scopes?.find(t => t.id === selectedType)?.name}</div>
               </div>
            </div>
            
            <p className="text-gray-500 dark:text-gray-400 mb-4 font-medium">{t('modals.CreateEstimateModal.availableTemplates')}</p>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
               {/* Always show a blank option */}
               <button 
                    onClick={() => setSelectedTemplate(`blank-${Date.now()}`)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${selectedTemplate && selectedTemplate.startsWith('blank') ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md'}`}
                  >
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedTemplate && selectedTemplate.startsWith('blank') ? 'bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}>
                          <LayoutTemplate className="w-5 h-5" />
                       </div>
                       <div>
                          <div className={`font-bold text-base text-gray-700 dark:text-gray-300`}>{t('modals.CreateEstimateModal.blankOption', { type: mode === 'invoice' ? t('modals.CreateEstimateModal.invoiceWord') : t('modals.CreateEstimateModal.estimateWord') })}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t('modals.CreateEstimateModal.startFromScratch')}</div>
                       </div>
                    </div>
                </button>

               {/* User Templates */}
               {filteredTemplates.map(template => (
                  <button 
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${selectedTemplate === template.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md'}`}
                  >
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedTemplate === template.id ? 'bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`}>
                          <LayoutTemplate className="w-5 h-5" />
                       </div>
                       <div>
                          <div className={`font-bold text-base ${selectedTemplate === template.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{template.name || template.projectName}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{template.description || t('modals.CreateEstimateModal.customTemplate')}</div>
                       </div>
                    </div>
                  </button>
               ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
             <Button variant="secondary" onClick={handleBack} className="flex-1">
                <ArrowLeft className="w-4 h-4" /> {t('modals.CreateEstimateModal.back')}
             </Button>
            <Button 
              className="flex-[2] shadow-lg shadow-primary-500/20" 
              disabled={!selectedTemplate}
              onClick={handleCreate}
            >
              {getButtonLabel()}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
