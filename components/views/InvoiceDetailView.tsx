
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Download, Send, CreditCard, Paintbrush, Trash2
} from 'lucide-react';
import { Invoice, PaymentRecord, InvoiceItem } from '../../types';
import { Button } from '../UI';
import { RecordPaymentModal } from '../modals/RecordPaymentModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { SendInvoiceModal } from '../modals/SendInvoiceModal';
import { useTranslation } from '@/i18n/LanguageContext';

interface InvoiceDetailViewProps {
  invoice: Invoice;
  onBack: () => void;
  onRecordPayment: (invoice: Invoice, amount: number, method: PaymentRecord['method'], reference: string) => void;
  onRevertPayment?: (invoice: Invoice, paymentId: string) => void;
  onSendInvoice: (invoice: Invoice) => void;
}

// --- CONTRACTOR BRANDING COMPONENT ---
const ContractorLogo = ({ size = "md", invert = false }: { size?: "sm" | "md" | "lg", invert?: boolean }) => {
    const sizeClasses = {
        sm: "h-8",
        md: "h-10", 
        lg: "h-14"
    };
    
    return (
        <div className={`flex items-center gap-3 select-none ${sizeClasses[size]}`}>
            <div className={`aspect-square h-full rounded-lg flex items-center justify-center shadow-sm ${invert ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'}`}>
                <Paintbrush className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-7 h-7'}`} />
            </div>
            <div className={`flex flex-col justify-center ${invert ? 'text-white' : 'text-gray-900'}`}>
                <span className={`font-black uppercase tracking-tight leading-none ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'}`}>Precision</span>
                <span className={`font-bold uppercase tracking-widest leading-none ${invert ? 'text-gray-300' : 'text-primary-600'} ${size === 'lg' ? 'text-xs' : 'text-[0.5rem]'}`}>Paintworks</span>
            </div>
        </div>
    );
};

