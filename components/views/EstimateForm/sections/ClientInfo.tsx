
import React from 'react';
import { Edit2, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface ClientInfoProps {
  customer: any;
  jobAddress: any;
  estimateDate: string;
  validUntilDate: string;
  onOpenEditClient: () => void;
  onOpenEditJobSite: () => void;
  onOpenEditDates: () => void;
}

export const ClientInfo: React.FC<ClientInfoProps> = ({
  customer,
  jobAddress,
  estimateDate,
  validUntilDate,
  onOpenEditClient,
  onOpenEditJobSite,
  onOpenEditDates
}) => {
  const { t } = useTranslation();
  return (
    <section className="border-b border-gray-200 dark:border-gray-700 pb-8 md:pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 md:gap-12">
            
            {/* Client Column */}
            <div 
                className={`relative group col-span-1 flex flex-col ${
                    (customer.firstName || customer.lastName) 
                        ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 p-3 -m-3 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm' 
                        : ''
                }`}
                onClick={(customer.firstName || customer.lastName) ? onOpenEditClient : undefined}
            >
                <div className="flex justify-between items-center mb-2 md:mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h4 className="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-widest">{t('views.EstimateForm.sections.ClientInfo.client')}</h4>
                    {(customer.firstName || customer.lastName) && (
                        <div className="text-gray-300 dark:text-gray-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 bg-white dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 p-1.5 rounded-lg transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>
                {!(customer.firstName || customer.lastName) ? (
                    <button onClick={(e) => { e.stopPropagation(); onOpenEditClient(); }} className="w-full h-32 md:h-40 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-2 md:gap-4 text-gray-400 dark:text-gray-500 font-bold hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group/btn bg-white dark:bg-gray-800/30 p-2">
                        <div className="w-8 h-8 md:w-12 md:h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center group-hover/btn:bg-white dark:group-hover/btn:bg-gray-700 group-hover/btn:text-primary-600 dark:group-hover/btn:text-primary-400 transition-colors shadow-sm"><Plus className="w-4 h-4 md:w-6 md:h-6" /></div>
                        <span className="text-xs md:text-lg text-gray-400 dark:text-gray-500 group-hover/btn:text-primary-600 dark:group-hover/btn:text-primary-400 transition-colors text-center">{t('views.EstimateForm.sections.ClientInfo.addClient')}</span>
                    </button>
                ) : (
                    <div className="space-y-1">
                        <div className="font-bold text-gray-900 dark:text-white text-sm md:text-xl mb-1 break-words">{customer.firstName} {customer.lastName}</div>
                        <div className="text-gray-600 dark:text-gray-300 leading-relaxed text-xs md:text-base">
                            {customer.billingAddress || t('views.EstimateForm.sections.ClientInfo.noBillingAddress')}
                            {(customer.city || customer.state || customer.zip) && (<div>{customer.city}, {customer.state} {customer.zip}</div>)}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs md:text-sm pt-2">
                            {customer.email && <div className="truncate">{customer.email}</div>}
                            {customer.phone && <div>{customer.phone}</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Job Site Column */}
            <div 
                className={`relative group col-span-1 flex flex-col ${
                    jobAddress.address
                        ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 p-3 -m-3 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm' 
                        : ''
                }`}
                onClick={jobAddress.address ? onOpenEditJobSite : undefined}
            >
                <div className="flex justify-between items-center mb-2 md:mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h4 className="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-widest">{t('views.EstimateForm.sections.ClientInfo.jobSite')}</h4>
                    {jobAddress.address && (
                        <div className="text-gray-300 dark:text-gray-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 bg-white dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 p-1.5 rounded-lg transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>
                {!jobAddress.address ? (
                    <button onClick={(e) => { e.stopPropagation(); onOpenEditJobSite(); }} className="w-full h-32 md:h-40 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-2 md:gap-4 text-gray-400 dark:text-gray-500 font-bold hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group/btn bg-white dark:bg-gray-800/30 p-2">
                        <div className="w-8 h-8 md:w-12 md:h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center group-hover/btn:bg-white dark:group-hover/btn:bg-gray-700 group-hover/btn:text-primary-600 dark:group-hover/btn:text-primary-400 transition-colors shadow-sm"><Plus className="w-4 h-4 md:w-6 md:h-6" /></div>
                        <span className="text-xs md:text-lg text-gray-400 dark:text-gray-500 group-hover/btn:text-primary-600 dark:group-hover/btn:text-primary-400 transition-colors text-center">{t('views.EstimateForm.sections.ClientInfo.addSite')}</span>
                    </button>
                ) : (
                    <div className="space-y-1">
                        <div className="font-bold text-gray-900 dark:text-white text-sm md:text-xl mb-1 break-words">{jobAddress.address}</div>
                        <div className="text-gray-600 dark:text-gray-300 leading-relaxed text-xs md:text-base">
                            {jobAddress.city ? `${jobAddress.city}, ${jobAddress.state} ${jobAddress.zip}` : t('views.EstimateForm.sections.ClientInfo.cityStateZip')}
                        </div>
                        {jobAddress.accessCode && (<div className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-500 pt-2">{t('views.EstimateForm.sections.ClientInfo.access', { accessCode: jobAddress.accessCode })}</div>)}
                    </div>
                )}
            </div>

            {/* Dates Column - Spans 2 on mobile, 1 on desktop */}
            <div 
                className="relative group col-span-2 lg:col-span-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all duration-200 p-3 -m-3 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm"
                onClick={onOpenEditDates}
            >
                <div className="flex justify-between items-center mb-2 md:mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <h4 className="font-bold text-gray-400 dark:text-gray-500 text-[10px] md:text-xs uppercase tracking-widest">{t('views.EstimateForm.sections.ClientInfo.dates')}</h4>
                    <div className="text-gray-300 dark:text-gray-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 bg-white dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <Edit2 className="w-3.5 h-3.5" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-[10px] md:text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('views.EstimateForm.sections.ClientInfo.estimateDate')}</div>
                        <div className="font-bold text-gray-900 dark:text-white text-sm md:text-lg">
                            {estimateDate ? new Date(estimateDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'}) : '-'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] md:text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('views.EstimateForm.sections.ClientInfo.validUntil')}</div>
                        <div className="font-bold text-gray-900 dark:text-white text-sm md:text-lg">
                            {validUntilDate ? new Date(validUntilDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'}) : '-'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
  );
};
