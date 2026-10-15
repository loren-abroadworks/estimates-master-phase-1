import React from 'react';
import { VariantType } from '../types';
import { EditableText } from '../components/EditableText';
import { PaginatedHorizontalSection } from '../components/PaginatedSection';

export const ServicesSection = ({ 
    id,
    variant, 
    content, 
    updateContent, 
    toolbar, 
    isEdit,
    isPreview,
    handleOpenIconPicker,
    viewDevice
}: { 
    id: string,
    variant: VariantType, 
    content: any, 
    updateContent: (field: string, val: any) => void, 
    toolbar?: React.ReactNode, 
    isEdit: boolean,
    isPreview: boolean,
    handleOpenIconPicker: (id: string, index: number) => void,
    viewDevice?: 'desktop' | 'mobile'
}) => {
    const isMobile = viewDevice === 'mobile';

    if (variant === 1) return <PaginatedHorizontalSection id={id} type="services" content={content} updateContent={updateContent} isPreview={isPreview} toolbar={toolbar} isEdit={isEdit} handleOpenIconPicker={handleOpenIconPicker} />;
    
    if (variant === 2) return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-24'} px-6 bg-white text-center`}>
            {toolbar}
            <div className="max-w-7xl mx-auto">
                <div className={`text-center ${isMobile ? 'mb-12' : 'mb-20'}`}>
                    {isEdit ? <EditableText as="h2" className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black mb-4`} value={content.title} onChange={(v) => updateContent('title', v)} /> : <h2 className={`${isMobile ? 'text-3xl' : 'text-4xl'} font-black mb-4`}>{content.title}</h2>}
                    {isEdit ? <EditableText className="text-gray-400 text-sm md:text-base" value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} /> : <p className="text-gray-400 text-sm md:text-base">{content.subtitle}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                    {content.items.map((item: any, i: number) => (
                        <div id={item.id} key={item.id || i} className="bg-gray-50 p-6 md:p-8 rounded-3xl hover:bg-primary-50 transition-all group/service shadow-sm border border-gray-100 flex flex-col items-center">
                            <button 
                                disabled={!isEdit}
                                onClick={() => isEdit && handleOpenIconPicker(id, i)}
                                className={`w-14 h-14 md:w-16 md:h-16 bg-white text-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-sm mx-auto group-hover/service:bg-primary-600 group-hover/service:text-white transition-colors ${isEdit ? 'hover:scale-105 cursor-pointer' : ''}`}
                            >
                                <item.icon className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                            {isEdit ? <EditableText as="h3" className="text-lg md:text-xl font-bold mb-3" value={item.title} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],title:v}; updateContent('items',n); }} /> : <h3 className="text-lg md:text-xl font-bold mb-3">{item.title}</h3>}
                            {isEdit ? <EditableText className="text-gray-500 text-xs md:text-sm leading-relaxed" value={item.desc} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],desc:v}; updateContent('items',n); }} /> : <p className="text-gray-500 text-xs md:text-sm leading-relaxed">{item.desc}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
    return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-24'} px-6 bg-slate-900 text-white`}>
            {toolbar}
            <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
                 {content.items.map((item: any, i: number) => (
                     <div id={item.id} key={item.id || i} className="flex gap-4 md:gap-8 items-start border-b border-white/10 pb-8 last:border-0">
                         <div className="text-primary-500 font-black text-xl md:text-2xl pt-1">0{i+1}</div>
                         <div className="flex-1">
                             {isEdit ? <EditableText as="h3" className="text-xl md:text-2xl font-bold mb-2" value={item.title} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],title:v}; updateContent('items',n); }} /> : <h3 className="text-xl md:text-2xl font-bold mb-2">{item.title}</h3>}
                             {isEdit ? <EditableText className="text-gray-400 text-sm md:text-base leading-relaxed" value={item.desc} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],desc:v}; updateContent('items',n); }} /> : <p className="text-gray-400 text-sm md:text-base leading-relaxed">{item.desc}</p>}
                         </div>
                     </div>
                 ))}
            </div>
        </section>
    );
};