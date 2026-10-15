
import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput, TextArea } from '../UI';
import { Send, Mail, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface SendGenericEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { to: string; subject: string; message: string }) => void;
  type: 'message' | 'thank-you';
  customerEmail: string;
  customerName: string;
}

export const SendGenericEmailModal = ({ 
  isOpen, 
  onClose, 
  onSend, 
  type,
  customerEmail,
  customerName
}: SendGenericEmailModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (type === 'thank-you') {
          setFormData({
            to: customerEmail,
            subject: t('modals.SendGenericEmailModal.thankYouSubject'),
            message: t('modals.SendGenericEmailModal.thankYouBody', { customerName })
          });
      } else {
          setFormData({
            to: customerEmail,
            subject: t('modals.SendGenericEmailModal.messageSubject'),
            message: t('modals.SendGenericEmailModal.messageBody', { customerName })
          });
      }
    }
  }, [isOpen, type, customerEmail, customerName]);

  const handleSend = () => {
    onSend(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={type === 'thank-you' ? t('modals.SendGenericEmailModal.titleThankYou') : t('modals.SendGenericEmailModal.titleMessage')}>
      <div className="space-y-6">
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <TextInput
                label={t('modals.SendGenericEmailModal.labelTo')}
                value={formData.to}
                onChange={(v) => setFormData({...formData, to: v})}
            />

            <TextInput
                label={t('modals.SendGenericEmailModal.labelSubject')}
                value={formData.subject}
                onChange={(v) => setFormData({...formData, subject: v})}
            />

            <TextArea
                label={t('modals.SendGenericEmailModal.labelMessage')}
                value={formData.message}
                onChange={(v) => setFormData({...formData, message: v})}
                rows={8}
            />

            {type === 'thank-you' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-green-800 dark:text-green-300">{t('modals.SendGenericEmailModal.nextStepHeading')}</h4>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1 leading-relaxed">
                            {t('modals.SendGenericEmailModal.nextStepBody')}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.SendGenericEmailModal.cancel')}</Button>
                <Button onClick={handleSend} className="flex-[2] shadow-lg shadow-primary-500/20">
                    <Send className="w-4 h-4 mr-2" /> {t('modals.SendGenericEmailModal.sendEmail')}
                </Button>
            </div>
        </div>
      </div>
    </Modal>
  );
};
