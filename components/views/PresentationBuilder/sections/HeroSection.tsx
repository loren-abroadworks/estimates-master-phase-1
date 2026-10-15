import React from 'react';
import { ArrowDown } from 'lucide-react';
import { VariantType } from '../types';
import { Badge } from '../../../UI';
import { EditableText } from '../components/EditableText';
import { useTranslation } from '@/i18n/LanguageContext';

export const HeroSection = ({ 
    variant, 
    content, 
    updateContent, 
    toolbar, 
    isEdit,
    viewDevice
}: { 
    variant: VariantType, 
    content: any, 
    updateContent: (field: string, val: any) => void, 
    toolbar?: React.ReactNode, 
    isEdit: boolean,
    viewDevice?: 'desktop' | 'mobile'
}) => {
    const { t } = useTranslation();
    const isMobile = viewDevice === 'mobile';

    const ViewProposalBtn = () => (
        <button className={`px-10 py-5 bg-primary-600 text-white font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-gray-900 transition-all flex items-center gap-3 shadow-2xl ${isMobile ? 'w-full justify-center' : ''}`}>
            {t('views.PresentationBuilder.sections.HeroSection.viewProposal')} <ArrowDown className="w-4 h-4" />
        </button>
    );

    if (variant === 1) return (
        <div className={`relative group bg-slate-900 text-white overflow-hidden flex flex-col justify-center items-center text-center ${isMobile ? 'py-24 px-6' : 'py-48 md:py-64 px-6'}`}>
            {toolbar}
            <div className="absolute inset-0 bg-cover bg-center transition-opacity opacity-20" style={{ backgroundImage: `url('${content.bgImage}')` }} />
            <div className="max-w-4xl mx-auto relative z-10">
                <Badge color="primary" className="mb-4">{t('views.PresentationBuilder.sections.HeroSection.projectProposal')}</Badge>
                {isEdit ? (
                    <EditableText as="h1" className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-black mb-6 tracking-tighter`} value={content.title} onChange={(v) => updateContent('title', v)} />
                ) : (
                    <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-black mb-6 tracking-tighter leading-tight`}>{content.title}</h1>
                )}
                {isEdit ? (
                    <EditableText className={`${isMobile ? 'text-base' : 'text-xl'} text-gray-300 max-w-2xl mx-auto mb-10`} value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} />
                ) : (
                    <p className={`${isMobile ? 'text-base' : 'text-xl'} text-gray-300 max-w-2xl mx-auto mb-10`}>{content.subtitle}</p>
                )}
                <div className="flex justify-center w-full"><ViewProposalBtn /></div>
            </div>
        </div>
    );
    
    if (variant === 2) return (
        <div className={`relative group overflow-hidden flex items-center bg-slate-900 ${isMobile ? 'py-24 px-6' : 'py-48 md:py-72 px-6'}`}>
            {toolbar}
            <div className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay" style={{ backgroundImage: `url('${content.bgImage}')` }} />
            <div className="max-w-7xl mx-auto relative z-10 w-full flex justify-start">
                <div className={`${isMobile ? 'p-8 border-l-[4px]' : 'p-12 md:p-20 border-l-[8px]'} max-w-3xl bg-[#1a1f2e]/90 text-white border-primary-600 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-left-8 duration-700`}>
                     {isEdit ? <EditableText as="h1" className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-black mb-6 tracking-tight leading-none`} value={content.title} onChange={(v) => updateContent('title', v)} /> : <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-black mb-6 tracking-tight leading-none`}>{content.title}</h1>}
                     {isEdit ? <EditableText className={`${isMobile ? 'text-base' : 'text-xl'} text-slate-300 mb-10 font-medium`} value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} /> : <p className={`${isMobile ? 'text-base' : 'text-xl'} text-slate-300 mb-10 font-medium`}>{content.subtitle}</p>}
                     <ViewProposalBtn />
                </div>
            </div>
        </div>
    );

    return (
        <div className={`relative group bg-white overflow-hidden ${isMobile ? 'py-16 px-6' : 'py-12 md:py-20 px-6'}`}>
            {toolbar}
            <div className={`max-w-7xl mx-auto grid grid-cols-1 ${isMobile ? 'gap-8' : 'lg:grid-cols-2 gap-12'} items-center`}>
                <div className="space-y-6 md:space-y-8">
                    <div className="w-12 h-1 bg-primary-600" />
                    <div className="space-y-4">
                        {isEdit ? <EditableText as="h1" className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-black text-gray-900 tracking-tight leading-none`} value={content.title} onChange={(v) => updateContent('title', v)} /> : <h1 className={`${isMobile ? 'text-4xl' : 'text-5xl md:text-7xl'} font-black text-gray-900 tracking-tight leading-none`}>{content.title}</h1>}
                        {isEdit ? <EditableText className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-gray-500 font-medium max-w-lg`} value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} /> : <p className={`${isMobile ? 'text-base' : 'text-lg md:text-xl'} text-gray-500 font-medium max-w-lg`}>{content.subtitle}</p>}
                    </div>
                    <ViewProposalBtn />
                </div>
                <div className={`relative rounded-[3rem] overflow-hidden shadow-2xl border border-gray-50 ${isMobile ? 'h-[300px]' : 'aspect-square md:aspect-auto md:h-[500px]'}`}>
                     <img src={content.bgImage} className="w-full h-full object-cover" alt={t('views.PresentationBuilder.sections.HeroSection.heroAlt')} />
                </div>
            </div>
        </div>
    );
};
