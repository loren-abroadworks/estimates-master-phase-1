
import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput, TextArea } from '../UI';
import { AlertCircle, Eye, Send, Bold, Italic, List, Link as LinkIcon, Mail, MessageSquare } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface SendEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { to: string; subject: string; message: string; sendSms: boolean }) => void;
  onPreview: () => void;
  customerEmail: string;
  projectName: string;
  hasViewedPreview: boolean;
}

export const SendEstimateModal = ({ 
  isOpen, 
  onClose, 
  onSend, 
  onPreview,
  customerEmail, 
  projectName,
  hasViewedPreview 
}: SendEstimateModalProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'check' | 'compose'>('check');
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    message: '',
    sendSms: false
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        to: customerEmail,
        subject: t('modals.SendEstimateModal.defaultSubject', { projectName }),
        message: t('modals.SendEstimateModal.defaultMessage'),
        sendSms: false
      });
      // If they haven't viewed preview, show check step. Otherwise go straight to compose.
      setStep(hasViewedPreview ? 'compose' : 'check');
    }
  }, [isOpen, customerEmail, projectName, hasViewedPreview]);

  const handleSend = () => {
    onSend(formData);
    onClose();
  };

  const handlePreviewClick = () => {
      onClose();
      onPreview();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 'check' ? t('modals.SendEstimateModal.titleReview') : t('modals.SendEstimateModal.titleSend')}>
      <div className="space-y-6">
        
        {/* STEP 1: SAFETY CHECK */}
        {step === 'check' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4">
                        <Eye className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('modals.SendEstimateModal.reviewHeading')}</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 max-w-sm">
                        {t('modals.SendEstimateModal.reviewBody')}
                    </p>

                    <div className="flex flex-col w-full gap-3">
                        <Button onClick={handlePreviewClick} className="w-full justify-center shadow-lg shadow-primary-500/20">
                            <Eye className="w-4 h-4 mr-2" /> {t('modals.SendEstimateModal.previewButton')}
                        </Button>
                        <button
                            onClick={() => setStep('compose')}
                            className="text-gray-500 dark:text-gray-400 font-medium text-sm hover:text-gray-800 dark:hover:text-gray-200 transition-colors py-2"
                        >
                            {t('modals.SendEstimateModal.skipAndSend')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* STEP 2: COMPOSE */}
        {step === 'compose' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <TextInput
                    label={t('modals.SendEstimateModal.toLabel')}
                    value={formData.to}
                    onChange={(v) => setFormData({...formData, to: v})}
                    placeholder={t('modals.SendEstimateModal.toPlaceholder')}
                />

                <TextInput
                    label={t('modals.SendEstimateModal.subjectLabel')}
                    value={formData.subject}
                    onChange={(v) => setFormData({...formData, subject: v})}
                />

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('modals.SendEstimateModal.messageLabel')}</label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.sendSms}
                                onChange={(e) => setFormData({...formData, sendSms: e.target.checked})}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 accent-primary-600"
                            />
                            <div className="flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{t('modals.SendEstimateModal.alsoSendViaSms')}</span>
                            </div>
                        </label>
                    </div>
                    
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-400/20 focus-within:border-primary-400 transition-all bg-white dark:bg-gray-900">
                        {/* Rich Text Toolbar Simulation */}
                        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 flex gap-1">
                            <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"><Bold className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"><Italic className="w-3.5 h-3.5" /></button>
                            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1 my-auto"></div>
                            <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"><List className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"><LinkIcon className="w-3.5 h-3.5" /></button>
                        </div>
                        <textarea 
                            className="w-full p-4 outline-none text-sm text-gray-700 dark:text-gray-200 min-h-[150px] resize-none bg-white dark:bg-gray-900"
                            value={formData.message}
                            onChange={(e) => setFormData({...formData, message: e.target.value})}
                        />
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg mt-0.5">
                        <Mail className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200">{t('modals.SendEstimateModal.secureLinkHeading')}</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1 leading-relaxed">
                            {t('modals.SendEstimateModal.secureLinkBody', { channel: formData.sendSms ? t('modals.SendEstimateModal.andSms') : '' })}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">{t('modals.SendEstimateModal.cancel')}</Button>
                    <Button onClick={handleSend} className="flex-[2] shadow-lg shadow-primary-500/20">
                        <Send className="w-4 h-4 mr-2" /> {t('modals.SendEstimateModal.sendEstimate')}
                    </Button>
                </div>
            </div>
        )}
      </div>
    </Modal>
  );
};
