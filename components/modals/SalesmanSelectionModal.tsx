
import React from 'react';
import { Modal } from '../UI';
import { MOCK_SALESMEN } from '../../data/mockData';
import { useTranslation } from '@/i18n/LanguageContext';

export const SalesmanSelectionModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (s: any) => void }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('modals.SalesmanSelectionModal.selectEstimator')}>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                {MOCK_SALESMEN.map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => onSelect(s)}
                        className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex items-center justify-between group bg-white dark:bg-gray-800"
                    >
                        <div>
                            <div className="font-bold text-gray-900 dark:text-white group-hover:text-primary-800 dark:group-hover:text-primary-400 text-base">{s.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{s.email}</div>
                        </div>
                         <div className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 font-medium">{s.phone}</div>
                    </button>
                ))}
            </div>
        </Modal>
    );
};

export default SalesmanSelectionModal;
