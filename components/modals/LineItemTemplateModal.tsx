
import React, { useState } from 'react';
import { FileText, Calculator, Plus, ChevronRight, LayoutTemplate } from 'lucide-react';
import { Modal, SearchInput } from '../UI';
import { LineItemTemplate } from '../../types';
import { INITIAL_LINE_ITEM_TEMPLATES } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

// We now use the shared interface from types.ts instead of local Template
// Reusing INITIAL_LINE_ITEM_TEMPLATES as base, but this component likely receives templates via props in a real app or imports them.
// For now, let's map the imported constants to a local list for the mock data, merging structure.

const MOCK_TEMPLATES: LineItemTemplate[] = [
    ...INITIAL_LINE_ITEM_TEMPLATES,
    { id: 'pt-1', type: 'priced', name: "Wallpaper Removal", defaultPrice: 450, description: "Strip existing wallpaper, wash adhesive residue, prime walls with oil-based primer, and prep for painting.", operationType: 'flat' },
    { id: 'pt-2', type: 'priced', name: "Drywall Repair (Patch)", defaultPrice: 150, description: "Cut out damaged area, install backing, patch with drywall, tape, mud, and sand smooth.", operationType: 'flat' },
    { id: 'pt-3', type: 'priced', name: "Power Washing", defaultPrice: 350, description: "Pressure wash exterior surfaces to remove dirt, mildew, and loose paint.", operationType: 'flat' },
    { id: 'pt-8', type: 'priced', name: "Lead Safety Setup", defaultPrice: 500, description: "EPA RRP compliance setup including containment, signage, and HEPA vacuuming.", operationType: 'flat' },
    { id: 'pt-9', type: 'priced', name: "General Overhead", defaultPrice: 10, description: "10% overhead charge.", operationType: 'percent' },
    { id: 'dt-1', type: 'descriptive', name: "Scope of Work", description: "Detailed description of the work to be performed including all preparation and finishing steps." },
    { id: 'dt-2', type: 'descriptive', name: "Exclusions", description: "The following items are NOT included in this proposal: Floors, window treatments, personal items, and hidden repairs." },
    { id: 'dt-4', type: 'descriptive', name: "Warranty Information", description: "Includes a 3-year limited warranty against peeling and blistering. Cracks caused by structural movement are not covered." },
];

export const LineItemTemplateModal = ({ 
    isOpen, 
    onClose, 
    type, 
    onSelect 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    type: 'priced' | 'descriptive' | null;
    onSelect: (template: any | null) => void;
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen || !type) return null;

    const templates = MOCK_TEMPLATES.filter(t => t.type === type);
    const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase()));

    const Icon = type === 'priced' ? Calculator : FileText;
    const colorClass = type === 'priced' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={type === 'priced' ? t('modals.LineItemTemplateModal.selectPricedItem') : t('modals.LineItemTemplateModal.selectDescriptiveItem')}>
            <div className="space-y-4">
                <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('modals.LineItemTemplateModal.searchPlaceholder')} />
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    {/* Blank Option */}
                    <button 
                        onClick={() => onSelect(null)}
                        className="w-full text-left p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex items-center gap-4 group"
                    >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-white dark:group-hover:bg-gray-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-800 dark:group-hover:text-primary-400">{t('modals.LineItemTemplateModal.blankItem')}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('modals.LineItemTemplateModal.blankItemDescription')}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 dark:group-hover:text-primary-500" />
                    </button>

                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />

                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('modals.LineItemTemplateModal.templatesLabel')}</p>

                    {filteredTemplates.map(template => (
                        <button 
                            key={template.id}
                            onClick={() => onSelect({
                                title: template.name,
                                defaultPrice: template.defaultPrice,
                                defaultDetails: template.description,
                                operationType: template.operationType
                            })}
                            className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all flex items-center gap-4 group bg-white dark:bg-gray-800"
                        >
                             <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                     <h4 className="font-bold text-gray-900 dark:text-white text-lg">{template.name}</h4>
                                     {type === 'priced' && (
                                         <span className="font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded text-sm border border-gray-100 dark:border-gray-600">
                                            {template.operationType === 'percent' ? `${template.defaultPrice}%` : `$${template.defaultPrice}`}
                                         </span>
                                     )}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{template.description}</p>
                            </div>
                            <div className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-xs font-extrabold group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:border-primary-200 dark:group-hover:border-primary-800 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-all whitespace-nowrap">
                                {t('modals.LineItemTemplateModal.use')}
                            </div>
                        </button>
                    ))}
                    
                    {filteredTemplates.length === 0 && (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('modals.LineItemTemplateModal.noTemplatesFound', { searchTerm })}</div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
