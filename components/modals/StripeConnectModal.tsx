
import React, { useState } from 'react';
import { Modal, Button } from '../UI';
import { CreditCard, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface StripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
}

export const StripeConnectModal = ({ isOpen, onClose, onConnect }: StripeConnectModalProps) => {
  const { t } = useTranslation();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate API handshake
    setTimeout(() => {
      setIsConnecting(false);
      onConnect();
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.StripeConnectModal.connectPaymentProcessor')}>
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        <div className="w-16 h-16 bg-[#635BFF] rounded-2xl flex items-center justify-center shadow-lg shadow-[#635BFF]/30 mb-6">
           {/* Stripe-like generic icon since we don't use brand logos directly */}
           <CreditCard className="w-8 h-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading mb-3">{t('modals.StripeConnectModal.setupStripePayments')}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm leading-relaxed">
          {t('modals.StripeConnectModal.description')}
        </p>

        <div className="w-full space-y-3 mb-8 text-left bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('modals.StripeConnectModal.featureCards')}</span>
            </div>
            <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('modals.StripeConnectModal.featureReceipts')}</span>
            </div>
            <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('modals.StripeConnectModal.featureSecurity')}</span>
            </div>
        </div>

        <div className="w-full flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">
                {t('modals.StripeConnectModal.cancel')}
            </Button>
            <button 
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex-[2] bg-[#635BFF] hover:bg-[#534be0] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-[#635BFF]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isConnecting ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" /> {t('modals.StripeConnectModal.connecting')}
                    </>
                ) : (
                    <>
                        {t('modals.StripeConnectModal.connectStripe')} <ArrowRight className="w-5 h-5" />
                    </>
                )}
            </button>
        </div>
        
        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <ShieldCheck className="w-3 h-3" />
            <span>{t('modals.StripeConnectModal.secureConnection')}</span>
        </div>
      </div>
    </Modal>
  );
};
