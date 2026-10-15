
import React, { useState } from 'react';
import { CreditCard, DollarSign, Wallet, Percent, CheckCircle2, X, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Card, InputGroup, NumberInput, Toggle, Button } from '../UI';
import { GlobalSettings, FinancialModelSettings } from '../../types';
import { StripeConnectModal } from '../modals/StripeConnectModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { DEFAULT_SETTINGS } from '../../constants';
import { useTranslation } from '@/i18n/LanguageContext';

interface PaymentConfigViewProps {
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

export const PaymentConfigView = ({ settings, setSettings }: PaymentConfigViewProps) => {
  const { t } = useTranslation();
  const paymentSettings = settings.paymentSettings;
  const financialModel = settings.financialModel || DEFAULT_SETTINGS.financialModel;
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const updatePaymentSettings = (field: keyof typeof paymentSettings, value: any) => {
    setSettings({
      ...settings,
      paymentSettings: {
        ...paymentSettings,
        [field]: value
      }
    });
  };

  const updateFinancialModel = (field: keyof FinancialModelSettings, value: any) => {
    setSettings({
      ...settings,
      financialModel: {
        ...financialModel,
        [field]: value
      }
    });
  };

  const handleDisconnectClick = () => {
      setIsDisconnectModalOpen(true);
  };

  const handleConfirmDisconnect = () => {
      setIsDisconnecting(true);
      // Simulate API disconnection delay for better UX
      setTimeout(() => {
        updatePaymentSettings('stripeConnected', false);
        setIsDisconnecting(false);
      }, 1000);
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <StripeConnectModal 
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={() => updatePaymentSettings('stripeConnected', true)}
      />

      <ConfirmationModal 
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={handleConfirmDisconnect}
        title={t('settings.PaymentConfigView.disconnectStripeTitle')}
        message={t('settings.PaymentConfigView.disconnectStripeMessage')}
        confirmLabel={t('settings.PaymentConfigView.disconnect')}
        cancelLabel={t('settings.PaymentConfigView.cancel')}
      />

      <div className="mb-8 md:mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.PaymentConfigView.financialSettings')}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.PaymentConfigView.financialSettingsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Deposit Rules */}
        <Card className="p-6 md:p-10 shadow-lg border-0 h-full bg-white dark:bg-gray-800">
           <div className="border-b border-gray-100 dark:border-gray-700 pb-4 md:pb-6 mb-6">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading flex items-center gap-3">
                {t('settings.PaymentConfigView.depositRules')}
             </h3>
             <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t('settings.PaymentConfigView.depositRulesSubtitle')}</p>
           </div>
           
           <div className="space-y-6">
             <InputGroup label={t('settings.PaymentConfigView.defaultDepositLabel')}>
                <div className="relative">
                  <NumberInput
                    value={paymentSettings.defaultDepositPercentage}
                    onChange={(v) => updatePaymentSettings('defaultDepositPercentage', v)}
                    className="pr-12 font-bold text-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    {t('settings.PaymentConfigView.defaultDepositHelper')}
                </p>
             </InputGroup>
           </div>
        </Card>

        {/* Miscellaneous Expenses Configuration */}
        <Card className="p-6 md:p-10 shadow-lg border-0 h-full bg-white dark:bg-gray-800">
           <div className="border-b border-gray-100 dark:border-gray-700 pb-4 md:pb-6 mb-6">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading flex items-center gap-3">
               {t('settings.PaymentConfigView.miscLineItems')}
             </h3>
             <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t('settings.PaymentConfigView.miscLineItemsSubtitle')}</p>
           </div>

