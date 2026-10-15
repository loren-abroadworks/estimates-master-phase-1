
import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, MessageSquare, Check } from 'lucide-react';
import { Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

interface AcceptPackage { id: string; name: string; total: number; }

export const AcceptEstimateModal = ({
  isOpen, onClose, total, terms, onAccept, onEdit, packages, defaultPackageId,
}: {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  terms: string;
  onAccept: (packageId?: string) => void;
  onEdit: () => void;
  packages?: AcceptPackage[];
  defaultPackageId?: string | null;
}) => {
  const { t } = useTranslation();
  const hasChooser = !!packages && packages.length > 1;
  const [chosenId, setChosenId] = useState<string | null>(defaultPackageId ?? null);

  useEffect(() => {
    if (isOpen) setChosenId(defaultPackageId ?? null);
  }, [isOpen, defaultPackageId]);

  if (!isOpen) return null;

  const chosenTotal = hasChooser ? (packages!.find(p => p.id === chosenId)?.total ?? total) : total;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col animate-in zoom-in-95 duration-200 relative">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('modals.AcceptEstimateModal.acceptEstimate')}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="p-8 space-y-8">
            {hasChooser && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('modals.AcceptEstimateModal.choosePackage')}</div>
                <div className="grid gap-3">
                  {packages!.map((p) => {
                    const isChosen = p.id === chosenId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={isChosen}
                        aria-label={p.name}
                        onClick={() => setChosenId(p.id)}
                        className={`flex items-center justify-between rounded-xl border-2 px-5 py-4 transition-all ${
                          isChosen ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 ${isChosen ? 'border-primary-600' : 'border-gray-300'}`}>
                            {isChosen && <span className="w-2.5 h-2.5 rounded-full bg-primary-600" />}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white">{p.name}</span>
                        </span>
                        <span className="font-black text-gray-900 dark:text-white">${p.total.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Banner */}
            <div className="bg-primary-50/50 dark:bg-primary-900/20 rounded-2xl p-6 border border-primary-100 dark:border-primary-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('modals.AcceptEstimateModal.totalAgreedPrice')}</div>
                    <div data-testid="accept-total" className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">${chosenTotal.toFixed(2)}</div>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                    {t('modals.AcceptEstimateModal.pendingAcceptance')}
                </div>
            </div>

            {/* Terms */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 bg-white dark:bg-gray-800 shadow-sm">
                <div className="text-sm font-bold text-gray-900 dark:text-white mb-2">{t('modals.AcceptEstimateModal.paymentDepositTerms')}</div>
                <div className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {terms || t('modals.AcceptEstimateModal.standardPaymentTerms')}
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">{t('modals.AcceptEstimateModal.fullName')}</label>
                    <input
                        type="text"
                        placeholder={t('modals.AcceptEstimateModal.fullNamePlaceholder')}
                        className="w-full px-5 py-4 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl text-lg outline-none focus:ring-4 focus:ring-primary-400/20 focus:border-primary-400 transition-all placeholder-gray-300 dark:placeholder-gray-600 text-gray-900 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">{t('modals.AcceptEstimateModal.eSignature')}</label>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl h-48 bg-white dark:bg-gray-900 relative cursor-crosshair hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-inner flex items-end justify-end p-4">
                        <div className="text-xs text-gray-300 dark:text-gray-600 font-bold pointer-events-none select-none">{t('modals.AcceptEstimateModal.signAbove')}</div>
                    </div>
                </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4 pt-2">
                {t('modals.AcceptEstimateModal.signingAgreement')}
            </p>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col sm:flex-row items-center gap-4 justify-between sticky bottom-0 z-10">
             <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="secondary" onClick={onEdit} className="flex-1 sm:flex-none">
                    <ArrowLeft className="w-4 h-4" /> {t('modals.AcceptEstimateModal.backToEdit')}
                </Button>
                <Button variant="secondary" className="flex-1 sm:flex-none">
                    <MessageSquare className="w-4 h-4" /> {t('modals.AcceptEstimateModal.contactUs')}
                </Button>
             </div>
             <Button onClick={() => onAccept(hasChooser ? (chosenId ?? undefined) : undefined)} size="lg" className="w-full sm:w-auto shadow-xl shadow-primary-500/30 rounded-full">
                <Check className="w-5 h-5" /> {t('modals.AcceptEstimateModal.acceptEstimate')}
             </Button>
        </div>
      </div>
    </div>
  );
};
