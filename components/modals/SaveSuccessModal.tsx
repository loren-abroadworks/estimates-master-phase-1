
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal, Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface SaveSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToDashboard?: () => void;
}

export const SaveSuccessModal = ({ isOpen, onClose, onGoToDashboard }: SaveSuccessModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.SaveSuccessModal.title')} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center p-4">
        <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('modals.SaveSuccessModal.savedToDrafts')}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          {t('modals.SaveSuccessModal.savedDescription')}
        </p>
        <div className="flex flex-col w-full gap-3">
          <Button variant="primary" onClick={onClose} className="w-full justify-center shadow-lg shadow-primary-500/20">
            {t('modals.SaveSuccessModal.continueEditing')}
          </Button>
          {onGoToDashboard && (
              <Button variant="secondary" onClick={onGoToDashboard} className="w-full justify-center">
                {t('modals.SaveSuccessModal.returnToDashboard')}
              </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
