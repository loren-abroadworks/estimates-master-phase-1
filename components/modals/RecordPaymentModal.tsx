
import React, { useState } from 'react';
import { Modal, NumberInput, TextInput, Select, Button } from '../UI';
import { PaymentRecord, Invoice } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onRecord: (amount: number, method: PaymentRecord['method'], reference: string) => void;
}

export const RecordPaymentModal = ({ isOpen, onClose, invoice, onRecord }: RecordPaymentModalProps) => {
  const { t } = useTranslation();
  // Initialize with rounded value to avoid long decimals
  const [amount, setAmount] = useState(Number(invoice.balanceDue.toFixed(2)));
  const [method, setMethod] = useState<PaymentRecord['method']>('Check');
  const [reference, setReference] = useState('');

  const handleSave = () => {
    if (amount <= 0) return;
    onRecord(amount, method, reference);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.RecordPaymentModal.recordPayment')}>
      <div className="space-y-6">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 font-bold text-sm">{t('modals.RecordPaymentModal.balanceDue')}</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">${invoice.balanceDue.toFixed(2)}</span>
        </div>

        <NumberInput
            label={t('modals.RecordPaymentModal.paymentAmount')}
            value={amount}
            onChange={setAmount} 
            className="text-lg font-bold"
        />

        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t('modals.RecordPaymentModal.paymentMethod')}</label>
                <Select 
                    value={method} 
                    onChange={(v) => setMethod(v as any)}
                    options={[
                        { label: t('modals.RecordPaymentModal.methodCheck'), value: 'Check' },
                        { label: t('modals.RecordPaymentModal.methodCash'), value: 'Cash' },
                        { label: t('modals.RecordPaymentModal.methodBankTransfer'), value: 'Bank Transfer' },
                        { label: t('modals.RecordPaymentModal.methodCreditCard'), value: 'Credit Card' },
                        { label: t('modals.RecordPaymentModal.methodOther'), value: 'Other' }
                    ]}
                />
            </div>
            <TextInput
                label={t('modals.RecordPaymentModal.referenceLabel')}
                placeholder={t('modals.RecordPaymentModal.referencePlaceholder')}
                value={reference}
                onChange={setReference} 
            />
        </div>

        <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.RecordPaymentModal.cancel')}</Button>
            <Button onClick={handleSave} className="flex-1">{t('modals.RecordPaymentModal.recordPayment')}</Button>
        </div>
      </div>
    </Modal>
  );
};
