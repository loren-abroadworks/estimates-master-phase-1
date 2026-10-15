
import React, { useState } from 'react';
import {
  Check, Shield, Zap, Star, Crown, UserCheck,
  Settings, PenTool, Layout, Layers, CreditCard, Sparkles,
  ArrowRight, Info, Calendar, ArrowRightLeft, Download, FileText,
  Clock, ShieldCheck, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import { Card, Button, Badge, Modal, TextInput } from '../UI';
import { Typography } from '../../theme/designSystem';
import { useTranslation } from '@/i18n/LanguageContext';

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  isPremium?: boolean;
  isPopular?: boolean;
  accentColor: string;
  icon: React.ElementType;
}

const TIERS: SubscriptionTier[] = [
  {
    id: 'silver',
    name: 'Silver',
    price: '$49',
    description: 'Essential access for growing businesses.',
    accentColor: 'text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800',
    icon: Shield,
    features: [
      'Access to software platform',
      'Unlimited Estimates',
      'Client Management',
      'Mobile App Access'
    ]
  },
  {
    id: 'gold',
    name: 'Gold',
    price: '$99',
    description: 'Standard tools with pre-loaded intelligence.',
    accentColor: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    icon: Star,
    isPopular: true,
    features: [
      'Access to software platform',
      'Production rates preloaded',
      'Advanced Reporting',
      'Job Scheduling',
      'Email & SMS Notifications'
    ]
  },
  {
    id: 'platinum',
    name: 'Platinum',
    price: '$249',
    description: 'The ultimate Done For You experience.',
    accentColor: 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800',
    icon: Crown,
    features: [
      'Access to software platform',
      'Dedicated rep to customize & set up',
      'We enter your production rates',
      'We enter your products',
      'Custom template creation',
      'Full presentation setup'
    ]
  },
  {
    id: 'founders',
    name: 'Founders Club',
    price: '$29',
    description: 'A legacy plan for our earliest partners.',
    accentColor: 'text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700',
    icon: Sparkles,
    isPremium: true,
    features: [
      'Locked in rate for life',
      '20% off all future purchases',
      'Early access to new features',
      'Founders badge on proposals'
    ]
  }
];

const ALA_CARTE = [
  { id: 'ac1', title: 'Production Rate Entry', desc: 'We take your spreadsheet and build your entire efficiency library.', price: '$199', icon: Zap },
  { id: 'ac2', title: 'Product Catalog Setup', desc: 'Full inventory entry with brands, coverage, and optimized pricing.', price: '$149', icon: Layers },
  { id: 'ac3', title: 'Custom Template Design', desc: 'Creation of 5 project templates matched to your specific workflow.', price: '$299', icon: Layout },
  { id: 'ac4', title: 'Presentation Polish', desc: 'We set up your branding, portfolio, and artisans story pages.', price: '$199', icon: PenTool },
];

const ACTIVE_DISCOUNT = { percentOff: 0.30, label: '30% off', until: 'July 2026' };
const NEXT_CHARGE_DATE = 'Jul 1, 2026';

const discountedPrice = (price: string) => {
  const n = parseFloat(price.replace(/[^0-9.]/g, ''));
  return `$${(n * (1 - ACTIVE_DISCOUNT.percentOff)).toFixed(2)}`;
};

const MOCK_PAYMENTS = [
  { id: 'pay-105', date: 'Oct 01, 2024', invoice: 'INV-10042', amount: '$29.00', status: 'Paid', method: 'Visa 4242' },
  { id: 'pay-104', date: 'Sep 01, 2024', invoice: 'INV-09821', amount: '$29.00', status: 'Paid', method: 'Visa 4242' },
  { id: 'pay-103', date: 'Aug 15, 2024', invoice: 'INV-09432', amount: '$199.00', status: 'Paid', method: 'Visa 4242', desc: 'Presentation Polish' },
  { id: 'pay-102', date: 'Aug 01, 2024', invoice: 'INV-09211', amount: '$29.00', status: 'Paid', method: 'Visa 4242' },
];

