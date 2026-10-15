
import React, { useState } from 'react';
import { Modal, TextInput, Button } from '../UI';
import { ClientProperty } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: ClientProperty) => void;
}

export const AddPropertyModal = ({ isOpen, onClose, onSave }: AddPropertyModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<ClientProperty>>({
    address: '',
    city: '',
    state: '',
    zip: '',
    accessCode: ''
  });

  const handleSave = () => {
    if (!formData.address || !formData.city) return;
    
    const newProp: ClientProperty = {
        id: `prop-${Date.now()}`,
        address: formData.address!,
        city: formData.city!,
        state: formData.state || '',
        zip: formData.zip || '',
        accessCode: formData.accessCode
    };
    
    onSave(newProp);
    setFormData({ address: '', city: '', state: '', zip: '', accessCode: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.AddPropertyModal.title')}>
      <div className="space-y-6">
        <TextInput label={t('modals.AddPropertyModal.streetAddress')} placeholder={t('modals.AddPropertyModal.streetAddressPlaceholder')} value={formData.address || ''} onChange={v => setFormData({...formData, address: v})} />

        <div className="grid grid-cols-3 gap-3">
            <TextInput label={t('modals.AddPropertyModal.city')} placeholder={t('modals.AddPropertyModal.city')} value={formData.city || ''} onChange={v => setFormData({...formData, city: v})} />
            <TextInput label={t('modals.AddPropertyModal.state')} placeholder={t('modals.AddPropertyModal.statePlaceholder')} value={formData.state || ''} onChange={v => setFormData({...formData, state: v})} />
            <TextInput label={t('modals.AddPropertyModal.zip')} placeholder={t('modals.AddPropertyModal.zipPlaceholder')} value={formData.zip || ''} onChange={v => setFormData({...formData, zip: v})} />
        </div>

        <TextInput label={t('modals.AddPropertyModal.accessCode')} placeholder={t('modals.AddPropertyModal.accessCodePlaceholder')} value={formData.accessCode || ''} onChange={v => setFormData({...formData, accessCode: v})} />

        <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.AddPropertyModal.cancel')}</Button>
            <Button onClick={handleSave} className="flex-1">{t('modals.AddPropertyModal.saveProperty')}</Button>
        </div>
      </div>
    </Modal>
  );
};
