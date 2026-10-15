
import React, { useState, useEffect } from 'react';
import { Modal, TextInput, Button, PhoneInput } from '../UI';
import { Client, ClientProperty } from '../../types';
import { AlertCircle, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  onDelete?: (id: string) => void;
  existingClients: Client[];
  clientToEdit?: Client | null;
}

export const AddContactModal = ({ isOpen, onClose, onSave, onDelete, existingClients, clientToEdit }: AddContactModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: ''
  });
  
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (clientToEdit) {
        // Try to populate address fields from the first property if available, otherwise parse or leave blank
        const primaryProp = clientToEdit.properties && clientToEdit.properties.length > 0 ? clientToEdit.properties[0] : null;
        
        setFormData({
          firstName: clientToEdit.firstName || clientToEdit.name.split(' ')[0] || '',
          lastName: clientToEdit.lastName || clientToEdit.name.split(' ').slice(1).join(' ') || '',
          email: clientToEdit.email || '',
          phone: clientToEdit.phone || '',
          address: primaryProp ? primaryProp.address : (clientToEdit.address || ''),
          city: primaryProp ? primaryProp.city : '',
          state: primaryProp ? primaryProp.state : '',
          zip: primaryProp ? primaryProp.zip : ''
        });
      } else {
        // Reset for new contact
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          zip: ''
        });
      }
      setError(null);
    }
  }, [isOpen, clientToEdit]);

  const checkDuplicate = (email: string) => {
    if (!email) return null;
    // Exclude the client currently being edited from duplicate check
    const otherClients = clientToEdit ? existingClients.filter(c => c.id !== clientToEdit.id) : existingClients;
    
    const emailMatch = otherClients.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (emailMatch) {
      return `Duplicate: Client with email ${email} already exists (${emailMatch.name})`;
    }
    return null;
  };

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName) {
        setError(t('modals.AddContactModal.nameRequired'));
        return;
    }

    const dupError = checkDuplicate(formData.email);
    if (dupError) {
        setError(dupError);
        return;
    }

    setIsSaving(true);
    setError(null);

    // Simulate async processing
    setTimeout(() => {
        const fullAddress = formData.address 
            ? `${formData.address}${formData.city ? `, ${formData.city}` : ''}${formData.state ? `, ${formData.state}` : ''} ${formData.zip}`.trim()
            : '';

        const propertyId = clientToEdit && clientToEdit.properties.length > 0 ? clientToEdit.properties[0].id : `prop-${Date.now()}`;

        const newProperty: ClientProperty = {
            id: propertyId,
            address: formData.address || 'Unknown Address',
            city: formData.city || '',
            state: formData.state || '',
            zip: formData.zip || '',
            accessCode: ''
        };

        // Preserve existing properties if editing, but update the first one or add new if none existed
        let finalProperties: ClientProperty[] = [];
        if (clientToEdit && clientToEdit.properties.length > 0) {
             finalProperties = [newProperty, ...clientToEdit.properties.slice(1)];
        } else if (formData.address) {
             finalProperties = [newProperty];
        }

        const newClient: Client = {
            id: clientToEdit ? clientToEdit.id : `cli-${Date.now()}`,
            name: `${formData.firstName} ${formData.lastName}`,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            address: fullAddress, // Billing Address
            properties: finalProperties,
            starred: clientToEdit ? clientToEdit.starred : false,
            qualityRating: clientToEdit ? clientToEdit.qualityRating : 0,
            notes: clientToEdit ? clientToEdit.notes : ''
        };

        onSave(newClient);
        setIsSaving(false);
        setFormData({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
        onClose();
    }, 600);
  };

  const handleDelete = () => {
      if (clientToEdit && onDelete) {
          onDelete(clientToEdit.id);
      }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={clientToEdit ? t('modals.AddContactModal.editContact') : t('modals.AddContactModal.addNewContact')}>
      <div className="space-y-6">
        {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <TextInput label={t('modals.AddContactModal.firstName')} placeholder={t('modals.AddContactModal.firstNamePlaceholder')} value={formData.firstName} onChange={v => setFormData({...formData, firstName: v})} />
            <TextInput label={t('modals.AddContactModal.lastName')} placeholder={t('modals.AddContactModal.lastNamePlaceholder')} value={formData.lastName} onChange={v => setFormData({...formData, lastName: v})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <PhoneInput label={t('modals.AddContactModal.phone')} placeholder={t('modals.AddContactModal.phonePlaceholder')} value={formData.phone} onChange={v => setFormData({...formData, phone: v})} />
            <TextInput label={t('modals.AddContactModal.email')} placeholder={t('modals.AddContactModal.emailPlaceholder')} value={formData.email} onChange={v => setFormData({...formData, email: v})} />
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">{t('modals.AddContactModal.primaryAddress')}</h4>
            <div className="space-y-4">
                <TextInput label={t('modals.AddContactModal.streetAddress')} placeholder={t('modals.AddContactModal.streetAddressPlaceholder')} value={formData.address} onChange={v => setFormData({...formData, address: v})} />
                <div className="grid grid-cols-3 gap-3">
                    <TextInput label={t('modals.AddContactModal.city')} placeholder={t('modals.AddContactModal.cityPlaceholder')} value={formData.city} onChange={v => setFormData({...formData, city: v})} />
                    <TextInput label={t('modals.AddContactModal.state')} placeholder={t('modals.AddContactModal.statePlaceholder')} value={formData.state} onChange={v => setFormData({...formData, state: v})} />
                    <TextInput label={t('modals.AddContactModal.zip')} placeholder={t('modals.AddContactModal.zipPlaceholder')} value={formData.zip} onChange={v => setFormData({...formData, zip: v})} />
                </div>
            </div>
        </div>

        <div className="flex gap-3 pt-2">
            {clientToEdit && onDelete && (
                <Button variant="danger" onClick={handleDelete} className="px-3" title={t('modals.AddContactModal.deleteClient')}>
                    <Trash2 className="w-5 h-5" />
                </Button>
            )}
            <div className="flex gap-3 flex-1">
                <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.AddContactModal.cancel')}</Button>
                <Button onClick={handleSave} className="flex-1 shadow-lg shadow-primary-500/20" disabled={isSaving}>
                    {isSaving ? t('modals.AddContactModal.saving') : (clientToEdit ? t('modals.AddContactModal.saveChanges') : t('modals.AddContactModal.createContact'))}
                </Button>
            </div>
        </div>
      </div>
    </Modal>
  );
};
