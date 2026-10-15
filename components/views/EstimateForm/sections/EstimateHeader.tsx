
import React from 'react';
import { Paintbrush, ChevronDown, UserCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

// Contractor Branding Component
const ContractorLogo = ({ size = "md", invert = false }: { size?: "sm" | "md" | "lg", invert?: boolean }) => {
    const { t } = useTranslation();
    const sizeClasses = {
        sm: "h-8",
        md: "h-10", 
        lg: "h-14"
    };
    
    return (
        <div className={`flex items-center gap-3 select-none ${sizeClasses[size]}`}>
            <div className={`aspect-square h-full rounded-lg flex items-center justify-center shadow-sm ${invert ? 'bg-white text-gray-900' : 'bg-gray-900 dark:bg-gray-700 text-white'}`}>
                <Paintbrush className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-7 h-7'}`} />
            </div>
            <div className={`flex flex-col justify-center ${invert ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                <span className={`font-black uppercase tracking-tight leading-none ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'}`}>{t('views.EstimateForm.sections.EstimateHeader.brandName')}</span>
                <span className={`font-bold uppercase tracking-widest leading-none ${invert ? 'text-gray-300' : 'text-primary-600 dark:text-primary-400'} ${size === 'lg' ? 'text-xs' : 'text-[0.5rem]'}`}>{t('views.EstimateForm.sections.EstimateHeader.brandTagline')}</span>
            </div>
        </div>
    );
};

interface EstimateHeaderProps {
  salesman: any;
  onOpenSalesmanModal: () => void;
  title?: string;
}

export const EstimateHeader: React.FC<EstimateHeaderProps> = ({ salesman, onOpenSalesmanModal, title = "Interior Estimate" }) => {
  const { t } = useTranslation();
  return (
    <div className="relative">
        <div className="p-4 md:p-12 pb-4 md:pb-8 relative">
            <div className="text-center mb-6 md:mb-10">
                    <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white font-heading tracking-tight mb-2">{title}</h2>
                    <p className="text-gray-400 dark:text-gray-500 font-medium text-sm md:text-lg">{t('views.EstimateForm.sections.EstimateHeader.subtitle')}</p>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-center lg:items-center gap-6 relative text-center lg:text-left">
                {/* Company Info - Center on mobile/tablet, Left on desktop */}
                <div className="flex flex-row gap-4 items-center justify-center lg:justify-start text-left">
                    <ContractorLogo size="lg" />
                    <div className="flex flex-col items-start ml-2">
                        <div className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 space-y-0.5">
                            <p>123 Painter's Lane, Color City, NY</p>
                            <p className="text-gray-400 dark:text-gray-500">license #12345678</p>
                        </div>
                    </div>
                </div>

                {/* Estimator Info - Center on mobile/tablet */}
                <div className="flex flex-col items-center lg:items-end flex-shrink-0 w-full lg:w-auto mt-0 lg:mt-0">
                    <div className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 w-full text-center lg:text-right">{t('views.EstimateForm.sections.EstimateHeader.estimatorLabel')}</div>
                    <button onClick={onOpenSalesmanModal} className={`group flex items-center gap-3 md:gap-4 pl-3 md:pl-5 pr-3 md:pr-4 py-2 rounded-2xl transition-all border shadow-sm w-full sm:w-auto justify-between lg:justify-start ${salesman ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600' : 'bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}>
                        {salesman ? (
                            <>
                            <div className="text-right hidden sm:block">
                                <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{salesman.name}</div>
                                <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium">{salesman.phone}</div>
                            </div>
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 p-0.5 overflow-hidden flex-shrink-0 shadow-sm order-first sm:order-none">
                                {salesman.photo ? (
                                <img src={salesman.photo} alt={salesman.name} className="w-full h-full object-cover rounded-full" />
                                ) : ( <UserCircle className="w-full h-full text-gray-300 dark:text-gray-500" /> )}
                            </div>
                            <div className="text-left sm:hidden flex-1 pl-3">
                                <div className="text-base font-bold text-gray-900 dark:text-white">{salesman.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{salesman.phone}</div>
                            </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center w-full gap-2 py-1">
                                <span className="text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 whitespace-nowrap">{t('views.EstimateForm.sections.EstimateHeader.selectEstimator')}</span>
                                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-500" />
                            </div>
                        )}
                    </button>
                    {salesman && (<div className="mt-2 text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-medium hidden lg:block text-right">{salesman.email}</div>)}
                </div>
            </div>
        </div>
        <div className="px-4 md:px-12"><div className="h-px bg-gray-100 dark:bg-gray-700 w-full"></div></div>
    </div>
  );
};
