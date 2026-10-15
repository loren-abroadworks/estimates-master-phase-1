
import React from 'react';
import { Home } from 'lucide-react';
import { Modal } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const PropertySelectionModal = ({ isOpen, onClose, onSelect, properties }: { isOpen: boolean, onClose: () => void, onSelect: (p: any) => void, properties: any[] }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.PropertySelectionModal.selectExistingProperty')}>
      <div className="space-y-4">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {properties.map((prop, idx) => (
            <div key={idx} onClick={() => onSelect(prop)} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md cursor-pointer transition-all">
              <div className="flex items-center gap-2 mb-1">
                 <Home className="w-4 h-4 text-gray-400" />
                 <span className="font-bold text-gray-900 dark:text-white text-base">{prop.address}</span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 ml-6">
                 {prop.city}, {prop.state} {prop.zip}
              </div>
            </div>
          ))}
          {properties.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">{t('modals.PropertySelectionModal.noProperties')}</p>}
        </div>
      </div>
    </Modal>
  );
};
