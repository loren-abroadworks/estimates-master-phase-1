import React from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { VariantType } from '../types';
import { EditableText } from '../components/EditableText';
import { useTranslation } from '@/i18n/LanguageContext';

export const AboutSection = ({ 
    id,
    variant, 
    content, 
    updateContent, 
    toolbar, 
    isEdit,
    viewDevice
}: { 
    id: string,
    variant: VariantType, 
    content: any, 
    updateContent: (field: string, val: any) => void, 
    toolbar?: React.ReactNode, 
    isEdit: boolean,
    viewDevice?: 'desktop' | 'mobile'
}) => {
    const isMobile = viewDevice === 'mobile';
    const { t } = useTranslation();

    if (variant === 1) return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-32'} px-6 bg-white overflow-visible`}>
            {toolbar}
            <div className={`max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 ${isMobile ? 'gap-12' : 'gap-20'} items-center`}>
                <div className={`${isMobile ? 'space-y-6' : 'space-y-10'}`}>
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 rounded-xl flex items-center justify-center text-primary-600 shadow-sm border border-primary-100">
                        <Users className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div>
                        {isEdit ? <EditableText as="h2" className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-black tracking-tight text-gray-900 mb-6`} value={content.title} onChange={(v) => updateContent('title', v)} /> : <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl md:text-5xl'} font-black tracking-tight text-gray-900 mb-6`}>{content.title}</h2>}
                        <div className={`space-y-4 md:space-y-6 text-gray-500 ${isMobile ? 'text-base' : 'text-lg'} leading-relaxed font-medium`}>
                            {isEdit ? <EditableText value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} /> : <p>{content.subtitle}</p>}
                            {isEdit ? <EditableText value={content.body} onChange={(v) => updateContent('body', v)} /> : <p>{content.body}</p>}
                        </div>
                    </div>
                    <div className={`grid grid-cols-2 ${isMobile ? 'gap-6' : 'gap-10'} pt-4`}>
                        {content.stats.map((s: any, i: number) => (
                            <div key={i} className="space-y-1">
                                {isEdit ? <EditableText as="div" className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black text-gray-900`} value={s.value} onChange={(v) => { const n = [...content.stats]; n[i]={...n[i],value:v}; updateContent('stats',n); }} /> : <div className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black text-gray-900`}>{s.value}</div>}
                                {isEdit ? <EditableText as="div" className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]" value={s.label} onChange={(v) => { const n = [...content.stats]; n[i]={...n[i],label:v}; updateContent('stats',n); }} /> : <div className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">{s.label}</div>}
                            </div>
                        ))}
                    </div>
                </div>
                <div className={`relative group/img-cont ${isMobile ? 'mt-8' : 'pr-4 pb-4'}`}>
                    <div className={`aspect-square rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl ${isMobile ? '' : 'rotate-2 hover:rotate-0'} transition-transform duration-700 w-full ${isMobile ? 'h-[350px]' : 'h-[600px]'}`}>
                        <img src={content.imageUrl} className="w-full h-full object-cover" alt={t('views.PresentationBuilder.sections.AboutSection.companyImageAlt')} />
                    </div>
                    <div className={`absolute ${isMobile ? '-bottom-4 -left-4 p-4' : '-bottom-8 -left-8 p-6'} bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl border border-gray-100 max-w-xs z-20 flex items-center gap-3 md:gap-5 ring-1 ring-black/[0.03]`}>
                        <div className={`${isMobile ? 'p-2' : 'p-4'} bg-green-50 rounded-full text-green-600 border border-green-100`}>
                            <ShieldCheck className={`${isMobile ? 'w-5 h-5' : 'w-7 h-7'}`} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            {isEdit ? (
                                <EditableText className="font-black text-gray-900 text-sm md:text-base leading-tight truncate" value={content.licenseTitle} onChange={(v) => updateContent('licenseTitle', v)} />
                            ) : (
                                <div className="font-black text-gray-900 text-sm md:text-base leading-tight truncate">{content.licenseTitle}</div>
                            )}
                            {isEdit ? (
                                <EditableText className="text-[9px] md:text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-wider" value={content.licenseNumber} onChange={(v) => updateContent('licenseNumber', v)} />
                            ) : (
                                <div className="text-[9px] md:text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-wider">{content.licenseNumber}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
    if (variant === 2) return (
        <section className={`relative group ${isMobile ? 'py-24' : 'py-48'} px-6 bg-slate-900 text-white text-center`}>
            {toolbar}
            <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
                <h2 className={`${isMobile ? 'text-4xl' : 'text-6xl'} font-black tracking-tighter leading-tight`}>{content.title}</h2>
                <p className={`${isMobile ? 'text-base' : 'text-xl'} text-gray-400 leading-relaxed`}>{content.subtitle}</p>
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 max-w-lg mx-auto`}>
                    {content.stats.map((s: any, i: number) => (
                        <div key={i} className="p-6 md:p-8 border border-white/10 rounded-3xl bg-white/5">
                            <div className="text-3xl md:text-4xl font-black mb-1">{s.value}</div>
                            <div className="text-[9px] md:text-[10px] font-black text-primary-500 uppercase tracking-widest">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
    return (
        <section className={`relative group py-20 md:py-32 px-6 bg-white overflow-hidden`}>
            {toolbar}
            <div className="max-w-7xl mx-auto flex flex-col items-center">
                <div className={`aspect-square ${isMobile ? 'w-24' : 'w-32'} rounded-full overflow-hidden bg-gray-100 mb-8 md:mb-12 shadow-xl ring-4 md:ring-8 ring-primary-50`}>
                     <img src={content.imageUrl} className="w-full h-full object-cover" alt={t('views.PresentationBuilder.sections.AboutSection.companyImageAlt')} />
                </div>
                <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black mb-6 text-center`}>{content.title}</h2>
                <p className={`text-center text-gray-500 max-w-2xl ${isMobile ? 'text-sm' : 'text-lg'} leading-relaxed`}>{content.subtitle}</p>
            </div>
        </section>
    );
};