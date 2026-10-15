
import React, { useState } from 'react';
import {
  Paintbrush, Image as ImageIcon, Star, Users, File, Upload, PlusCircle, Quote, Layout, ChevronRight, Trash2, Link as LinkIcon, Type, Check, Hash, Plus, ChevronDown
} from 'lucide-react';
import { SectionType, VariantType, BuilderTab, PageSection, BrandingConfig, BRAND_COLORS, HEADING_FONTS, BODY_FONTS } from './types';
import { useTranslation } from '@/i18n/LanguageContext';

export const BuilderSidebar = ({ 
    sections,
    onUpdateSectionContent,
    branding,
    onUpdateBranding,
    onAddSection, 
    onDragStart, 
    onDragEnd 
}: { 
    sections: PageSection[],
    onUpdateSectionContent: (id: string, field: string, value: any) => void,
    branding: BrandingConfig,
    onUpdateBranding: (b: BrandingConfig) => void,
    onAddSection: (type: SectionType, variant: VariantType) => void, 
    onDragStart: (type: SectionType, variant: VariantType) => void, 
    onDragEnd: () => void 
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<BuilderTab>('Blocks');
    const isPresetColor = BRAND_COLORS.some(c => c.value.toLowerCase() === branding.primaryColor.toLowerCase());
    const [showCustomColorInput, setShowCustomColorInput] = useState(!isPresetColor);
    const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

    const toggleGroup = (group: string) => {
        setCollapsedGroups(prev => 
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    const marketingItems: { label: string, type: SectionType, icon: any }[] = [
        { label: t('views.PresentationBuilder.BuilderSidebar.heroHeaders'), type: 'hero', icon: ImageIcon },
        { label: t('views.PresentationBuilder.BuilderSidebar.expertise'), type: 'services', icon: Paintbrush },
        { label: t('views.PresentationBuilder.BuilderSidebar.portfolio'), type: 'portfolio', icon: ImageIcon },
        { label: t('views.PresentationBuilder.BuilderSidebar.clientReviews'), type: 'reviews', icon: Star },
        { label: t('views.PresentationBuilder.BuilderSidebar.artisanStory'), type: 'about', icon: Users },
    ];

    const headerSection = sections.find(s => s.type === 'header');
    const footerSection = sections.find(s => s.type === 'footer');
    const footerDescription = footerSection?.content?.description || '';

    const handleAddLink = (targetSection: PageSection) => {
        const links = targetSection.content.links || [];
        const newLinks = [...links, { label: t('views.PresentationBuilder.BuilderSidebar.newLink'), targetId: '' }];
        onUpdateSectionContent(targetSection.id, 'links', newLinks);
    };

    const handleUpdateLink = (targetSection: PageSection, index: number, field: string, value: string) => {
        const links = [...targetSection.content.links];
        links[index] = { ...links[index], [field]: value };
        onUpdateSectionContent(targetSection.id, 'links', links);
    };

    const handleRemoveLink = (targetSection: PageSection, index: number) => {
        const links = targetSection.content.links.filter((_: any, i: number) => i !== index);
        onUpdateSectionContent(targetSection.id, 'links', links);
    };

    const renderMiniPreview = (type: SectionType, variant: VariantType) => {
        const baseClass = "w-full h-16 rounded-lg mb-2 overflow-hidden relative border border-gray-100 transition-all group-hover:scale-[1.02] flex flex-col justify-center items-center p-2 text-center";
        
        switch (type) {
            case 'header':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-white flex flex-row justify-between items-center px-4`}>
                        <div className="w-8 h-4 bg-gray-100 rounded" />
                        <div className="flex gap-1">
                            {[1,2,3].map(i => <div key={i} className="w-4 h-1 bg-gray-200 rounded" />)}
                        </div>
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-slate-900 flex flex-row justify-between items-center px-4`}>
                        <div className="w-8 h-4 bg-white/20 rounded" />
                        <div className="w-12 h-4 bg-primary-600 rounded-full" />
                    </div>
                );
                return (
                    <div className={`${baseClass} bg-white flex-col gap-1`}>
                        <div className="w-12 h-6 bg-gray-100 rounded" />
                    </div>
                );
            case 'hero':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-slate-900 gap-1`}>
                        <div className="h-1 bg-white/20 w-1/4 rounded"></div>
                        <div className="h-2 bg-white w-3/4 rounded"></div>
                        <div className="h-3 bg-primary-600 w-1/3 rounded mt-1"></div>
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-gray-400 gap-0 overflow-hidden relative !items-start !justify-center pl-3`}>
                        <div className="absolute inset-0 bg-slate-800/60" />
                        <div className="relative z-10 w-2/3 h-10 bg-slate-900/90 border-l-2 border-primary-500 flex flex-col justify-center gap-0.5 p-1 text-left items-start shadow-xl">
                             <div className="h-1.5 bg-white w-full rounded-sm"></div>
                             <div className="h-0.5 bg-white/40 w-3/4 rounded-full"></div>
                             <div className="h-2 bg-primary-600 w-1/2 rounded-full mt-0.5"></div>
                        </div>
                    </div>
                );
                return (
                    <div className={`${baseClass} bg-white flex-row gap-2 items-center px-3 py-2 !justify-between`}>
                        <div className="flex-1 flex flex-col gap-1 items-start text-left min-w-0">
                            <div className="w-3 h-0.5 bg-primary-600 rounded-full mb-0.5" />
                            <div className="w-full h-1.5 bg-gray-900 rounded-sm" />
                            <div className="w-3/4 h-1.5 bg-gray-900 rounded-sm" />
                            <div className="w-full h-0.5 bg-gray-200 rounded-sm mt-0.5" />
                            <div className="w-8 h-1.5 bg-primary-600 rounded-full mt-1" />
                        </div>
                        <div className="w-12 h-10 bg-gray-100 rounded-md overflow-hidden shadow-sm relative shrink-0">
                             <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=100&auto=format&fit=crop)' }} />
                        </div>
                    </div>
                );
            case 'services':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-white flex flex-col items-center pt-2 gap-1.5`}>
                        <div className="flex flex-col items-center gap-1 w-full">
                            <div className="h-1.5 bg-gray-900 w-1/2 rounded-full" />
                            <div className="h-1 bg-gray-300 w-1/3 rounded-full" />
                        </div>
                        <div className="flex gap-1 w-full px-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex-1 bg-gray-50 border border-gray-100 rounded-sm h-8 flex flex-col items-center justify-center gap-0.5">
                                    <div className="w-2 h-2 bg-primary-100 rounded-full mb-0.5" />
                                    <div className="h-0.5 bg-gray-300 w-3/4 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-white flex flex-col items-center pt-2 gap-1.5`}>
                        <div className="h-1.5 bg-gray-900 w-1/2 rounded-full" />
                        <div className="h-1 bg-gray-300 w-1/3 rounded-full" />
                        <div className="grid grid-cols-4 gap-1 w-full px-2 h-full pb-1 items-stretch">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-gray-50 border border-gray-100 rounded-sm flex flex-col items-center justify-center gap-0.5 p-0.5">
                                    <div className="w-1.5 h-1.5 bg-primary-100 rounded-full mb-0.5" />
                                    <div className="h-0.5 bg-gray-200 w-full rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                );
                return (
                    <div className={`${baseClass} bg-slate-900 !justify-center !items-start px-4 gap-1.5`}>
                         {[1, 2, 3].map((i) => (
                             <div key={i} className="flex gap-2 w-full items-start">
                                 <div className="text-[6px] font-black text-primary-500 leading-tight mt-[1px]">0{i}</div>
                                 <div className="flex-1 flex flex-col gap-1 items-start">
                                     <div className="h-1 bg-white w-1/2 rounded-full opacity-90" />
                                     <div className="h-0.5 bg-white/30 w-full rounded-full" />
                                 </div>
                             </div>
                         ))}
                    </div>
                );
            case 'portfolio':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-white flex flex-col items-center pt-2 gap-1.5`}>
                        <div className="flex flex-col items-center gap-0.5 w-full">
                            <div className="h-1.5 bg-gray-800 w-1/2 rounded-full" />
                            <div className="h-1 bg-gray-300 w-1/3 rounded-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 w-full px-2 pb-1 h-full">
                             {[1, 2].map(i => (
                                 <div key={i} className="bg-gray-50 border border-gray-100 rounded-sm w-full h-full flex flex-col gap-0.5 p-0.5">
                                     <div className="bg-gray-200 w-full h-2/3 rounded-sm" />
                                     <div className="h-0.5 bg-gray-300 w-2/3 rounded-full" />
                                 </div>
                             ))}
                        </div>
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-gray-50 grid grid-cols-3 gap-1 p-1`}>
                        {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-300 rounded h-full" />)}
                    </div>
                );
                return (
                    <div className={`${baseClass} bg-slate-900 flex flex-col items-center justify-center gap-1.5`}>
                        <div className="h-0.5 bg-primary-500 w-1/4 rounded-full opacity-70" />
                        <div className="h-1.5 bg-white w-2/3 rounded-full" />
                        <div className="h-3 w-1/2 bg-primary-600 rounded-full mt-1 shadow-sm" />
                    </div>
                );
            case 'reviews':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-slate-50 flex flex-col items-center pt-2 gap-1`}>
                         <div className="h-1 bg-gray-400 w-1/2 rounded-full mb-0.5" />
                         <div className="flex gap-1 w-full px-2 h-full pb-1 items-stretch">
                             {[1, 2, 3].map(i => (
                                 <div key={i} className="flex-1 bg-white border border-gray-200 rounded-[2px] flex flex-col items-center justify-center gap-[1px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-[1px]">
                                     <div className="flex gap-[0.5px] mb-[1px]">
                                         {[1,2,3,4,5].map(s => <div key={s} className="w-[1.5px] h-[1.5px] bg-amber-400 rounded-full" />)}
                                     </div>
                                     <div className="h-[1px] bg-gray-300 w-3/4 rounded-full" />
                                     <div className="h-[1px] bg-gray-300 w-1/2 rounded-full" />
                                     <div className="h-[1px] bg-gray-900 w-1/3 rounded-full mt-[1px]" />
                                 </div>
                             ))}
                         </div>
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-white flex flex-col items-center justify-center gap-1.5 p-3`}>
                        <div className="w-5 h-5 bg-primary-50 rounded-md flex items-center justify-center mb-0.5">
                            <Quote className="w-3 h-3 text-primary-600 fill-current" />
                        </div>
                        <div className="flex flex-col gap-1 items-center w-full">
                            <div className="h-0.5 bg-gray-800 w-3/4 rounded-full" />
                            <div className="h-0.5 bg-gray-800 w-2/3 rounded-full" />
                            <div className="h-0.5 bg-gray-800 w-1/2 rounded-full" />
                        </div>
                    </div>
                );
                return (
                    <div className={`${baseClass} !flex-row bg-gray-50 gap-1 p-2 items-center justify-center overflow-hidden`}>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="relative flex-1 h-full bg-white border border-gray-200 rounded-[4px] shadow-sm flex flex-col justify-center px-1">
                                <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary-600 rounded-[2px] -rotate-12 z-10 shadow-sm flex items-center justify-center">
                                    <div className="w-0.5 h-0.5 bg-white rounded-full" />
                                </div>
                                <div className="space-y-[2px] w-full mt-1.5">
                                    <div className="h-[1.5px] bg-gray-300 w-full rounded-full" />
                                    <div className="h-[1.5px] bg-gray-300 w-5/6 rounded-full" />
                                    <div className="h-[1.5px] bg-gray-300 w-2/3 rounded-full" />
                                </div>
                                <div className="mt-1 flex items-center gap-1 w-full border-t border-gray-50 pt-0.5">
                                     <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                                     <div className="h-[1px] bg-gray-900 w-1/2 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'about':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-white !flex-row !justify-between !items-center !p-3 gap-2`}>
                        <div className="flex-1 flex flex-col items-start gap-0.5 overflow-hidden">
                            <div className="w-3 h-3 bg-blue-50 rounded-sm flex items-center justify-center mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 bg-primary-600 rounded-full opacity-50" />
                            </div>
                            <div className="w-full h-1 bg-gray-900 rounded-full" />
                            <div className="w-3/4 h-1 bg-gray-900 rounded-full" />
                            <div className="w-full h-0.5 bg-gray-200 rounded-full mt-0.5" />
                            <div className="w-5/6 h-0.5 bg-gray-200 rounded-full" />
                            <div className="flex gap-2 mt-1">
                                <div className="flex flex-col gap-px">
                                    <div className="w-2 h-1 bg-gray-900 rounded-full" />
                                    <div className="w-3 h-0.5 bg-gray-300 rounded-full" />
                                </div>
                                <div className="flex flex-col gap-px">
                                    <div className="w-2 h-1 bg-gray-900 rounded-full" />
                                    <div className="w-3 h-0.5 bg-gray-300 rounded-full" />
                                </div>
                            </div>
                        </div>
                        <div className="w-1/3 h-full relative flex items-center justify-center">
                            <div className="w-full aspect-square bg-gray-200 rounded-md rotate-6 shadow-sm mb-1" />
                            <div className="absolute bottom-0 -left-2 bg-white px-1 py-0.5 rounded border border-gray-100 shadow-sm flex items-center gap-0.5 z-10 scale-75 origin-bottom-left">
                                <div className="w-1.5 h-1.5 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                                    <div className="w-0.5 h-0.5 bg-current rounded-full" />
                                </div>
                                <div className="w-4 h-0.5 bg-gray-900 rounded-full" />
                            </div>
                        </div>
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-slate-900 flex-col items-center pt-2 gap-1`}>
                        <div className="h-1 bg-white w-2/3 rounded-full" />
                        <div className="h-0.5 bg-gray-500 w-1/2 rounded-full mb-1" />
                        <div className="flex gap-2 w-full px-4 justify-center">
                            <div className="w-6 h-5 rounded border border-white/20 flex flex-col items-center justify-center gap-0.5">
                                <div className="w-2 h-0.5 bg-white rounded-full" />
                                <div className="w-3 h-[1px] bg-primary-600 rounded-full" />
                            </div>
                            <div className="w-6 h-5 rounded border border-white/20 flex flex-col items-center justify-center gap-0.5">
                                <div className="w-2 h-0.5 bg-white rounded-full" />
                                <div className="w-3 h-[1px] bg-primary-600 rounded-full" />
                            </div>
                        </div>
                    </div>
                );
                return (
                    <div className={`${baseClass} bg-white flex-col gap-2 items-center`}>
                        <div className="w-8 h-8 rounded-full bg-primary-50" />
                        <div className="h-2 bg-gray-200 w-1/3 rounded" />
                    </div>
                );
            case 'footer':
                if (variant === 1) return (
                    <div className={`${baseClass} bg-white flex-col gap-2`}>
                        <div className="h-4 bg-gray-100 w-8" />
                        <div className="h-1 bg-gray-200 w-1/2" />
                    </div>
                );
                if (variant === 2) return (
                    <div className={`${baseClass} bg-slate-900 flex-row justify-between items-end p-3`}>
                        <div className="w-8 h-4 bg-white/20" />
                        <div className="w-12 h-6 bg-white/10" />
                    </div>
                );
                return (
                    <div className={`${baseClass} bg-gray-100`}>
                        <div className="h-4 bg-gray-400 w-12" />
                    </div>
                );
            default:
                return <div className={`${baseClass} bg-gray-50`}></div>;
        }
    };

    const renderLinkEditor = (targetSection: PageSection, isFooter: boolean) => (
        <div className="space-y-4">
            {targetSection.content.links.map((link: any, idx: number) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 relative group/link">
                    <button 
                        onClick={() => handleRemoveLink(targetSection, idx)}
                        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover/link:opacity-100 transition-opacity"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">{t('views.PresentationBuilder.BuilderSidebar.linkLabel')}</label>
                        <input
                            type="text"
                            value={link.label}
                            onChange={(e) => handleUpdateLink(targetSection, idx, 'label', e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 focus:border-primary-500 outline-none"
                            placeholder={t('views.PresentationBuilder.BuilderSidebar.linkLabelPlaceholder')}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">{isFooter ? t('views.PresentationBuilder.BuilderSidebar.linkUrl') : t('views.PresentationBuilder.BuilderSidebar.jumpTarget')}</label>
                        <div className="relative">
                            {isFooter ? (
                                <div className="relative">
                                    <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={link.targetId}
                                        onChange={(e) => handleUpdateLink(targetSection, idx, 'targetId', e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 focus:border-primary-500 outline-none"
                                        placeholder={t('views.PresentationBuilder.BuilderSidebar.urlPlaceholder')}
                                    />
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={link.targetId}
                                        onChange={(e) => handleUpdateLink(targetSection, idx, 'targetId', e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 focus:border-primary-500 outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">{t('views.PresentationBuilder.BuilderSidebar.selectSection')}</option>
                                        {sections.filter(s => s.type !== 'header' && s.type !== 'footer').map(s => {
                                            const label = s.content?.title || s.type.charAt(0).toUpperCase() + s.type.slice(1);
                                            return <option key={s.id} value={s.id}>{label}</option>
                                        })}
                                    </select>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            <button 
                onClick={() => handleAddLink(targetSection)}
                className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2"
            >
                <PlusCircle className="w-4 h-4" /> {t('views.PresentationBuilder.BuilderSidebar.addLink')}
            </button>
        </div>
    );

    return (
        <aside className="w-full lg:w-72 h-[45vh] lg:h-full border-t lg:border-t-0 lg:border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden print:hidden shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:shadow-none z-40 bg-white dark:bg-gray-900">
            {/* TABS */}
            <div className="grid grid-cols-4 lg:grid-cols-2 border-b border-gray-100 dark:border-gray-800">
                {([
                    { key: 'Headers' as BuilderTab, label: t('views.PresentationBuilder.BuilderSidebar.tabHeaders') },
                    { key: 'Footers' as BuilderTab, label: t('views.PresentationBuilder.BuilderSidebar.tabFooters') },
                    { key: 'Blocks' as BuilderTab, label: t('views.PresentationBuilder.BuilderSidebar.tabBlocks') },
                    { key: 'Branding' as BuilderTab, label: t('views.PresentationBuilder.BuilderSidebar.tabBranding') },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-3 lg:py-3 lg:border-r border-b lg:border-b border-gray-100 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                            activeTab === tab.key
                            ? 'text-primary-700 dark:text-primary-400 bg-white dark:bg-gray-900'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50/50 dark:bg-gray-800/50'
                        }`}
                    >
                        {tab.label}
                        {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6 pb-12">
                {activeTab === 'Headers' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('views.PresentationBuilder.BuilderSidebar.navigationLinks')}</h2>
                            <p className="text-[10px] text-gray-400 font-medium italic leading-relaxed">{t('views.PresentationBuilder.BuilderSidebar.navigationLinksDesc')}</p>
                        </div>
                        {!headerSection ? (
                            <div className="px-2 py-8 text-center text-gray-400 text-xs italic">{t('views.PresentationBuilder.BuilderSidebar.addHeaderFirst')}</div>
                        ) : renderLinkEditor(headerSection, false)}
                    </div>
                )}

                {activeTab === 'Footers' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('views.PresentationBuilder.BuilderSidebar.footerContent')}</h2>
                            <p className="text-[10px] text-gray-400 font-medium italic leading-relaxed">{t('views.PresentationBuilder.BuilderSidebar.footerContentDesc')}</p>
                        </div>
                        {!footerSection ? (
                            <div className="px-2 py-8 text-center text-gray-400 text-xs italic">{t('views.PresentationBuilder.BuilderSidebar.addFooterFirst')}</div>
                        ) : (
                            <div className="space-y-6">
                                <div className="px-2 space-y-1.5">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">{t('views.PresentationBuilder.BuilderSidebar.footerMessage')}</label>
                                    <textarea
                                        value={footerDescription}
                                        onChange={(e) => onUpdateSectionContent(footerSection.id, 'description', e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-400 dark:border-gray-500 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 focus:border-primary-500 outline-none h-24 resize-none"
                                        placeholder={t('views.PresentationBuilder.BuilderSidebar.footerMessagePlaceholder')}
                                    />
                                </div>
                                <div className="px-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-2 block">{t('views.PresentationBuilder.BuilderSidebar.footerLinks')}</label>
                                    {renderLinkEditor(footerSection, true)}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'Branding' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('views.PresentationBuilder.BuilderSidebar.visualStyle')}</h2>
                            <p className="text-[10px] text-gray-400 font-medium italic leading-relaxed">{t('views.PresentationBuilder.BuilderSidebar.visualStyleDesc')}</p>
                        </div>

                        {/* Primary Color */}
                        <div className="px-2 space-y-3">
                            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">{t('views.PresentationBuilder.BuilderSidebar.primaryBrandColor')}</label>
                            <div className="grid grid-cols-4 gap-2 mb-3">
                                {BRAND_COLORS.map(color => (
                                    <button 
                                        key={color.value}
                                        onClick={() => {
                                            setShowCustomColorInput(false);
                                            onUpdateBranding({ ...branding, primaryColor: color.value });
                                        }}
                                        className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center ${branding.primaryColor.toLowerCase() === color.value.toLowerCase() && !showCustomColorInput ? 'border-gray-900 dark:border-white scale-110 shadow-sm' : 'border-transparent'}`}
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                    >
                                        {branding.primaryColor.toLowerCase() === color.value.toLowerCase() && !showCustomColorInput && <Check className="w-3 h-3 text-white drop-shadow-sm" />}
                                    </button>
                                ))}
                                <button 
                                    onClick={() => setShowCustomColorInput(true)}
                                    className={`aspect-square rounded-lg border-2 transition-all flex flex-col items-center justify-center bg-white dark:bg-gray-800 ${showCustomColorInput ? 'border-gray-900 dark:border-white scale-110 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                                    title={t('views.PresentationBuilder.BuilderSidebar.otherColor')}
                                >
                                    {showCustomColorInput ? <Check className="w-3 h-3 text-gray-900 dark:text-white" /> : <Plus className="w-4 h-4 text-gray-400" />}
                                    <span className="text-[8px] font-black uppercase mt-0.5 leading-none text-gray-400">{t('views.PresentationBuilder.BuilderSidebar.other')}</span>
                                </button>
                            </div>
                            
                            {showCustomColorInput && (
                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 animate-in fade-in slide-in-from-top-1">
                                    <Hash className="w-3.5 h-3.5 text-gray-400" />
                                    <input 
                                        type="text"
                                        value={branding.primaryColor}
                                        onChange={(e) => onUpdateBranding({ ...branding, primaryColor: e.target.value })}
                                        className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 w-full"
                                        placeholder="#000000"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        {/* Fonts */}
                        <div className="px-2 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Type className="w-3 h-3" /> {t('views.PresentationBuilder.BuilderSidebar.headingFont')}</label>
                                <select 
                                    value={branding.headingFont}
                                    onChange={(e) => onUpdateBranding({ ...branding, headingFont: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-400 dark:border-gray-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none"
                                >
                                    {HEADING_FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2"><Type className="w-3 h-3" /> {t('views.PresentationBuilder.BuilderSidebar.bodyFont')}</label>
                                <select 
                                    value={branding.bodyFont}
                                    onChange={(e) => onUpdateBranding({ ...branding, bodyFont: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-400 dark:border-gray-500 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-200 outline-none"
                                >
                                    {BODY_FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Blocks' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('views.PresentationBuilder.BuilderSidebar.designBlocks')}</h2>
                            <p className="text-[10px] text-gray-400 font-medium italic leading-relaxed">{t('views.PresentationBuilder.BuilderSidebar.designBlocksDesc')}</p>
                        </div>
                        {marketingItems.map(item => {
                            const isCollapsed = collapsedGroups.includes(item.type);
                            return (
                                <div key={item.type} className="mb-2 border-b border-gray-100 dark:border-gray-800 last:border-0 pb-2">
                                    <button 
                                        onClick={() => toggleGroup(item.type)}
                                        className="flex items-center justify-between w-full px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <item.icon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{item.label}</span>
                                        </div>
                                        {isCollapsed ? 
                                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" /> : 
                                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                                        }
                                    </button>
                                    
                                    {!isCollapsed && (
                                        <div className="grid grid-cols-1 gap-3 px-1 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {[1, 2, 3].map((variant) => {
                                                return (
                                                    <button
                                                        key={variant}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData('sectionType', item.type);
                                                            e.dataTransfer.setData('variant', variant.toString());
                                                            onDragStart(item.type, variant as VariantType);
                                                        }}
                                                        onDragEnd={onDragEnd}
                                                        onClick={() => onAddSection(item.type, variant as VariantType)}
                                                        className="group relative flex flex-col items-center justify-center p-2 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-sm transition-all"
                                                    >
                                                        {renderMiniPreview(item.type, variant as VariantType)}
                                                        <span className="text-[10px] font-black text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors uppercase">{t('views.PresentationBuilder.BuilderSidebar.styleVariant', { variant })}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
};
