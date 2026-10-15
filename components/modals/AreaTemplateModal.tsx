
import React, { useState, useMemo } from 'react';
import { SearchInput, Button, Modal } from '../UI';
import { AreaTemplate, ProductionRate } from '../../types';
import { Plus, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface AreaTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: AreaTemplate[];
  rates: ProductionRate[];
  onSelect: (template: AreaTemplate) => void;
}

export const AreaTemplateModal = ({ isOpen, onClose, templates, rates, onSelect }: AreaTemplateModalProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'name'>('default');

  const filteredAreas = useMemo(() => {
    let filtered = templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  }, [templates, searchTerm, sortBy]);

  const handleSelectBlank = () => {
      onSelect({
          id: `temp-blank-${Date.now()}`,
          name: 'New Area',
          scopeId: 'scope-int', // Default to interior, logic will adapt
          defaultRateIds: []
      });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.AreaTemplateModal.title')}>
      <div className="flex flex-col gap-4 mb-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('modals.AreaTemplateModal.searchPlaceholder')} className="md:max-w-full" />
        <div className="flex gap-2">
          <Button 
            onClick={() => setSortBy('default')} 
            size="sm" 
            variant={sortBy === 'default' ? 'primary' : 'secondary'} 
            className={`whitespace-nowrap ${sortBy === 'default' ? '!bg-primary-50 dark:!bg-primary-900/30 !border-primary-300 dark:!border-primary-700 !text-primary-800 dark:!text-primary-200' : '!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !text-gray-600 dark:!text-gray-300 hover:!bg-gray-50 dark:hover:!bg-gray-700'}`}
          >
            {t('modals.AreaTemplateModal.sortDefault')}
          </Button>
          <Button
            onClick={() => setSortBy('name')}
            size="sm"
            variant={sortBy === 'name' ? 'primary' : 'secondary'}
            className={`whitespace-nowrap ${sortBy === 'name' ? '!bg-primary-50 dark:!bg-primary-900/30 !border-primary-300 dark:!border-primary-700 !text-primary-800 dark:!text-primary-200' : '!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !text-gray-600 dark:!text-gray-300 hover:!bg-gray-50 dark:hover:!bg-gray-700'}`}
          >
            {t('modals.AreaTemplateModal.sortName')}
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
        {/* Blank Area Option */}
        <button 
            onClick={handleSelectBlank}
            className="w-full text-left p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex items-center gap-4 group"
        >
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-white dark:group-hover:bg-gray-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                <Plus className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-800 dark:group-hover:text-primary-400">{t('modals.AreaTemplateModal.blankAreaTitle')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('modals.AreaTemplateModal.blankAreaDescription')}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 dark:group-hover:text-primary-500" />
        </button>

        <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">{t('modals.AreaTemplateModal.templatesLabel')}</p>

        {filteredAreas.map(tmpl => (
          <button key={tmpl.id} onClick={() => onSelect(tmpl)} className="flex flex-col text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-primary-50/50 dark:hover:bg-primary-900/10 hover:border-primary-300 dark:hover:border-primary-700 transition-all group shadow-sm hover:shadow-md bg-white dark:bg-gray-800">
            <span className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-400">{tmpl.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{t('modals.AreaTemplateModal.surfaces', { surfaces: tmpl.defaultRateIds.map(id => rates.find(r => r.id === id)?.name).join(', ') || t('modals.AreaTemplateModal.none') })}</span>
          </button>
        ))}
        
        {filteredAreas.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('modals.AreaTemplateModal.noResults')}</p>}
      </div>
    </Modal>
  );
};
