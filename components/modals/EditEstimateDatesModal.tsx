
import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface EditEstimateDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dates: {
    estimateDate: string;
    validUntilDate: string;
  };
  onSave: (dates: { estimateDate: string; validUntilDate: string }) => void;
}

export const EditEstimateDatesModal = ({ isOpen, onClose, dates, onSave }: EditEstimateDatesModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(dates);

  useEffect(() => {
    if (isOpen) {
      // Ensure we have valid YYYY-MM-DD strings for inputs
      setFormData({
          estimateDate: dates.estimateDate ? new Date(dates.estimateDate).toISOString().split('T')[0] : '',
          validUntilDate: dates.validUntilDate ? new Date(dates.validUntilDate).toISOString().split('T')[0] : ''
      });
    }
  }, [isOpen, dates]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.EditEstimateDatesModal.title')}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('modals.EditEstimateDatesModal.estimateDate')}</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 text-gray-900 dark:text-white font-medium"
              value={formData.estimateDate}
              onChange={(e) => handleChange('estimateDate', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('modals.EditEstimateDatesModal.validUntil')}</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 text-gray-900 dark:text-white font-medium"
              value={formData.validUntilDate}
              onChange={(e) => handleChange('validUntilDate', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.EditEstimateDatesModal.cancel')}</Button>
          <Button onClick={handleSave} className="flex-1">{t('modals.EditEstimateDatesModal.saveChanges')}</Button>
        </div>
      </div>
    </Modal>
  );
};
