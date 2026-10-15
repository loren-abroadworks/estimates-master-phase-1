
import React, { useState, useRef, useEffect } from 'react';
import { Save, ArrowLeft, ChevronDown } from 'lucide-react';
import { Button, CheckboxGroup } from '../../../UI';
import { Typography } from '../../../../theme/designSystem';
import { ConfiguredScope } from '../../../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface TemplateToolbarProps {
  templateName: string;
  setTemplateName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  onSave: () => void;
  onBack: () => void;
  scopes?: ConfiguredScope[];
  selectedScopeIds?: string[];
  onUpdateScopes?: (ids: string[]) => void;
}

export const TemplateToolbar: React.FC<TemplateToolbarProps> = ({
  templateName,
  setTemplateName,
  description,
  setDescription,
  onSave,
  onBack,
  scopes,
  selectedScopeIds = [],
  onUpdateScopes
}) => {
  const { t } = useTranslation();
  const [isScopeMenuOpen, setIsScopeMenuOpen] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (scopeMenuRef.current && !scopeMenuRef.current.contains(event.target as Node)) {
        setIsScopeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedLabels = scopes
    ?.filter(s => selectedScopeIds.includes(s.id))
    .map(s => s.name)
    .join(', ');

  return (
    <div className="flex flex-col gap-4 lg:gap-6 mb-4 md:mb-8">
      <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="pl-0 hover:bg-transparent hover:text-primary-600">
              <ArrowLeft className="w-5 h-5 mr-1" /> {t('views.EstimateForm.sections.TemplateToolbar.backToTemplates')}
          </Button>
          <Button onClick={onSave} className="shadow-lg shadow-primary-500/20">
              <Save className="w-5 h-5 mr-2" /> {t('views.EstimateForm.sections.TemplateToolbar.saveTemplate')}
          </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
                <label className={Typography.label}>{t('views.EstimateForm.sections.TemplateToolbar.templateName')}</label>
                <input 
                    type="text" 
                    value={templateName} 
                    onChange={(e) => setTemplateName(e.target.value)} 
                    className="text-2xl md:text-3xl font-extrabold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-primary-400 focus:ring-0 outline-none w-full font-heading placeholder-gray-300 transition-all px-0 py-2" 
                    placeholder={t('views.EstimateForm.sections.TemplateToolbar.templateNamePlaceholder')}
                />
            </div>
            {scopes && onUpdateScopes && (
                <div className="md:pt-2 relative" ref={scopeMenuRef}>
                    <label className={`${Typography.label} mb-2 block`}>{t('views.EstimateForm.sections.TemplateToolbar.estimateTypes')}</label>
                    <button 
                        onClick={() => setIsScopeMenuOpen(!isScopeMenuOpen)}
                        className="w-full text-left bg-gray-50 border border-transparent hover:bg-gray-100 focus:bg-white rounded-xl p-3 text-base outline-none focus:ring-2 focus:ring-primary-100 transition-all flex justify-between items-center group"
                    >
                        <span className={`truncate ${selectedLabels ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                            {selectedLabels || t('views.EstimateForm.sections.TemplateToolbar.selectTypes')}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isScopeMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isScopeMenuOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                            <CheckboxGroup 
                                options={scopes.map(s => ({ label: s.name, value: s.id }))}
                                selectedValues={selectedScopeIds}
                                onChange={onUpdateScopes}
                            />
                        </div>
                    )}
                </div>
            )}
          </div>
          <div>
            <label className={Typography.label}>{t('views.EstimateForm.sections.TemplateToolbar.description')}</label>
            <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-400 rounded-xl p-3 text-base outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all resize-none mt-2" 
                placeholder={t('views.EstimateForm.sections.TemplateToolbar.descriptionPlaceholder')}
                rows={2}
            />
          </div>
      </div>
    </div>
  );
};
