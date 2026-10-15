
import React, { useState, useEffect } from 'react';
import { Modal, TextInput, Button, Select, PhoneInput } from '../UI';
import { Lead, Client } from '../../types';
import { AlertCircle, CheckCircle2, X, Search, User, Phone, Mail, MapPin, Link2, UserPlus } from 'lucide-react';
import { ClientSelectionModal } from './ClientSelectionModal';
import { useTranslation } from '@/i18n/LanguageContext';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  existingLeads: Lead[];
  existingClients: Client[];
  leadToEdit?: Lead;
}

const COMMON_SOURCES = [
  'Website', 
  'Referral', 
  'Google', 
  'Facebook', 
  'Instagram', 
  'Thumbtack', 
  'Angi', 
  'Nextdoor', 
  'Yard Sign', 
  'Truck Wrap'
];

export const AddLeadModal = ({ isOpen, onClose, onSave, existingLeads, existingClients, leadToEdit }: AddLeadModalProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'form' | 'resolve'>('form');
  const [formData, setFormData] = useState<Partial<Lead>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    status: 'New',
    clientId: undefined
  });
  
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);

  useEffect(() => {
    if (isOpen) {
        setStep('form');
        setMatchingClients([]);
        
        if (leadToEdit) {
            setFormData(leadToEdit);
            const src = leadToEdit.source || '';
            if (src && !COMMON_SOURCES.includes(src)) {
                setIsCustomSource(true);
            } else {
                setIsCustomSource(false);
            }
        } else {
            setFormData({
                firstName: '', lastName: '', email: '', phone: '', 
                source: '', address: '', city: '', state: '', zip: '', status: 'New', clientId: undefined
            });
            setIsCustomSource(false);
        }
    }
  }, [isOpen, leadToEdit]);

  // Strict duplicate check against other LEADS (prevents double entry in pipeline)
  const checkLeadDuplicate = (email: string, phone: string) => {
    const otherLeads = existingLeads.filter(l => !leadToEdit || l.id !== leadToEdit.id);
    const emailMatch = otherLeads.find(l => l.email === email);
    const phoneMatch = otherLeads.find(l => l.phone === phone);
    
    if (emailMatch) return `Duplicate: Lead with email ${email} already exists.`;
    if (phoneMatch) return `Duplicate: Lead with phone ${phone} already exists.`;
    return null;
  };

  const handleClientSelect = (client: Client) => {
      const fname = client.firstName || client.name.split(' ')[0] || '';
      const lname = client.lastName || client.name.split(' ').slice(1).join(' ') || '';
      
      let address = client.address;
      let city = '';
      let state = '';
      let zip = '';

      if (client.properties && client.properties.length > 0) {
          address = client.properties[0].address;
          city = client.properties[0].city;
          state = client.properties[0].state;
          zip = client.properties[0].zip;
      }

      setFormData(prev => ({
          ...prev,
          firstName: fname,
          lastName: lname,
          email: client.email,
          phone: client.phone,
          address,
          city,
          state,
          zip,
          source: 'Existing Client',
          clientId: client.id
      }));
      setIsClientSelectOpen(false);
  };

  const handleConnectClient = (client: Client) => {
      handleClientSelect(client); // Updates formData with client info
      // Proceed to save immediately after state updates
      setTimeout(() => executeSave({ ...formData, clientId: client.id }), 100);
  };

  const handleCreateNewAnyway = () => {
      executeSave({ ...formData, clientId: undefined });
  };

  const executeSave = (finalData: Partial<Lead>) => {
      setIsSaving(true);
      setError(null);

      // Simulate async save
      setTimeout(() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const randomId = Math.floor(100 + Math.random() * 900);
          
          const finalId = leadToEdit?.id || `lead-${Date.now()}`;
          const finalJobId = leadToEdit?.generatedJobId || `JOBS/${year}/${month}/${randomId}`;
          const finalDate = leadToEdit?.date || now.toISOString();

          const newLead: Lead = {
              id: finalId,
              date: finalDate,
              firstName: finalData.firstName!,
              lastName: finalData.lastName!,
              phone: finalData.phone!,
              email: finalData.email!,
              source: finalData.source || 'Unknown',
              address: finalData.address || '',
              city: finalData.city || '',
              state: finalData.state || '',
              zip: finalData.zip || '',
              status: finalData.status || 'New',
              generatedJobId: finalJobId,
              notes: leadToEdit?.notes || '',
              clientId: finalData.clientId
          };

          onSave(newLead);
          setIsSaving(false);
          onClose();
      }, 600);
  };

  const handleSaveAttempt = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
        setError(t('modals.AddLeadModal.requiredFieldsError'));
        return;
    }

    // 1. Check for Duplicate Leads
    const leadError = checkLeadDuplicate(formData.email, formData.phone);
    if (leadError) {
        setError(leadError);
        return;
    }

    // 2. Check for Existing Clients (Only on create, to avoid annoyance on edit)
    if (!leadToEdit) {
        const matches = existingClients.filter(c => 
            (c.email && c.email.toLowerCase() === formData.email?.toLowerCase()) ||
            (c.phone && c.phone === formData.phone) ||
            (c.name.toLowerCase() === `${formData.firstName} ${formData.lastName}`.toLowerCase())
        );

        if (matches.length > 0) {
            setMatchingClients(matches);
            setStep('resolve');
            return;
        }
    }

    // 3. Proceed if no conflicts
    executeSave(formData);
  };

  if (!isOpen) return null;

  return (
    <>
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={step === 'resolve' ? t('modals.AddLeadModal.duplicateContactDetected') : (leadToEdit ? t('modals.AddLeadModal.editLead') : t('modals.AddLeadModal.addNewLead'))}
    >
      <div className="space-y-6">
        
        {step === 'form' && (
            <>
                {!leadToEdit && (
                    <button 
                        type="button"
                        onClick={() => setIsClientSelectOpen(true)}
                        className="w-full py-3 flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 font-bold hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400 transition-all shadow-sm group"
                    >
                        <Search className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                        {t('modals.AddLeadModal.selectExistingContact')}
                    </button>
                )}

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <TextInput label={t('modals.AddLeadModal.firstName')} placeholder={t('modals.AddLeadModal.firstNamePlaceholder')} value={formData.firstName || ''} onChange={v => setFormData({...formData, firstName: v})} />
                    <TextInput label={t('modals.AddLeadModal.lastName')} placeholder={t('modals.AddLeadModal.lastNamePlaceholder')} value={formData.lastName || ''} onChange={v => setFormData({...formData, lastName: v})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <PhoneInput label={t('modals.AddLeadModal.phone')} placeholder={t('modals.AddLeadModal.phonePlaceholder')} value={formData.phone || ''} onChange={v => setFormData({...formData, phone: v})} />
                    <TextInput label={t('modals.AddLeadModal.email')} placeholder={t('modals.AddLeadModal.emailPlaceholder')} value={formData.email || ''} onChange={v => setFormData({...formData, email: v})} />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t('modals.AddLeadModal.leadSource')}</label>
                    {isCustomSource ? (
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder={t('modals.AddLeadModal.customSourcePlaceholder')}
                                    value={formData.source || ''}
                                    onChange={(e) => setFormData({...formData, source: e.target.value})}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 transition-all text-gray-900 dark:text-white"
                                />
                            </div>
                            <button 
                                onClick={() => { setIsCustomSource(false); setFormData({...formData, source: ''}); }}
                                className="px-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                title={t('modals.AddLeadModal.cancelCustomInput')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <Select 
                            value={COMMON_SOURCES.includes(formData.source || '') ? formData.source || '' : (formData.source ? 'OTHER_CUSTOM' : '')}
                            onChange={(val) => {
                                if (val === 'OTHER_CUSTOM') {
                                    setIsCustomSource(true);
                                    setFormData({...formData, source: ''});
                                } else {
                                    setFormData({...formData, source: val});
                                }
                            }}
                            options={[
                                { label: t('modals.AddLeadModal.selectSource'), value: '' },
                                ...COMMON_SOURCES.map(s => ({ label: s, value: s })),
                                { label: t('modals.AddLeadModal.existingClient'), value: 'Existing Client' },
                                { label: t('modals.AddLeadModal.otherType'), value: 'OTHER_CUSTOM' }
                            ]}
                        />
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">{t('modals.AddLeadModal.serviceAddress')}</h4>
                    <div className="space-y-4">
                        <TextInput label={t('modals.AddLeadModal.streetAddress')} placeholder={t('modals.AddLeadModal.streetAddressPlaceholder')} value={formData.address || ''} onChange={v => setFormData({...formData, address: v})} />
                        <div className="grid grid-cols-3 gap-3">
                            <TextInput label={t('modals.AddLeadModal.city')} placeholder={t('modals.AddLeadModal.cityPlaceholder')} value={formData.city || ''} onChange={v => setFormData({...formData, city: v})} />
                            <TextInput label={t('modals.AddLeadModal.state')} placeholder={t('modals.AddLeadModal.statePlaceholder')} value={formData.state || ''} onChange={v => setFormData({...formData, state: v})} />
                            <TextInput label={t('modals.AddLeadModal.zip')} placeholder={t('modals.AddLeadModal.zipPlaceholder')} value={formData.zip || ''} onChange={v => setFormData({...formData, zip: v})} />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.AddLeadModal.cancel')}</Button>
                    <Button onClick={handleSaveAttempt} className="flex-1" disabled={isSaving}>
                        {isSaving ? t('modals.AddLeadModal.saving') : (leadToEdit ? t('modals.AddLeadModal.saveChanges') : t('modals.AddLeadModal.createLead'))}
                    </Button>
                </div>
            </>
        )}

        {step === 'resolve' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">{t('modals.AddLeadModal.existingContactsFound')}</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                            {t('modals.AddLeadModal.existingContactsMessage')}
                        </p>
                    </div>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {matchingClients.map(client => (
                        <div key={client.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-500 transition-all flex items-center justify-between group">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white">{client.name}</h4>
                                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{t('modals.AddLeadModal.clientBadge')}</span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                    <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</div>
                                    <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</div>
                                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.address}</div>
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                onClick={() => handleConnectClient(client)}
                                className="ml-4 flex-shrink-0"
                            >
                                <Link2 className="w-4 h-4 mr-1" /> {t('modals.AddLeadModal.connect')}
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={handleCreateNewAnyway}
                        className="w-full py-3 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        {t('modals.AddLeadModal.createAsNewContact')}
                    </button>
                    <button 
                        onClick={() => setStep('form')}
                        className="w-full py-2 text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 uppercase tracking-widest mt-2"
                    >
                        {t('modals.AddLeadModal.backToForm')}
                    </button>
                </div>
            </div>
        )}

      </div>
    </Modal>

    <ClientSelectionModal 
        isOpen={isClientSelectOpen}
        onClose={() => setIsClientSelectOpen(false)}
        onSelect={handleClientSelect}
        clients={existingClients}
    />
    </>
  );
};