export const InvoiceDetailView = ({ invoice, onBack, onRecordPayment, onRevertPayment, onSendInvoice }: InvoiceDetailViewProps) => {
  const { t } = useTranslation();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [paymentToRevert, setPaymentToRevert] = useState<string | null>(null);

  // Helper for static badge colors (non-dark mode responsive) to ensure visibility on white paper
  const getStaticBadgeClasses = (status: string) => {
      switch(status) {
          case 'Paid': return 'bg-green-100 text-green-700 border-green-200';
          case 'Partially Paid': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Sent': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'Overdue': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };

  const handlePaymentRecord = (amount: number, method: PaymentRecord['method'], reference: string) => {
      onRecordPayment(invoice, amount, method, reference);
  };

  const handlePrint = (e: React.MouseEvent) => {
      e.preventDefault();
      setTimeout(() => window.print(), 100);
  };

  const handleConfirmRevert = () => {
      if (paymentToRevert && onRevertPayment) {
          onRevertPayment(invoice, paymentToRevert);
          setPaymentToRevert(null);
      }
  };

  const handleSendSubmit = () => {
      onSendInvoice(invoice);
      setIsSendModalOpen(false);
  };

  // Group items by Area for display
  const groupedItems = useMemo(() => {
    return invoice.items.reduce((acc, item) => {
      const area = item.areaName || 'Additional Items';
      if (!acc[area]) acc[area] = { items: [], total: 0 };
      acc[area].items.push(item);
      acc[area].total += item.amount;
      return acc;
    }, {} as Record<string, { items: InvoiceItem[], total: number }>);
  }, [invoice.items]);

  // Dynamic Totals Calculation to ensure accuracy in preview
  const totals = useMemo(() => {
    const itemsSum = invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const sundriesSum = (invoice.sundries || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    const calcSubtotal = itemsSum + sundriesSum;
    const calcTax = invoice.taxAmount || 0; // Use existing tax amount or calculate based on rate if needed
    const calcTotal = calcSubtotal + calcTax;

    return {
      subtotal: calcSubtotal,
      tax: calcTax,
      total: calcTotal,
      balance: calcTotal - (invoice.amountPaid || 0)
    };
  }, [invoice]);

  const hasGroups = Object.keys(groupedItems).length > 0;

  return (
    <div className="w-full mx-auto p-4 md:p-8 pb-32 animate-in fade-in duration-300 bg-gray-100/50 dark:bg-gray-950 min-h-screen print:bg-white print:p-0 print:pb-0 print:m-0 print:min-h-0">
      <RecordPaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        invoice={{ ...invoice, balanceDue: totals.balance }}
        onRecord={handlePaymentRecord}
      />

      <SendInvoiceModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)} 
        onSend={handleSendSubmit}
        customerEmail={invoice.clientEmail || ''}
        invoiceNumber={invoice.number}
        projectName={invoice.projectName}
      />

      <ConfirmationModal 
        isOpen={!!paymentToRevert} 
        onClose={() => setPaymentToRevert(null)}
        onConfirm={handleConfirmRevert}
        title={t('views.InvoiceDetailView.revertPayment')}
        message={t('views.InvoiceDetailView.revertPaymentMessage')}
        confirmLabel={t('views.InvoiceDetailView.removePayment')}
      />

      {/* Toolbar */}
      <div className="max-w-[8.5in] mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-2 font-bold text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t('views.InvoiceDetailView.backToInvoices')}
        </button>
        <div className="flex gap-3">
            <Button variant="secondary" onClick={handlePrint}>
                <Download className="w-4 h-4 mr-2" /> {t('views.InvoiceDetailView.downloadPdf')}
            </Button>
            
            {invoice.status !== 'Paid' && (
                invoice.status === 'Draft' ? (
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setIsPaymentModalOpen(true)}
                        >
                            <CreditCard className="w-4 h-4 mr-2" /> {t('views.InvoiceDetailView.recordPayment')}
                        </Button>

                        <Button
                            variant="primary"
                            onClick={() => setIsSendModalOpen(true)}
                        >
                            <Send className="w-4 h-4 mr-2" /> {t('views.InvoiceDetailView.sendInvoice')}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setIsSendModalOpen(true)}
                        >
                            <Send className="w-4 h-4 mr-2" /> {t('views.InvoiceDetailView.resendInvoice')}
                        </Button>

                        <Button
                            variant="primary"
                            onClick={() => setIsPaymentModalOpen(true)}
                        >
                            <CreditCard className="w-4 h-4 mr-2" /> {t('views.InvoiceDetailView.recordPayment')}
                        </Button>
                    </>
                )
            )}
        </div>
      </div>

      {/* Invoice Document - Paper Style (Stays White) */}
      <div className="max-w-[8.5in] mx-auto bg-white min-h-[11in] shadow-2xl rounded-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none print:my-0 print:mx-0 flex flex-col">
          
          {/* 1. Centered Title Section */}
          <div className="pt-12 px-12 text-center pb-8">
              <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 font-heading tracking-tight mb-2">
                  {invoice.projectName}
              </h1>
              <p className="text-gray-400 font-medium text-lg">
                  {t('views.InvoiceDetailView.invoiceNumber', { number: invoice.number })}
              </p>
          </div>

          {/* 2. Branding & Balance Row */}
          <div className="px-8 md:px-12 pb-8 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 relative">
              <div className="flex flex-row gap-4 items-center justify-start text-left">
                  <ContractorLogo size="lg" />
                  <div className="flex flex-col items-start ml-2">
                      <div className="text-xs md:text-sm font-medium text-gray-500 space-y-0.5">
                          <p>123 Painter's Lane, Color City, NY</p>
                          <p className="text-gray-400">license #12345678</p>
                      </div>
                  </div>
              </div>

              <div className="flex flex-col items-center md:items-end flex-shrink-0 w-full md:w-auto">
                  <div className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('views.InvoiceDetailView.balanceDue')}</div>
                  <div className="text-4xl font-black text-gray-900 tracking-tighter">
                      ${totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 border ${getStaticBadgeClasses(invoice.status)}`}>
                        {invoice.status}
                      </span>
                  </div>
              </div>
          </div>

          <div className="px-8 md:px-12"><div className="h-px bg-gray-100 w-full"></div></div>

          {/* 3. Info Grid */}
          <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">{t('views.InvoiceDetailView.client')}</h4>
                  <div className="space-y-1">
                      <div className="text-xl font-bold text-gray-900 mb-1">{invoice.clientName}</div>
                      {invoice.clientAddress && <div className="text-sm text-gray-600 font-medium whitespace-pre-line leading-relaxed">{invoice.clientAddress}</div>}
                      <div className="pt-2 space-y-0.5">
                          {invoice.clientEmail && <div className="text-sm text-gray-500">{invoice.clientEmail}</div>}
                          {invoice.clientPhone && <div className="text-sm text-gray-500">{invoice.clientPhone}</div>}
                      </div>
                  </div>
              </div>

              <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">{t('views.InvoiceDetailView.jobSite')}</h4>
                  <div className="space-y-1">
                      {invoice.jobAddress ? (
                          <div className="text-sm text-gray-600 font-medium whitespace-pre-line leading-relaxed">{invoice.jobAddress}</div>
                      ) : (
                          <div className="text-sm text-gray-400 italic">{t('views.InvoiceDetailView.noJobAddress')}</div>
                      )}
                  </div>
              </div>

              <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">{t('views.InvoiceDetailView.dates')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('views.InvoiceDetailView.invoiceDate')}</div>
                          <div className="font-bold text-gray-900">{new Date(invoice.createdDate).toLocaleDateString()}</div>
                      </div>
                      <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('views.InvoiceDetailView.dueDate')}</div>
                          <div className="font-bold text-gray-900">{new Date(invoice.dueDate).toLocaleDateString()}</div>
                      </div>
                  </div>
              </div>
          </div>

          {/* 4. Itemized Tables */}
          <div className="pb-4 min-h-[100px]">
              {hasGroups ? (
                  (Object.entries(groupedItems) as [string, { items: InvoiceItem[], total: number }][]).map(([areaName, group]) => {
                      const isAdditional = areaName === 'Additional Items';
                      
                      return (
                      <div key={areaName} className="mb-8">
                          <div className="px-8 md:px-12 pt-2 pb-2 mb-2 flex items-baseline justify-between border-b-2 border-gray-100">
                              <h3 className="text-lg font-bold text-gray-900">{areaName}</h3>
                              <div className="font-bold text-lg text-gray-900">${group.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                          </div>
                          
                          <table className="w-full text-left text-sm">
                              <thead className="text-gray-400">
                                  <tr>
                                      <th className={`px-8 md:px-12 py-2 font-bold uppercase text-xs pl-8 md:pl-12 ${isAdditional ? '' : 'w-[30%]'}`}>{t('views.InvoiceDetailView.item')}</th>

                                      {!isAdditional && (
                                          <>
                                            <th className="px-4 py-2 font-bold uppercase text-xs text-center">{t('views.InvoiceDetailView.qty')}</th>
                                            <th className="px-4 py-2 font-bold uppercase text-xs text-center">{t('views.InvoiceDetailView.coats')}</th>
                                            <th className="px-4 py-2 font-bold uppercase text-xs w-[30%]">{t('views.InvoiceDetailView.product')}</th>
                                          </>
                                      )}

                                      <th className="px-8 md:px-12 py-2 font-bold uppercase text-xs text-right pr-8 md:pr-12">{t('views.InvoiceDetailView.price')}</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 border-b border-gray-50">
                                  {group.items.map((item, idx) => (
                                      <tr key={item.id || idx}>
                                          <td className="px-8 md:px-12 py-4 align-top pl-8 md:pl-12">
                                              <div className="font-bold text-gray-800 text-base">{item.description}</div>
                                          </td>
                                          
                                          {!isAdditional && (
                                              <>
                                                <td className="px-4 py-4 align-top text-center">
                                                    {item.quantity ? (
                                                        <div>
                                                            <span className="font-bold text-gray-700 text-base">{item.quantity}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">{item.unit}</span>
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-4 align-top text-center">
                                                    {item.coats ? <span className="font-medium text-gray-700">{item.coats}</span> : '-'}
                                                </td>
                                                <td className="px-4 py-4 align-top">
                                                    {item.product ? (
                                                        <div>
                                                            <div className="font-bold text-gray-900">{item.product}</div>
                                                            <div className="text-xs text-gray-500">{item.productDetails}</div>
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                              </>
                                          )}

                                          <td className="px-8 md:px-12 py-4 align-top text-right pr-8 md:pr-12">
                                              <span className="font-bold text-gray-900 text-base">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  )})
              ) : (
                  <div className="px-8 md:px-12 py-8 text-center text-gray-400 italic">{t('views.InvoiceDetailView.noItemsAvailable')}</div>
              )}
          </div>

          {/* 5. Paint Colors Schedule */}
          {invoice.items.some(i => i.productDetails) && (
              <div className="px-8 md:px-12 pt-4 pb-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-primary-500 inline-block pb-1">{t('views.InvoiceDetailView.paintColors')}</h3>
                  <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                                <tr>
                                    <th className="px-6 py-3">{t('views.InvoiceDetailView.colorHash')}</th>
                                    <th className="px-6 py-3">{t('views.InvoiceDetailView.productFinish')}</th>
                                    <th className="px-6 py-3">{t('views.InvoiceDetailView.surfaces')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Array.from(new Set(invoice.items.map(i => i.productDetails).filter(Boolean))).map((details, idx) => {
                                    const matchingItems = invoice.items.filter(i => i.productDetails === details);
                                    const colorCode = details?.split('• #')[1] || details?.replace('#', '');
                                    const firstItem = matchingItems[0];
                                    
                                    return (
                                        <tr key={idx} className="bg-white">
                                            <td className="px-6 py-4">
                                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-700 border border-gray-200">{colorCode}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{firstItem.product}</div>
                                                <div className="text-[10px] text-gray-500 uppercase font-medium">{details?.split(' • ')[0]}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {matchingItems.map((mi, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                            {mi.areaName} - {mi.description}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                  </div>
              </div>
          )}

          {/* 6. Totals Summary */}
          <div className="bg-gray-50 border-t border-gray-200 p-8 md:p-12 break-inside-avoid mt-auto rounded-b-xl">
              <div className="flex justify-end">
                  <div className="w-full md:w-1/2 lg:w-1/3 space-y-4">
                      <div className="flex justify-between items-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                          <span>{t('views.InvoiceDetailView.subtotal')}</span>
                          <span className="text-gray-900 text-sm font-bold">${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      {totals.tax > 0 && (
                        <div className="flex justify-between items-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                            <span>{t('views.InvoiceDetailView.tax')}</span>
                            <span className="text-gray-900 text-sm font-bold">${totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      <div className="h-px bg-gray-200 my-2"></div>
                      
                      <div className="flex justify-between items-end pt-2">
                          <span className="font-black text-gray-900 text-lg uppercase tracking-widest text-[10px] pb-1">{t('views.InvoiceDetailView.total')}</span>
                          <span className="font-black text-primary-600 text-4xl tracking-tighter">
                              ${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                      </div>
                  </div>
              </div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-gray-200">
                  <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('views.InvoiceDetailView.termsAndConditions')}</h4>
                      <p className="text-[11px] text-gray-500 whitespace-pre-wrap leading-relaxed">
                          {invoice.terms || t('views.InvoiceDetailView.standardTerms')}
                      </p>
                  </div>
                  <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-12">{t('views.InvoiceDetailView.acceptance')}</h4>
                      <div className="border-b border-gray-300 mb-2"></div>
                      <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <span>{t('views.InvoiceDetailView.signature')}</span>
                          <span>{t('views.InvoiceDetailView.date')}</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Payment History - Adapted for Dark Mode UI */}
      {invoice.payments.length > 0 && (
          <div className="max-w-[8.5in] mx-auto bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mt-6 print:break-inside-avoid">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-gray-400" /> {t('views.InvoiceDetailView.paymentHistory')}
                  </h4>
              </div>
              <div className="p-0">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                          <tr>
                              <th className="px-8 py-3 font-bold uppercase text-xs w-1/3">{t('views.InvoiceDetailView.date')}</th>
                              <th className="px-8 py-3 font-bold uppercase text-xs w-1/3">{t('views.InvoiceDetailView.method')}</th>
                              <th className="px-8 py-3 font-bold uppercase text-xs text-right pr-12">{t('views.InvoiceDetailView.amount')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {invoice.payments.map((payment) => (
                              <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                  <td className="px-8 py-4 font-medium text-gray-900 dark:text-white">
                                      {new Date(payment.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-8 py-4 text-gray-600 dark:text-gray-300">
                                      <div className="flex flex-col">
                                          <span className="font-bold">{payment.method}</span>
                                          {payment.reference && <span className="text-xs text-gray-400 dark:text-gray-500">{t('views.InvoiceDetailView.ref', { reference: payment.reference })}</span>}
                                      </div>
                                  </td>
                                  <td className="px-8 py-4 text-right pr-12 relative">
                                      <span className="font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded inline-block">
                                          ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                      {onRevertPayment && (
                                          <div className="absolute top-1/2 -translate-y-1/2 right-2">
                                              <button 
                                                  onClick={() => setPaymentToRevert(payment.id)}
                                                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100"
                                                  title={t('views.InvoiceDetailView.revertPayment')}
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};
