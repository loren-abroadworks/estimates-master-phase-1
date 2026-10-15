
import React, { useState } from 'react';
import { Modal, SearchInput } from '../../../UI';
import { AVAILABLE_ICONS } from '../types';
import { useTranslation } from '@/i18n/LanguageContext';

export const IconPickerModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (icon: any) => void }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    const handleClose = () => {
        setSearchTerm('');
        onClose();
    };

    const handleSelect = (icon: any) => {
        onSelect(icon);
        handleClose();
    };

    if (!isOpen) return null;

    const filteredIcons = AVAILABLE_ICONS.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={t('views.PresentationBuilder.modals.IconPickerModal.chooseIcon')} maxWidth="max-w-2xl">
            <div className="space-y-4">
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={t('views.PresentationBuilder.modals.IconPickerModal.searchPlaceholder')}
                />
                <div className="grid grid-cols-5 md:grid-cols-6 gap-3 p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {filteredIcons.map((item) => (
                        <button 
                            key={item.name} 
                            onClick={() => handleSelect(item.icon)}
                            title={item.name}
                            className="aspect-square flex items-center justify-center p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group shadow-sm"
                        >
                            <item.icon className="w-8 h-8 text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" strokeWidth={1.5} />
                        </button>
                    ))}
                    {filteredIcons.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 dark:text-gray-500">
                            {t('views.PresentationBuilder.modals.IconPickerModal.noIconsFound', { searchTerm })}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
