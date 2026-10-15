import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { VariantType } from '../types';
import { EditableText } from '../components/EditableText';
import { Badge } from '../../../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const PortfolioSection = ({ 
    id,
    variant, 
    content, 
    updateContent, 
    toolbar, 
    isEdit,
    handleOpenImagePicker,
    viewDevice
}: { 
    id: string,
    variant: VariantType, 
    content: any, 
    updateContent: (field: string, val: any) => void, 
    toolbar?: React.ReactNode, 
    isEdit: boolean,
    handleOpenImagePicker: (id: string, field: string, index?: number) => void,
    viewDevice?: 'desktop' | 'mobile'
}) => {
    const { t } = useTranslation();
    const isMobile = viewDevice === 'mobile';

    if (variant === 1) return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-24'} px-6 bg-white`}>
            {toolbar}
            <div className="max-w-7xl mx-auto">
                <div className={`text-center ${isMobile ? 'mb-10' : 'mb-16'}`}>
                    {isEdit ? <EditableText as="h2" className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black mb-2 tracking-tighter`} value={content.title} onChange={(v) => updateContent('title', v)} /> : <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black mb-2 tracking-tighter`}>{content.title}</h2>}
                    {isEdit ? <EditableText className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base" value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} /> : <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">{content.subtitle}</p>}
                </div>
                <div className={`grid grid-cols-1 ${isMobile ? 'gap-6' : 'md:grid-cols-2 gap-10'}`}>
                    {content.items.map((item: any, i: number) => (
                        <div id={item.id} key={item.id || i} className="bg-white rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-xl group/p flex flex-col hover:shadow-2xl transition-all duration-500">
                            <div 
                                className={`aspect-[4/3] overflow-hidden relative ${isEdit ? 'cursor-pointer group/img' : ''}`}
                                onClick={() => isEdit && handleOpenImagePicker(id, 'image', i)}
                            >
                                <img src={item.image} className="w-full h-full object-cover transition-transform duration-700 group-hover/p:scale-105" alt={item.title} />
                                {isEdit && (
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" /> {t('views.PresentationBuilder.sections.PortfolioSection.swapImage')}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={`${isMobile ? 'p-6' : 'p-10'} flex-1 flex flex-col`}>
                                <div className="mb-4">
                                    {isEdit ? (
                                        <div className="inline-block bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-primary-100">
                                            <EditableText value={item.category} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],category:v}; updateContent('items',n); }} />
                                        </div>
                                    ) : (
                                        <Badge color="primary" className="text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none">{item.category}</Badge>
                                    )}
                                </div>
                                {isEdit ? <EditableText as="h3" className="text-xl md:text-2xl font-black text-gray-900 mb-3" value={item.title} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],title:v}; updateContent('items',n); }} /> : <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-3">{item.title}</h3>}
                                {isEdit ? (
                                    <EditableText 
                                        className="text-gray-500 leading-relaxed mb-6 md:mb-8 flex-1 text-sm md:text-lg" 
                                        value={item.description || t('views.PresentationBuilder.sections.PortfolioSection.defaultDescription', { category: item.category.toLowerCase() })}
                                        onChange={(v) => { const n = [...content.items]; n[i]={...n[i],description:v}; updateContent('items',n); }}
                                    />
                                ) : (
                                    <p className="text-gray-500 leading-relaxed mb-6 md:mb-8 flex-1 text-sm md:text-lg">{item.description || t('views.PresentationBuilder.sections.PortfolioSection.defaultDescription', { category: item.category.toLowerCase() })}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
    if (variant === 2) return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-32'} px-6 bg-gray-50`}>
            {toolbar}
            <div className={`max-w-7xl mx-auto grid grid-cols-1 ${isMobile ? 'gap-6' : 'sm:grid-cols-2 lg:grid-cols-3 gap-8'}`}>
                {content.items.map((item: any, i: number) => (
                     <div id={item.id} key={item.id || i} className="aspect-square relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] shadow-xl group/p">
                         <img src={item.image} className="w-full h-full object-cover" alt={item.title} />
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex flex-col justify-end p-6 md:p-8 opacity-0 group-hover/p:opacity-100 transition-opacity">
                             <h4 className="text-white font-bold text-base md:text-lg">{item.title}</h4>
                             <span className="text-primary-400 text-[10px] font-bold uppercase">{item.category}</span>
                         </div>
                     </div>
                ))}
            </div>
        </section>
    );
    return (
        <section className={`relative group bg-[#0f172a] ${isMobile ? 'py-24' : 'py-48'} px-6 text-center text-white`}>
            {toolbar}
            <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
                <div className="text-[10px] font-black text-primary-500 tracking-[0.4em] uppercase">{t('views.PresentationBuilder.sections.PortfolioSection.thePortfolio')}</div>
                {isEdit ? <EditableText as="h2" className="text-4xl md:text-6xl font-black tracking-tight leading-tight" value={content.title} onChange={(v) => updateContent('title', v)} /> : <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">{content.title}</h2>}
                <div className="flex justify-center pt-4">
                    <button className="px-10 md:px-12 py-4 md:py-5 bg-primary-600 text-white font-black uppercase tracking-widest text-[10px] md:text-[11px] rounded-full hover:bg-primary-700 transition-all shadow-2xl">
                        {t('views.PresentationBuilder.sections.PortfolioSection.viewFullGallery')}
                    </button>
                </div>
            </div>
        </section>
    );
};