export const SubscriptionView = () => {
  const { t } = useTranslation();
  const [currentTierId, setCurrentTierId] = useState('founders');
  const [isUpdatePaymentOpen, setIsUpdatePaymentOpen] = useState(false);
  const [isSwitchPlanOpen, setIsSwitchPlanOpen] = useState(false);
  const [targetTier, setTargetTier] = useState<SubscriptionTier | null>(null);
  const [isOrderServiceOpen, setIsOrderServiceOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  // New State for Payment Form Validation
  const [paymentForm, setPaymentForm] = useState({
    name: '',
    number: '',
    expiry: '',
    cvc: ''
  });
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});

  const handleSwitchPlan = (tier: SubscriptionTier) => {
      setTargetTier(tier);
      setIsSwitchPlanOpen(true);
  };

  const handleOrderService = (service: any) => {
      setSelectedService(service);
      setIsOrderServiceOpen(true);
  };

  const validatePayment = () => {
    const errors: Record<string, string> = {};
    if (!paymentForm.name.trim()) errors.name = t('settings.SubscriptionView.errorCardholderRequired');
    if (!paymentForm.number.trim() || paymentForm.number.replace(/\s/g, '').length < 15) errors.number = t('settings.SubscriptionView.errorInvalidCardNumber');
    if (!paymentForm.expiry.trim() || !paymentForm.expiry.includes('/')) errors.expiry = t('settings.SubscriptionView.errorInvalidExpiry');
    if (!paymentForm.cvc.trim() || paymentForm.cvc.length < 3) errors.cvc = t('settings.SubscriptionView.errorCvcRequired');

    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCard = () => {
    if (validatePayment()) {
      setIsUpdatePaymentOpen(false);
      // Reset form and errors
      setPaymentForm({ name: '', number: '', expiry: '', cvc: '' });
      setPaymentErrors({});
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.SubscriptionView.pageTitle')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">{t('settings.SubscriptionView.pageSubtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full md:w-auto">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <Badge color="amber" className="mb-1">{ACTIVE_DISCOUNT.label.toUpperCase()}</Badge>
                    <div className="text-sm font-bold text-gray-900 dark:text-white leading-none">{t('settings.SubscriptionView.nextCharge')} {discountedPrice(TIERS.find(tier => tier.id === currentTierId)?.price || '$0')} {t('settings.SubscriptionView.on')} {NEXT_CHARGE_DATE}</div>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-500">
                    <CreditCard className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{t('settings.SubscriptionView.currentMethod')}</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white leading-none">Visa •••• 4242</div>
                </div>
                <Button size="sm" variant="ghost" className="text-primary-600 dark:text-primary-400 font-bold ml-2" onClick={() => setIsUpdatePaymentOpen(true)}>{t('settings.SubscriptionView.update')}</Button>
            </div>
        </div>
      </div>

      {/* --- TIER GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-20 pt-8">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTierId;
          const Icon = tier.icon;

          return (
            <Card
                key={tier.id}
                className={`relative flex flex-col p-8 transition-all duration-300 border-0 shadow-lg group overflow-visible bg-white dark:bg-gray-800 ${
                    isCurrent ? 'ring-2 ring-primary-500 ring-offset-4 dark:ring-offset-gray-900' : 'hover:-translate-y-1 hover:shadow-xl'
                }`}
            >
              {tier.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-lg z-10 whitespace-nowrap">
                      {t('settings.SubscriptionView.mostPopular')}
                  </div>
              )}

              {isCurrent && (
                  <div className="absolute -top-4 right-6 bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-lg z-10 whitespace-nowrap flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {ACTIVE_DISCOUNT.label}
                  </div>
              )}

              <div className="mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm border ${tier.accentColor}`}>
                      <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-heading mb-1">{tier.name}</h3>
                  {isCurrent && (
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2">
                          {t('settings.SubscriptionView.currentDiscount')} {ACTIVE_DISCOUNT.label} {t('settings.SubscriptionView.until')} {ACTIVE_DISCOUNT.until}
                      </p>
                  )}
                  <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">{tier.price}</span>
                      <span className="text-gray-400 dark:text-gray-500 font-bold text-xs">{t('settings.SubscriptionView.perMonth')}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed min-h-[40px]">{tier.description}</p>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                  {tier.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isCurrent ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                              <Check className="w-2.5 h-2.5" />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{feature}</span>
                      </div>
                  ))}
              </div>

              <div className="mt-auto">
                  {isCurrent && (
                      <Button
                        className="w-full justify-center h-14 bg-slate-900 dark:bg-gray-700 text-white border-none hover:bg-slate-800 dark:hover:bg-gray-600 rounded-2xl font-bold text-base"
                        variant="primary"
                      >
                          <UserCheck className="w-5 h-5 mr-2" /> {t('settings.SubscriptionView.currentPlan')}
                      </Button>
                  )}
                  {isCurrent && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          <span>{t('settings.SubscriptionView.nextCharge')}</span>
                          <span className="line-through text-gray-400 dark:text-gray-500">{tier.price}</span>
                          <span className="font-black text-amber-600 dark:text-amber-400">{discountedPrice(tier.price)}</span>
                          <span>· {NEXT_CHARGE_DATE}</span>
                      </div>
                  )}
                  {!isCurrent && (
                      <Button
                        className="w-full justify-center h-14 bg-primary-600 text-white hover:bg-primary-700 rounded-2xl font-bold text-base shadow-lg shadow-primary-500/20 border-none"
                        onClick={() => handleSwitchPlan(tier)}
                      >
                          {tier.id === 'founders' ? (
                            <><Calendar className="w-5 h-5 mr-2" /> {t('settings.SubscriptionView.joinWaitlist')}</>
                          ) : (
                            <><ArrowRightLeft className="w-5 h-5 mr-2" /> {t('settings.SubscriptionView.switchPlan')}</>
                          )}
                      </Button>
                  )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* --- ALA CARTE SECTION --- */}
      <div className="relative mb-20">
          <div className="flex items-center gap-4 mb-8">
              <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.SubscriptionView.alaCarteTitle')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{t('settings.SubscriptionView.alaCarteSubtitle')}</p>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ALA_CARTE.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-primary-300 dark:hover:border-primary-500 transition-all group flex items-center gap-6">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors shrink-0 shadow-inner">
                          <item.icon className="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{item.title}</h4>
                              <div className="text-primary-600 dark:text-primary-400 font-black text-lg">{item.price}</div>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{item.desc}</p>
                          <button
                            onClick={() => handleOrderService(item)}
                            className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest flex items-center gap-1.5 hover:gap-3 transition-all"
                          >
                              {t('settings.SubscriptionView.orderSetup')} <ArrowRight className="w-3 h-3" />
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* --- PAYMENT HISTORY SECTION --- */}
      <div className="mb-20">
          <div className="flex items-center gap-4 mb-8 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500">
                  <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('settings.SubscriptionView.billingHistory')}</h3>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                          <th className="px-6 py-4">{t('settings.SubscriptionView.colDate')}</th>
                          <th className="px-6 py-4">{t('settings.SubscriptionView.colInvoice')}</th>
                          <th className="px-6 py-4">{t('settings.SubscriptionView.colDescription')}</th>
                          <th className="px-6 py-4">{t('settings.SubscriptionView.colMethod')}</th>
                          <th className="px-6 py-4">{t('settings.SubscriptionView.colAmount')}</th>
                          <th className="px-6 py-4 text-center">{t('settings.SubscriptionView.colReceipt')}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                      {MOCK_PAYMENTS.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{payment.date}</td>
                              <td className="px-6 py-4 font-mono text-xs text-gray-400 dark:text-gray-500">{payment.invoice}</td>
                              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{payment.desc || t('settings.SubscriptionView.monthlySubscription')}</td>
                              <td className="px-6 py-4 text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                  <CreditCard className="w-3 h-3" /> {payment.method}
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{payment.amount}</td>
                              <td className="px-6 py-4 text-center">
                                  <button className="p-2 text-gray-300 dark:text-gray-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all">
                                      <Download className="w-4 h-4" />
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Support Banner */}
      <div className="mt-12 bg-slate-900 dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute top-0 right-0 p-12 opacity-10">
              <Settings className="w-48 h-48" />
          </div>
          <div className="relative z-10 max-w-xl text-center md:text-left">
              <h4 className="text-2xl font-bold mb-3 font-heading">{t('settings.SubscriptionView.supportBannerTitle')}</h4>
              <p className="text-slate-400 leading-relaxed">{t('settings.SubscriptionView.supportBannerBody')}</p>
          </div>
          <div className="relative z-10 shrink-0">
              <Button variant="primary" className="bg-white !text-slate-900 hover:bg-slate-100 h-14 px-10 font-bold text-base rounded-xl shadow-lg border-none transition-all active:scale-95">
                  {t('settings.SubscriptionView.contactSupport')}
              </Button>
          </div>
      </div>

      {/* --- FLOW MODALS --- */}

      {/* 1. Update Payment Modal - Updated with validation and errors */}
      <Modal isOpen={isUpdatePaymentOpen} onClose={() => { setIsUpdatePaymentOpen(false); setPaymentErrors({}); }} title={t('settings.SubscriptionView.modalUpdatePaymentTitle')}>
          <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">{t('settings.SubscriptionView.stripeSecurityNote')}</p>
              </div>

              <div className="space-y-4">
                  <div>
                    <TextInput
                        label={t('settings.SubscriptionView.labelCardholderName')}
                        placeholder={t('settings.SubscriptionView.placeholderFullName')}
                        value={paymentForm.name}
                        onChange={(v) => setPaymentForm({...paymentForm, name: v})}
                    />
                    {paymentErrors.name && <div className="text-[11px] text-red-600 font-black mt-1.5 ml-1 uppercase tracking-wider bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1 duration-200 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> {paymentErrors.name}</div>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">{t('settings.SubscriptionView.labelCardNumber')}</label>
                    <div className="relative">
                        <input
                            type="text"
                            className={`w-full px-4 py-3 bg-white dark:bg-gray-900 border rounded-xl outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/20 transition-colors text-gray-900 dark:text-white ${paymentErrors.number ? 'border-red-500 ring-red-50 dark:ring-red-900/20' : 'border-gray-400 dark:border-gray-500'}`}
                            placeholder="•••• •••• •••• 4242"
                            value={paymentForm.number}
                            onChange={(e) => setPaymentForm({...paymentForm, number: e.target.value})}
                        />
                        <CreditCard className="w-5 h-5 text-gray-400 dark:text-gray-500 absolute right-4 top-1/2 -translate-y-1/2" />
                    </div>
                    {paymentErrors.number && <div className="text-[11px] text-red-600 font-black mt-1.5 ml-1 uppercase tracking-wider bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1 duration-200 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> {paymentErrors.number}</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <TextInput
                            label={t('settings.SubscriptionView.labelExpiry')}
                            placeholder={t('settings.SubscriptionView.placeholderExpiry')}
                            value={paymentForm.expiry}
                            onChange={(v) => setPaymentForm({...paymentForm, expiry: v})}
                        />
                        {paymentErrors.expiry && <div className="text-[11px] text-red-600 font-black mt-1.5 ml-1 uppercase tracking-wider bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1 duration-200 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> {paymentErrors.expiry}</div>}
                      </div>
                      <div>
                        <TextInput
                            label={t('settings.SubscriptionView.labelCvc')}
                            placeholder="•••"
                            value={paymentForm.cvc}
                            onChange={(v) => setPaymentForm({...paymentForm, cvc: v})}
                        />
                        {paymentErrors.cvc && <div className="text-[11px] text-red-600 font-black mt-1.5 ml-1 uppercase tracking-wider bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-800 animate-in fade-in slide-in-from-top-1 duration-200 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> {paymentErrors.cvc}</div>}
                      </div>
                  </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button variant="secondary" onClick={() => { setIsUpdatePaymentOpen(false); setPaymentErrors({}); }} className="flex-1">{t('settings.SubscriptionView.cancel')}</Button>
                  <Button onClick={handleSaveCard} className="flex-1 shadow-lg shadow-primary-500/20">{t('settings.SubscriptionView.saveCard')}</Button>
              </div>
          </div>
      </Modal>

      {/* 2. Switch Plan Confirmation Modal */}
      <Modal isOpen={isSwitchPlanOpen} onClose={() => setIsSwitchPlanOpen(false)} title={t('settings.SubscriptionView.modalConfirmPlanTitle')}>
          {targetTier && (
              <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div>
                          <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('settings.SubscriptionView.selectedPlan')}</div>
                          <div className="text-xl font-black text-gray-900 dark:text-white">{targetTier.name}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-2xl font-black text-primary-600 dark:text-primary-400">{targetTier.price}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{t('settings.SubscriptionView.perMonthLong')}</div>
                      </div>
                  </div>

                  <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">{t('settings.SubscriptionView.includedIn', { name: targetTier.name })}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {targetTier.features.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 font-medium">
                                  <Check className="w-3 h-3 text-green-500" /> {f}
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex gap-3">
                      <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                          {t('settings.SubscriptionView.billingCycleNote')}
                      </p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <Button variant="secondary" onClick={() => setIsSwitchPlanOpen(false)} className="flex-1">{t('settings.SubscriptionView.cancel')}</Button>
                      <Button onClick={() => { setCurrentTierId(targetTier.id); setIsSwitchPlanOpen(false); }} className="flex-1 shadow-lg shadow-primary-500/20">
                          {t('settings.SubscriptionView.confirmSwitch')}
                      </Button>
                  </div>
              </div>
          )}
      </Modal>

      {/* 3. Order Setup Service Modal */}
      <Modal isOpen={isOrderServiceOpen} onClose={() => setIsOrderServiceOpen(false)} title={t('settings.SubscriptionView.modalOrderServiceTitle')}>
          {selectedService && (
              <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-sm border border-gray-100 dark:border-gray-700">
                          <selectedService.icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                          <h4 className="font-black text-gray-900 dark:text-white text-xl">{selectedService.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedService.price} {t('settings.SubscriptionView.oneTimeCharge')}</p>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <h5 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {t('settings.SubscriptionView.whatsIncluded')}
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 italic">
                          "{selectedService.desc} {t('settings.SubscriptionView.expertTeamNote')}"
                      </p>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                      <AlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
                      <span className="text-xs text-primary-800 dark:text-primary-300 font-bold">{t('settings.SubscriptionView.chargeNotice')}</span>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <Button variant="secondary" onClick={() => setIsOrderServiceOpen(false)} className="flex-1">{t('settings.SubscriptionView.cancel')}</Button>
                      <Button onClick={() => setIsOrderServiceOpen(false)} className="flex-1 shadow-lg shadow-primary-500/20">{t('settings.SubscriptionView.confirmOrder')}</Button>
                  </div>
              </div>
          )}
      </Modal>
    </div>
  );
};
