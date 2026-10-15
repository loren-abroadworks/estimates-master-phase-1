
import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Modal, Button, PhoneInput } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    billingAddress: string;
    city: string;
    state: string;
    zip: string;
  };
  onSave: (customer: any) => void;
  onSelectExisting: () => void;
}

export const EditClientModal = ({ isOpen, onClose, customer, onSave, onSelectExisting }: EditClientModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(customer);

  useEffect(() => {
    setFormData(customer);
  }, [customer, isOpen]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.EditClientModal.editClientInformation')}>
      <div className="space-y-6">
        <button
          onClick={onSelectExisting}
          className="w-full py-4 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200 font-bold hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all group"
        >
          <Search className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
          {t('modals.EditClientModal.selectExistingClient')}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t('modals.EditClientModal.firstName')}</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={e => handleChange('firstName', e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t('modals.EditClientModal.lastName')}</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={e => handleChange('lastName', e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t('modals.EditClientModal.email')}</label>
          <input
            type="email"
            value={formData.email}
            onChange={e => handleChange('email', e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t('modals.EditClientModal.phone')}</label>
          <PhoneInput
            value={formData.phone}
            onChange={v => handleChange('phone', v)}
            className="bg-white dark:bg-gray-900"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditClientModal.billingAddress')}</label>
          <div className="space-y-4">
            <input
              type="text"
              placeholder={t('modals.EditClientModal.addressPlaceholder')}
              value={formData.billingAddress}
              onChange={e => handleChange('billingAddress', e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
            />
            <div className="grid grid-cols-3 gap-4">
              <input
                type="text"
                placeholder={t('modals.EditClientModal.cityPlaceholder')}
                value={formData.city}
                onChange={e => handleChange('city', e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
              />
              <input
                type="text"
                placeholder={t('modals.EditClientModal.statePlaceholder')}
                value={formData.state}
                onChange={e => handleChange('state', e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
              />
              <input
                type="text"
                placeholder={t('modals.EditClientModal.zipPlaceholder')}
                value={formData.zip}
                onChange={e => handleChange('zip', e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} className="px-8 py-3 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/20">
            {t('modals.EditClientModal.done')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditClientModal;
