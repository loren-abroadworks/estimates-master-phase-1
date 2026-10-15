
import React, { useState } from 'react';
import { Search, MapPin, Mail, Phone, User, Briefcase } from 'lucide-react';
import { Modal } from '../UI';
import { MOCK_CLIENTS, MOCK_LEADS } from '../../data/mockData';
import { Client, Lead } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface SearchableItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: 'Client' | 'Lead';
  original: Client | Lead;
}

export const ClientSelectionModal = ({ 
  isOpen, 
  onClose, 
  onSelect,
  clients,
  leads
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSelect: (item: Client | Lead) => void,
  clients?: Client[],
  leads?: Lead[]
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const [term, setTerm] = useState("");
  
  // Normalize data for unified search
  const sourceClients = clients || MOCK_CLIENTS;
  const sourceLeads = leads || MOCK_LEADS;

  const normalizedItems: SearchableItem[] = [
      ...sourceClients.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address,
          type: 'Client' as const,
          original: c
      })),
      ...sourceLeads.map(l => ({
          id: l.id,
          name: `${l.firstName} ${l.lastName}`,
          email: l.email,
          phone: l.phone,
          address: l.address,
          type: 'Lead' as const,
          original: l
      }))
  ];
  
  const filtered = normalizedItems.filter(item => 
    item.name.toLowerCase().includes(term.toLowerCase()) || 
    item.email.toLowerCase().includes(term.toLowerCase()) || 
    item.phone.includes(term)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.ClientSelectionModal.title')}>
      <div className="space-y-4">
        <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder={t('modals.ClientSelectionModal.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-400 dark:border-gray-500 rounded-lg text-sm focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 outline-none transition-all shadow-sm"
              value={term}
              onChange={e => setTerm(e.target.value)}
              autoFocus
            />
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {filtered.map(item => (
            <div key={`${item.type}-${item.id}`} onClick={() => onSelect(item.original)} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md cursor-pointer transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{item.name}</h4>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${item.type === 'Client' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800'}`}>
                        {item.type}
                    </span>
                </div>
                {item.type === 'Client' && (item.original as Client).starred && <div className="text-amber-400"><svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5">
                <div className="flex items-center gap-2">
                   <MapPin className="w-3.5 h-3.5 text-gray-400" />
                   <span className="truncate">{item.address || t('modals.ClientSelectionModal.noAddress')}</span>
                </div>
                <div className="flex justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                     <Mail className="w-3.5 h-3.5 text-gray-400" />
                     <span className="truncate">{item.email}</span>
                  </div>
                   <div className="flex items-center gap-2">
                     <Phone className="w-3.5 h-3.5 text-gray-400" />
                     <span>{item.phone}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">{t('modals.ClientSelectionModal.noResults', { term })}</p>}
        </div>
      </div>
    </Modal>
  );
};
