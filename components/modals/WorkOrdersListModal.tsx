
import React from 'react';
import { Modal, Button } from '../UI';
import { ArrowUpRight, Calendar, User } from 'lucide-react';
import { WorkOrder } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface WorkOrdersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  workOrders: Partial<WorkOrder>[];
  onViewWorkOrder: (id: string) => void;
}

export const WorkOrdersListModal = ({ isOpen, onClose, title, workOrders, onViewWorkOrder }: WorkOrdersListModalProps) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pending Deposit': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Scheduled': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'In Progress': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'Completed': return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {workOrders.map((wo) => (
          <div key={wo.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">{wo.jobName}</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(wo.status || '')}`}>
                {wo.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> {wo.customerName}
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /> {wo.startDate ? new Date(wo.startDate).toLocaleDateString() : t('modals.WorkOrdersListModal.tbd')}
                </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => onViewWorkOrder(wo.id || '')}>
                {t('modals.WorkOrdersListModal.viewFullOrder')} <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))}
        
        {workOrders.length === 0 && (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 font-medium">{t('modals.WorkOrdersListModal.noWorkOrders')}</p>
          </div>
        )}
        
        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="ghost">{t('modals.WorkOrdersListModal.close')}</Button>
        </div>
      </div>
    </Modal>
  );
};
