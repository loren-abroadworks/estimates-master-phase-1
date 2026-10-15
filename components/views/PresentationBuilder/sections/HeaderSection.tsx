
import React from 'react';
import { Menu } from 'lucide-react';
import { VariantType } from '../types';
import { ContractorLogo } from '../components/ContractorLogo';
import { Button } from '../../../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const HeaderSection = ({ variant, content, viewDevice }: { variant: VariantType, content?: any, viewDevice?: 'desktop' | 'mobile' }) => {
    const { t } = useTranslation();
    const links = content?.links || [];
    const isMobile = viewDevice === 'mobile';

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

    const renderNav = () => (
        <nav className={`${isMobile ? 'hidden' : 'hidden lg:flex'} items-center gap-8 text-[10px] font-black text-gray-400 uppercase tracking-widest`}>
            {links.map((link: any, i: number) => (
                <span 
                    key={i} 
                    onClick={() => handleLinkAction(link.targetId)}
                    className="hover:text-primary-600 cursor-pointer transition-colors"
                >
                    {link.label}
                </span>
            ))}
        </nav>
    );

    const renderMobileMenuIcon = () => isMobile && (
        <button className="p-2 text-gray-500 hover:text-primary-600 transition-colors">
            <Menu className="w-6 h-6" />
        </button>
    );

    if (variant === 1) return (
        <header className="relative bg-white border-b border-gray-100 h-20 flex items-center justify-between px-6 md:px-8">
            <ContractorLogo size={isMobile ? 'sm' : 'md'} />
            {renderNav()}
            {renderMobileMenuIcon()}
        </header>
    );
    if (variant === 2) return (
        <header className="relative bg-slate-900 h-24 flex items-center justify-between px-6 md:px-10">
            <ContractorLogo invert size={isMobile ? 'sm' : 'md'} />
            <div className="flex gap-4 items-center">
                {!isMobile && renderNav()}
                <Button size="sm" className="bg-primary-600 text-white rounded-full px-6 text-[10px] font-black uppercase tracking-widest">{t('views.PresentationBuilder.sections.HeaderSection.reviewBid')}</Button>
                {renderMobileMenuIcon()}
            </div>
        </header>
    );
    return (
        <header className="relative bg-white h-28 flex flex-col items-center justify-center border-b border-gray-50">
            <div className="flex flex-col items-center gap-4 w-full px-6">
                <div className="flex justify-between items-center w-full">
                    <div className="w-10 h-10 lg:hidden"></div> {/* Spacer for centering logo */}
                    <ContractorLogo size={isMobile ? 'md' : 'lg'} />
                    {renderMobileMenuIcon()}
                </div>
                {renderNav()}
            </div>
        </header>
    );
};
