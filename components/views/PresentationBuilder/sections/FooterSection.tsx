import React from 'react';
import { VariantType } from '../types';
import { ContractorLogo } from '../components/ContractorLogo';
import { useTranslation } from '@/i18n/LanguageContext';

export const FooterSection = ({ variant, content, toolbar }: { variant: VariantType, content?: any, toolbar?: React.ReactNode }) => {
    const { t } = useTranslation();
    const links = content?.links || [];
    const description = content?.description || t('views.PresentationBuilder.sections.FooterSection.defaultDescription');

    const handleLinkAction = (target: string) => {
        if (!target) return;
        if (target.startsWith('http') || target.startsWith('www')) {
            window.open(target, '_blank');
        } else {
            const element = document.getElementById(target);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    if (variant === 1) return (
        <footer className="relative group bg-white border-t border-gray-100 py-20 px-8 text-center mt-auto">
            {toolbar}
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-center mb-8"><ContractorLogo size="lg" /></div>
                <p className="text-gray-400 text-sm max-w-sm mx-auto mb-12">{description}</p>
                <div className="flex justify-center flex-wrap gap-x-10 gap-y-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    {links.map((link: any, i: number) => (
                        <span key={i} onClick={() => handleLinkAction(link.targetId)} className="hover:text-primary-600 cursor-pointer transition-colors">
                            {link.label}
                        </span>
                    ))}
                </div>
            </div>
        </footer>
    );
    if (variant === 2) return (
        <footer className="relative group bg-slate-900 py-24 px-12 text-white mt-auto">
            {toolbar}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
                <div className="space-y-6">
                    <ContractorLogo invert size="lg" />
                    <div className="text-gray-500 space-y-1">
                        <p>{description}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-16">
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-primary-500">{t('views.PresentationBuilder.sections.FooterSection.contact')}</h4>
                        <div className="text-gray-400 space-y-2 text-sm">
                            <p>hello@artisanfinishes.com</p>
                            <p>(555) 123-ARTY</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-primary-500">{t('views.PresentationBuilder.sections.FooterSection.links')}</h4>
                        <div className="flex flex-col gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {links.map((link: any, i: number) => (
                                <span key={i} onClick={() => handleLinkAction(link.targetId)} className="hover:text-white cursor-pointer transition-colors">
                                    {link.label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
    return (
        <footer className="relative group bg-gray-50 py-16 px-8 text-center mt-auto">
            {toolbar}
            <div className="flex flex-col items-center">
                <ContractorLogo />
                <p className="text-gray-400 text-sm mt-4 max-w-xs">{description}</p>
                <div className="flex flex-wrap justify-center gap-6 mt-8 mb-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {links.map((link: any, i: number) => (
                        <span key={i} onClick={() => handleLinkAction(link.targetId)} className="hover:text-primary-600 cursor-pointer transition-colors">{link.label}</span>
                    ))}
                </div>
                <div className="mt-4 text-gray-300 text-[10px] font-black uppercase tracking-widest">{t('views.PresentationBuilder.sections.FooterSection.copyright')}</div>
            </div>
        </footer>
    );
};
