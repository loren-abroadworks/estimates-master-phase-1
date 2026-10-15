
import React from 'react';
import { Modal, Button } from '../UI';
import { ArrowUpRight, Calendar, User, FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface EstimateSummary {
  id: string;
  number: string;
  name: string;
  client: string;
  date: string;
  total: number;
  status: string;
  type: string;
}

interface EstimatesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  estimates: EstimateSummary[];
  onViewEstimate: (id: string) => void;
}

export const EstimatesListModal = ({ isOpen, onClose, title, estimates, onViewEstimate }: EstimatesListModalProps) => {
  const { t } = useTranslation();
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600';
      case 'Sent': return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Approved': return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'Paid': return 'bg-green-100 dark:bg-green-800/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
      case 'Archived': return 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {estimates.map((est) => (
          <div key={est.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{est.name}</h4>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{est.number}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(est.status)}`}>
                {est.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> {est.client}
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> {new Date(est.date).toLocaleDateString()}
                </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-gray-700">
                <div className="font-bold text-gray-900 dark:text-white">${est.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <Button size="sm" variant="secondary" onClick={() => onViewEstimate(est.id)}>
                    {t('modals.EstimatesListModal.viewEstimate')} <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
            </div>
          </div>
        ))}
        
        {estimates.length === 0 && (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400 dark:text-gray-500">
                <FileText className="w-6 h-6" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">{t('modals.EstimatesListModal.noEstimatesFound')}</p>
          </div>
        )}
        
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="ghost">{t('modals.EstimatesListModal.close')}</Button>
        </div>
      </div>
    </Modal>
  );
};
