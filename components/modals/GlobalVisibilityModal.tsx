
import React from 'react';
import { DollarSign, Hash, Paintbrush } from 'lucide-react';
import { Modal, Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const GlobalVisibilityModal = ({ isOpen, onClose, onUpdate }: { isOpen: boolean, onClose: () => void, onUpdate: (key: 'prices' | 'quantities' | 'coats', val: boolean) => void }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.GlobalVisibilityModal.title')}>
        <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('modals.GlobalVisibilityModal.description')}</p>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-white">{t('modals.GlobalVisibilityModal.prices')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('modals.GlobalVisibilityModal.pricesSubtitle')}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                     <Button size="sm" variant="secondary" onClick={() => onUpdate('prices', false)}>{t('modals.GlobalVisibilityModal.hideAll')}</Button>
                     <Button size="sm" onClick={() => onUpdate('prices', true)}>{t('modals.GlobalVisibilityModal.showAll')}</Button>
                </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-white">{t('modals.GlobalVisibilityModal.quantities')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('modals.GlobalVisibilityModal.quantitiesSubtitle')}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                     <Button size="sm" variant="secondary" onClick={() => onUpdate('quantities', false)}>{t('modals.GlobalVisibilityModal.hideAll')}</Button>
                     <Button size="sm" onClick={() => onUpdate('quantities', true)}>{t('modals.GlobalVisibilityModal.showAll')}</Button>
                </div>
            </div>

             <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Paintbrush className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-white">{t('modals.GlobalVisibilityModal.coats')}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('modals.GlobalVisibilityModal.coatsSubtitle')}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                     <Button size="sm" variant="secondary" onClick={() => onUpdate('coats', false)}>{t('modals.GlobalVisibilityModal.hideAll')}</Button>
                     <Button size="sm" onClick={() => onUpdate('coats', true)}>{t('modals.GlobalVisibilityModal.showAll')}</Button>
                </div>
            </div>
        </div>
    </Modal>
  );
};

export default GlobalVisibilityModal;
