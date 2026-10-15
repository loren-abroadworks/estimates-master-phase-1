
import React, { useRef, useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { EditableText } from './EditableText';
import { SectionType } from '../types';

export const PaginatedHorizontalSection = ({ 
    id, 
    type, 
    content, 
    updateContent, 
    isPreview, 
    toolbar,
    isEdit,
    handleOpenIconPicker
}: { 
    id: string, 
    type: SectionType, 
    content: any, 
    updateContent: (f: string, v: any) => void, 
    isPreview: boolean, 
    toolbar: React.ReactNode,
    isEdit: boolean,
    handleOpenIconPicker: (id: string, index: number) => void
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 3;
    const totalPages = Math.ceil(content.items.length / itemsPerPage);

    const scrollToPage = (page: number) => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTo({ left: page * scrollRef.current.offsetWidth, behavior: 'smooth' });
        setCurrentPage(page);
    };

    useEffect(() => {
        const handleScroll = () => {
            if (!scrollRef.current) return;
            const page = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
            if (page !== currentPage) setCurrentPage(page);
        };
        const el = scrollRef.current;
        el?.addEventListener('scroll', handleScroll);
        return () => el?.removeEventListener('scroll', handleScroll);
    }, [currentPage]);

    const isReview = type === 'reviews';

    return (
        <section className={`relative group py-24 px-6 ${isReview ? 'bg-slate-50' : 'bg-white'} ${isPreview ? 'opacity-50' : ''}`}>
            {toolbar}
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    {isEdit ? <EditableText as="h2" className="text-3xl font-extrabold font-heading mb-4 text-gray-900" value={content.title} onChange={(v) => updateContent('title', v)} /> : <h2 className="text-3xl font-extrabold font-heading mb-4 text-gray-900">{content.title}</h2>}
                    {content.subtitle && (isEdit ? <EditableText className="text-gray-500 max-w-2xl mx-auto" value={content.subtitle} onChange={(v) => updateContent('subtitle', v)} /> : <p className="text-gray-500 max-w-2xl mx-auto">{content.subtitle}</p>)}
                </div>
                <div className="relative group/nav">
                    <div ref={scrollRef} className="flex gap-8 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory scroll-smooth">
                        {content.items.map((item: any, i: number) => (
                            <div key={i} className={`bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all relative group/item flex-shrink-0 snap-start w-[100%] md:w-[calc(33.333%-21.333px)]`}>
                                {isEdit && <button onClick={() => updateContent('items', content.items.filter((_: any, idx: number) => idx !== i))} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>}
                                {isReview ? (
                                    <>
                                        <div className="flex gap-1 text-amber-400 mb-4">{[...Array(5)].map((_, idx) => <Star key={idx} className="w-4 h-4 fill-current" />)}</div>
                                        {isEdit ? <EditableText as="p" className="text-gray-600 italic mb-6 leading-relaxed" value={item.text} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],text:v}; updateContent('items',n); }} /> : <p className="text-gray-600 italic mb-6 leading-relaxed">"{item.text}"</p>}
                                        <div>
                                            {isEdit ? <EditableText className="font-bold text-gray-900" value={item.author} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],author:v}; updateContent('items',n); }} /> : <div className="font-bold text-gray-900">{item.author}</div>}
                                            {isEdit ? <EditableText className="text-xs text-gray-400 font-bold uppercase tracking-wider" value={item.role} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],role:v}; updateContent('items',n); }} /> : <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">{item.role}</div>}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <button 
                                            disabled={!isEdit}
                                            onClick={() => isEdit && handleOpenIconPicker(id, i)}
                                            className={`w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 mb-6 group/icon relative ${isEdit ? 'hover:scale-105 transition-transform' : ''}`}
                                        >
                                            <item.icon className="w-7 h-7" />
                                        </button>
                                        {isEdit ? <EditableText as="h3" className="text-xl font-bold mb-3 text-gray-900" value={item.title} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],title:v}; updateContent('items',n); }} /> : <h3 className="text-xl font-bold mb-3 text-gray-900">{item.title}</h3>}
                                        {isEdit ? <EditableText className="text-gray-500 leading-relaxed" value={item.desc} onChange={(v) => { const n = [...content.items]; n[i]={...n[i],desc:v}; updateContent('items',n); }} /> : <p className="text-gray-500 leading-relaxed">{item.desc}</p>}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && <div className="flex justify-center gap-2 mt-8">{[...Array(totalPages)].map((_, i) => <button key={i} onClick={() => scrollToPage(i)} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentPage === i ? 'bg-primary-600 w-8' : 'bg-gray-200 hover:bg-gray-300'}`} />)}</div>}
                </div>
            </div>
        </section>
    );
};
