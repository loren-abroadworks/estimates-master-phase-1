
import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput } from '../UI';
import { DatePicker } from '../ui/DatePicker';
import { useTranslation } from '@/i18n/LanguageContext';

interface EditWorkOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'location' | 'schedule';
  initialData: any;
  onSave: (data: any) => void;
}

export const EditWorkOrderDetailsModal = ({ isOpen, onClose, type, initialData, onSave }: EditWorkOrderDetailsModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(initialData);
  
  // Specific state for location fields to match the requested UI
  const [addressComponents, setAddressComponents] = useState({
    street: '',
    city: '',
    state: '',
    zip: ''
  });

  useEffect(() => {
    if (isOpen) {
        setFormData(initialData);
        
        if (type === 'location' && initialData.jobAddress) {
            // Attempt to parse existing address string
            // Expected format: "Street, City, State Zip" or similar
            const parts = initialData.jobAddress.split(',').map((s: string) => s.trim());
            
            let street = initialData.jobAddress;
            let city = '';
            let state = '';
            let zip = '';

            // Basic parsing logic
            if (parts.length >= 2) {
                street = parts[0];
                
                if (parts.length === 3) {
                    // Standard: Street, City, State Zip
                    city = parts[1];
                    const stateZip = parts[2];
                    const szMatch = stateZip.match(/([a-zA-Z\s.]+)\s+(\d{5}(-\d{4})?)/);
                    if (szMatch) {
                        state = szMatch[1].trim();
                        zip = szMatch[2].trim();
                    } else {
                        state = stateZip;
                    }
                } else if (parts.length === 2) {
                    // Street, City (assume no state/zip) OR Street, State Zip
                    // Simple heuristic: if part 2 has numbers, it's likely State Zip
                    if (/\d/.test(parts[1])) {
                         const szMatch = parts[1].match(/([a-zA-Z\s.]+)\s+(\d{5}(-\d{4})?)/);
                         if (szMatch) {
                             state = szMatch[1].trim();
                             zip = szMatch[2].trim();
                         } else {
                             city = parts[1];
                         }
                    } else {
                        city = parts[1];
                    }
                }
            }

            setAddressComponents({ street, city, state, zip });
        } else {
            // Reset if no address
            setAddressComponents({ street: '', city: '', state: '', zip: '' });
        }
    }
  }, [isOpen, initialData, type]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field: keyof typeof addressComponents, value: string) => {
      setAddressComponents(prev => ({...prev, [field]: value}));
  };

  const handleSave = () => {
    if (type === 'location') {
        // Reconstruct address string
        const { street, city, state, zip } = addressComponents;
        const addressParts = [street];
        if (city) addressParts.push(city);
        if (state || zip) addressParts.push(`${state} ${zip}`.trim());
        
        onSave({
            ...formData,
            jobAddress: addressParts.join(', ')
        });
    } else {
        onSave(formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={type === 'location' ? t('modals.EditWorkOrderDetailsModal.editJobLocation') : t('modals.EditWorkOrderDetailsModal.editSchedule')}
    >
      <div className="space-y-6">
        {type === 'location' ? (
          <>
            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditWorkOrderDetailsModal.streetAddress')}</label>
                <input
                    type="text"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                    value={addressComponents.street}
                    onChange={(e) => handleAddressChange('street', e.target.value)}
                    placeholder={t('modals.EditWorkOrderDetailsModal.streetAddressPlaceholder')}
                />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditWorkOrderDetailsModal.city')}</label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                        value={addressComponents.city}
                        onChange={(e) => handleAddressChange('city', e.target.value)}
                        placeholder={t('modals.EditWorkOrderDetailsModal.city')}
                    />
                </div>
                <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditWorkOrderDetailsModal.state')}</label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                        value={addressComponents.state}
                        onChange={(e) => handleAddressChange('state', e.target.value)}
                        placeholder={t('modals.EditWorkOrderDetailsModal.statePlaceholder')}
                    />
                </div>
                <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditWorkOrderDetailsModal.zip')}</label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                        value={addressComponents.zip}
                        onChange={(e) => handleAddressChange('zip', e.target.value)}
                        placeholder={t('modals.EditWorkOrderDetailsModal.zipPlaceholder')}
                    />
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block ml-1">{t('modals.EditWorkOrderDetailsModal.accessCodeLabel')}</label>
                <input
                    type="text"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                    value={formData.accessCode || ''}
                    onChange={(e) => handleChange('accessCode', e.target.value)}
                    placeholder={t('modals.EditWorkOrderDetailsModal.accessCodePlaceholder')}
                />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
                label={t('modals.EditWorkOrderDetailsModal.startDate')}
                value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                onChange={(date) => handleChange('startDate', date)}
            />
            <DatePicker
                label={t('modals.EditWorkOrderDetailsModal.endDate')}
                value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                onChange={(date) => handleChange('endDate', date)}
            />
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.EditWorkOrderDetailsModal.cancel')}</Button>
          <Button onClick={handleSave} className="flex-1">{t('modals.EditWorkOrderDetailsModal.saveChanges')}</Button>
        </div>
      </div>
    </Modal>
  );
};
