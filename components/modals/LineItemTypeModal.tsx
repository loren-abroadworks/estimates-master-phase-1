
import React from 'react';
import { Type, Calculator, Grid } from 'lucide-react';
import { Modal } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const LineItemTypeModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (type: 'area' | 'priced' | 'descriptive') => void }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" hideHeader={true}>
      <div className="text-center mb-8 relative">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('modals.LineItemTypeModal.addToEstimate')}</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t('modals.LineItemTypeModal.chooseWhatToAdd')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => onSelect('area')}
          className="flex flex-col items-center justify-center p-8 border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl hover:-translate-y-1 transition-all group bg-white dark:bg-gray-800"
        >
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Grid className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white font-heading">{t('modals.LineItemTypeModal.newArea')}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">{t('modals.LineItemTypeModal.newAreaDescription')}</p>
        </button>

        <button
          onClick={() => onSelect('priced')}
          className="flex flex-col items-center justify-center p-8 border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl hover:-translate-y-1 transition-all group bg-white dark:bg-gray-800"
        >
          <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4 text-green-600 dark:text-green-400 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Calculator className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white font-heading">{t('modals.LineItemTypeModal.pricedItem')}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">{t('modals.LineItemTypeModal.pricedItemDescription')}</p>
        </button>

        <button
          onClick={() => onSelect('descriptive')}
          className="flex flex-col items-center justify-center p-8 border border-gray-200 dark:border-gray-700 rounded-2xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl hover:-translate-y-1 transition-all group bg-white dark:bg-gray-800"
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Type className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white font-heading">{t('modals.LineItemTypeModal.descriptiveItem')}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">{t('modals.LineItemTypeModal.descriptiveItemDescription')}</p>
        </button>
      </div>
    </Modal>
  );
};

export default LineItemTypeModal;