           <div className="space-y-6">
             <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                    <div className="font-bold text-gray-900 dark:text-white">{t('settings.PaymentConfigView.applyProfitToMisc')}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('settings.PaymentConfigView.applyProfitToMiscDesc')}</div>
                </div>
                <Toggle 
                    checked={financialModel.applyProfitToMisc || false} 
                    onChange={(v) => updateFinancialModel('applyProfitToMisc', v)} 
                />
             </div>

             {financialModel.applyProfitToMisc && (
                 <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                     <InputGroup label={t('settings.PaymentConfigView.miscProfitMarginLabel')}>
                        <div className="relative">
                          <NumberInput
                            value={financialModel.miscExpenseProfit || 0}
                            onChange={(v) => updateFinancialModel('miscExpenseProfit', v)}
                            className="pr-12 font-bold text-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                        </div>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                            {t('settings.PaymentConfigView.miscProfitMarginHelper')}
                        </p>
                     </InputGroup>
                 </div>
             )}
           </div>
        </Card>

        {/* Payment Methods */}
        <Card className="p-6 md:p-10 shadow-lg border-0 h-full col-span-full bg-white dark:bg-gray-800">
           <div className="border-b border-gray-100 dark:border-gray-700 pb-4 md:pb-6 mb-6">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading flex items-center gap-3">
               {t('settings.PaymentConfigView.paymentMethods')}
             </h3>
             <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{t('settings.PaymentConfigView.paymentMethodsSubtitle')}</p>
           </div>

           <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div>
                        <div className="font-bold text-gray-900 dark:text-white">{t('settings.PaymentConfigView.acceptBankTransfers')}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{t('settings.PaymentConfigView.acceptBankTransfersDesc')}</div>
                    </div>
                    <Toggle 
                        checked={paymentSettings.acceptBankTransfer} 
                        onChange={(v) => updatePaymentSettings('acceptBankTransfer', v)} 
                    />
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">{t('settings.PaymentConfigView.paymentProcessor')}</h4>
                    <div className={`p-5 rounded-2xl border transition-all ${paymentSettings.stripeConnected ? 'bg-white dark:bg-gray-900 border-[#635BFF]/30 shadow-sm ring-1 ring-[#635BFF]/10' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentSettings.stripeConnected ? 'bg-[#635BFF] text-white shadow-lg shadow-[#635BFF]/30' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'}`}>
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white text-lg">Stripe</div>
                                    <div className={`text-xs font-bold uppercase tracking-wider ${paymentSettings.stripeConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {paymentSettings.stripeConnected ? t('settings.PaymentConfigView.connected') : t('settings.PaymentConfigView.notConnected')}
                                    </div>
                                </div>
                            </div>
                            {paymentSettings.stripeConnected && (
                                <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-1 rounded-full">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            )}
                        </div>

                        {paymentSettings.stripeConnected ? (
                            <div className="space-y-4">
                                <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="shrink-0 text-gray-500 dark:text-gray-400">{t('settings.PaymentConfigView.accountId')}</span>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white break-all">acct_123456789</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button variant="secondary" className="flex-1 text-sm h-10 bg-white dark:bg-gray-800 justify-center border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200" title={t('settings.PaymentConfigView.refreshConnection')}>
                                        <RefreshCw className="w-4 h-4 mr-2" /> {t('settings.PaymentConfigView.sync')}
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        className="flex-1 text-sm h-10 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 bg-white dark:bg-gray-800 justify-center" 
                                        onClick={handleDisconnectClick}
                                        disabled={isDisconnecting}
                                    >
                                        {isDisconnecting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('settings.PaymentConfigView.disconnecting')}
                                            </>
                                        ) : (
                                            t('settings.PaymentConfigView.disconnect')
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.PaymentConfigView.connectStripeDesc')}</p>
                                <button
                                    onClick={() => setIsConnectModalOpen(true)}
                                    className="w-full py-3 bg-[#635BFF] hover:bg-[#534be0] text-white font-bold rounded-xl shadow-lg shadow-[#635BFF]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    {t('settings.PaymentConfigView.connectStripe')} <ExternalLink className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
           </div>
        </Card>
      </div>
    </div>
  );
};
