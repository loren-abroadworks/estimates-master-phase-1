import React from 'react';
import { Quote, Star, UserCircle } from 'lucide-react';
import { VariantType } from '../types';
import { EditableText } from '../components/EditableText';
import { PaginatedHorizontalSection } from '../components/PaginatedSection';

export const ReviewsSection = ({ 
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

    if (variant === 1) return <PaginatedHorizontalSection id={id} type="reviews" content={content} updateContent={updateContent} isPreview={isPreview} toolbar={toolbar} isEdit={isEdit} handleOpenIconPicker={handleOpenIconPicker} />;
    
    if (variant === 2) return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-24'} px-6 bg-white text-center space-y-8 md:space-y-12`}>
            {toolbar}
            <div className="max-w-4xl mx-auto">
                <div className={`w-12 h-12 md:w-16 md:h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mx-auto mb-8 md:mb-12 shadow-sm`}>
                    <Quote className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                {content.items.slice(0, 1).map((item: any, i: number) => (
                    <div id={item.id} key={item.id || i} className="space-y-8 md:space-y-10">
                        {isEdit ? <EditableText as="p" className="text-2xl md:text-4xl font-light italic text-gray-900 leading-relaxed" value={item.text} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],text:v}; updateContent('items',n); }} /> : <p className="text-2xl md:text-4xl font-light italic text-gray-900 leading-relaxed">"{item.text}"</p>}
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gray-100 border-2 border-primary-50 overflow-hidden shadow-sm flex items-center justify-center">
                                <UserCircle className="w-full h-full text-gray-300" />
                            </div>
                            <div>
                                {isEdit ? <EditableText className="text-base md:text-lg font-black text-gray-900" value={item.author} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],author:v}; updateContent('items',n); }} /> : <div className="text-base md:text-lg font-black text-gray-900">{item.author}</div>}
                                <div className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{item.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
    return (
        <section className={`relative group ${isMobile ? 'py-16' : 'py-24'} px-6 bg-gray-50`}>
            {toolbar}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {content.items.map((item: any, i: number) => (
                    <div id={item.id} key={item.id || i} className="bg-white p-8 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-xl relative overflow-visible group/rev transition-all hover:shadow-2xl">
                        <div className="absolute -top-3 -left-3 w-10 h-10 md:w-12 md:h-12 bg-primary-600 text-white flex items-center justify-center rounded-xl shadow-lg rotate-[-12deg] group-hover/rev:rotate-0 transition-transform">
                            <Star className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                        </div>
                        <p className="text-gray-600 italic mb-6 md:mb-8 leading-relaxed text-base md:text-lg">"{item.text}"</p>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-100"><UserCircle className="w-6 h-6 text-gray-300" /></div>
                            <div>
                                <div className="font-black text-gray-900 text-sm">{item.author}</div>
                                <div className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};