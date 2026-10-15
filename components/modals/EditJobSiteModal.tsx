
import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Modal, Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface EditJobSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobAddress: {
    address: string;
    city: string;
    state: string;
    zip: string;
    accessCode?: string;
  };
  billingAddress: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  onSave: (address: any) => void;
  onSelectExisting: () => void;
}

export const EditJobSiteModal = ({ isOpen, onClose, jobAddress, billingAddress, onSave, onSelectExisting }: EditJobSiteModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(jobAddress);
  const [useBilling, setUseBilling] = useState(false);

  useEffect(() => {
    setFormData(jobAddress);
  }, [jobAddress, isOpen]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (useBilling) setUseBilling(false);
  };

  const handleUseBilling = (checked: boolean) => {
    setUseBilling(checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        address: billingAddress.address,
        city: billingAddress.city,
        state: billingAddress.state,
        zip: billingAddress.zip
      }));
    }
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.EditJobSiteModal.title')}>
      <div className="space-y-6">
        <button
          onClick={onSelectExisting}
          className="w-full py-4 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center gap-2 text-gray-700 dark:text-gray-200 font-bold hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all group"
        >
          <Search className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
          {t('modals.EditJobSiteModal.selectExistingProperty')}
        </button>

        <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
            <input 
                type="checkbox" 
                checked={useBilling}
                onChange={(e) => handleUseBilling(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 checked:bg-primary-600 checked:border-primary-600 accent-primary-600"
            />
            <span className="font-bold text-gray-700 dark:text-gray-300">{t('modals.EditJobSiteModal.sameAsBilling')}</span>
        </label>

        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditJobSiteModal.streetAddress')}</label>
          <input
            type="text"
            placeholder={t('modals.EditJobSiteModal.streetAddressPlaceholder')}
            value={formData.address}
            onChange={e => handleChange('address', e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.EditJobSiteModal.city')}</label>
                <input
                    type="text"
                    placeholder={t('modals.EditJobSiteModal.city')}
                    value={formData.city}
                    onChange={e => handleChange('city', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.EditJobSiteModal.state')}</label>
                <input
                    type="text"
                    placeholder={t('modals.EditJobSiteModal.statePlaceholder')}
                    value={formData.state}
                    onChange={e => handleChange('state', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block ml-1">{t('modals.EditJobSiteModal.zip')}</label>
                <input
                    type="text"
                    placeholder={t('modals.EditJobSiteModal.zipPlaceholder')}
                    value={formData.zip}
                    onChange={e => handleChange('zip', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                />
            </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t('modals.EditJobSiteModal.accessCodeLabel')}</label>
          <input
            type="text"
            placeholder={t('modals.EditJobSiteModal.accessCodePlaceholder')}
            value={formData.accessCode || ''}
            onChange={e => handleChange('accessCode', e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} className="px-8 py-3 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/20">
            {t('modals.EditJobSiteModal.done')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditJobSiteModal;
