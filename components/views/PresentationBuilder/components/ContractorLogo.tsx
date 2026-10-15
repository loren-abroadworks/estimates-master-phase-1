
import React from 'react';
import { Paintbrush } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

export const ContractorLogo = ({ size = "md", invert = false }: { size?: "sm" | "md" | "lg", invert?: boolean }) => {
    const { t } = useTranslation();
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
                <span className={`font-black uppercase tracking-tight leading-none ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'}`}>{t('views.PresentationBuilder.components.ContractorLogo.appName')}</span>
                <span className={`font-bold uppercase tracking-widest leading-none ${invert ? 'text-gray-300' : 'text-primary-600'} ${size === 'lg' ? 'text-xs' : 'text-[0.5rem]'}`}>{t('views.PresentationBuilder.components.ContractorLogo.tagline')}</span>
            </div>
        </div>
    );
};
