
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal, TextInput, Button } from '../UI';
import { ChevronDown, Check, X } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface CreatePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateSources: string[]) => void;
}

export const CreatePresentationModal = ({ isOpen, onClose, onCreate }: CreatePresentationModalProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(['Exterior Full']);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const templateOptions = [
      { label: t('modals.CreatePresentationModal.templateInteriorStandard'), value: 'Interior Standard' },
      { label: t('modals.CreatePresentationModal.templateExteriorFull'), value: 'Exterior Full' },
      { label: t('modals.CreatePresentationModal.templateResidentialCustom'), value: 'Residential Custom' },
      { label: t('modals.CreatePresentationModal.templateCommercialBid'), value: 'Commercial Bid' },
      { label: t('modals.CreatePresentationModal.templateKitchenCabinets'), value: 'Kitchen Cabinets' },
      { label: t('modals.CreatePresentationModal.templateDeckRefinishing'), value: 'Deck Refinishing' },
  ];

  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: 'absolute',
            top: `${rect.bottom + window.scrollY + 8}px`,
            left: `${rect.left + window.scrollX}px`,
            width: `${rect.width}px`,
            zIndex: 9999
        });
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownEl = document.getElementById('template-multi-select-dropdown');
      if (
          buttonRef.current && 
          !buttonRef.current.contains(event.target as Node) && 
          dropdownEl && 
          !dropdownEl.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    
    // Close on scroll to avoid positioning drift
    const handleScroll = () => {
        if(isDropdownOpen) setIsDropdownOpen(false);
    };

    if (isDropdownOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isDropdownOpen]);

  const toggleOption = (value: string) => {
    setSelectedTemplates(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleCreate = () => {
    if (name) {
      onCreate(name, selectedTemplates);
      onClose();
    }
  };

  const dropdownContent = isDropdownOpen ? (
      <div 
         id="template-multi-select-dropdown"
         style={dropdownStyle}
         className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-2 animate-in fade-in zoom-in-95 duration-200"
      >
           {templateOptions.map(opt => (
               <div 
                   key={opt.value}
                   onClick={() => toggleOption(opt.value)}
                   className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedTemplates.includes(opt.value) ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
               >
                   <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedTemplates.includes(opt.value) ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}>
                       {selectedTemplates.includes(opt.value) && <Check className="w-3.5 h-3.5" />}
                   </div>
                   <span className="font-medium text-sm">{opt.label}</span>
               </div>
           ))}
      </div>
  ) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.CreatePresentationModal.title')}>
      <div className="space-y-6">
        <TextInput
          label={t('modals.CreatePresentationModal.presentationName')}
          placeholder={t('modals.CreatePresentationModal.namePlaceholder')}
          value={name}
          onChange={setName}
        />

        <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.CreatePresentationModal.estimateTemplateSource')}</label>
            <button
               ref={buttonRef}
               onClick={() => setIsDropdownOpen(!isDropdownOpen)}
               className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-left flex justify-between items-center focus:ring-2 focus:ring-primary-400/20 focus:border-primary-400 outline-none transition-all min-h-[48px]"
            >
               {selectedTemplates.length > 0 ? (
                   <div className="flex flex-wrap gap-2 py-1">
                       {selectedTemplates.map(val => {
                           const opt = templateOptions.find(o => o.value === val);
                           const label = opt ? opt.label : val;
                           return (
                               <span key={val} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 text-xs font-bold animate-in fade-in zoom-in duration-200">
                                   {label}
                                   <div 
                                       className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5 cursor-pointer transition-colors"
                                       onClick={(e) => { e.stopPropagation(); toggleOption(val); }}
                                   >
                                       <X className="w-3 h-3" />
                                   </div>
                               </span>
                           );
                       })}
                   </div>
               ) : (
                   <span className="text-gray-400 dark:text-gray-500 py-1">{t('modals.CreatePresentationModal.selectTemplatesPlaceholder')}</span>
               )}
               <ChevronDown className={`w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0 ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDropdownOpen && createPortal(dropdownContent, document.body)}
            
            {selectedTemplates.length === 0 && <p className="text-xs text-red-400 mt-1 ml-1">{t('modals.CreatePresentationModal.selectAtLeastOne')}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>{t('modals.CreatePresentationModal.cancel')}</Button>
          <Button onClick={handleCreate} disabled={!name || selectedTemplates.length === 0}>{t('modals.CreatePresentationModal.createPresentation')}</Button>
        </div>
      </div>
    </Modal>
  );
};
