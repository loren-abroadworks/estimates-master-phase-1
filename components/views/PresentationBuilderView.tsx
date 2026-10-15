
import React, { useState, useEffect, useRef } from 'react';
import {
  Eye, Save, Edit2, Monitor, Smartphone, Plus, ArrowUp, ArrowDown, Trash2, Paintbrush, ImageIcon, Star, ArrowLeft
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { Button, Badge } from '../UI';
import { ClientViewVisibility, Attachment } from '../../types';
import { FilePreviewModal } from '../modals/FilePreviewModal';
import { PORTFOLIO_ITEMS, REVIEWS, SERVICES } from '../../data/mockData';
import { PageSection, SectionType, VariantType, BrandingConfig } from './PresentationBuilder/types';
import { BuilderSidebar } from './PresentationBuilder/BuilderSidebar';
import { ImagePickerModal } from './PresentationBuilder/modals/ImagePickerModal';
import { IconPickerModal } from './PresentationBuilder/modals/IconPickerModal';
import { HeroSection } from './PresentationBuilder/sections/HeroSection';
import { HeaderSection } from './PresentationBuilder/sections/HeaderSection';
import { FooterSection } from './PresentationBuilder/sections/FooterSection';
import { ServicesSection } from './PresentationBuilder/sections/ServicesSection';
import { PortfolioSection } from './PresentationBuilder/sections/PortfolioSection';
import { ReviewsSection } from './PresentationBuilder/sections/ReviewsSection';
import { AboutSection } from './PresentationBuilder/sections/AboutSection';
import { EstimateSection } from './PresentationBuilder/sections/EstimateSection';

export const PresentationBuilderView = ({ 
    data, 
    onBack, 
    onUpdateVisibility, 
    onReorder,
    onGlobalVisibility,
    onAcceptEstimate
}: { 
    data: any, 
    onBack: () => void, 
    onUpdateVisibility: (type: 'area' | 'row' | 'misc' | 'sundry', id: string, key: keyof ClientViewVisibility, value: boolean) => void,
    onReorder: (id: string, direction: 'up' | 'down') => void,
    onGlobalVisibility: (key: 'prices' | 'quantities' | 'coats', val: boolean) => void,
    onAcceptEstimate?: () => void
}) => {
  const { t } = useTranslation();
  const { projectInfo } = data;

  const [projectName, setProjectName] = useState(data.projectName || 'Untitled Presentation');
  const [viewDevice, setViewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [activeImageTarget, setActiveImageTarget] = useState<{ id: string, field: string, index?: number } | null>(null);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [activeIconTarget, setActiveIconTarget] = useState<{ id: string, index: number } | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingBlock, setDraggingBlock] = useState<{ type: SectionType, variant: VariantType } | null>(null);
  const [builderMode, setBuilderMode] = useState(true);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // --- BRANDING STATE ---
  const [branding, setBranding] = useState<BrandingConfig>({
      primaryColor: '#2563eb',
      headingFont: "'Manrope', sans-serif",
      bodyFont: "'Roboto', sans-serif"
  });

  // --- BUILDER STATE ---
  const [sections, setSections] = useState<PageSection[]>([
      { id: 'sec-head', type: 'header', variant: 1, content: { links: [
          { label: 'Proposal', targetId: 'sec-estimate' },
          { label: 'Reviews', targetId: 'sec-reviews' },
          { label: 'Portfolio', targetId: 'sec-portfolio' },
          { label: 'Artisan Story', targetId: 'sec-about' }
      ] } },
      { id: 'sec-hero', type: 'hero', variant: 1, content: { title: `Refining the Art of Finishing`, subtitle: `A complete vision for the ${projectInfo.name} project.`, bgImage: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=2070&auto=format&fit=crop' } },
      { id: 'sec-estimate', type: 'estimate', variant: 1, content: {} },
      { id: 'sec-services', type: 'services', variant: 1, content: { title: 'Our Core Expertise', subtitle: 'Delivering precision across every dimension of high-end finishing.', items: SERVICES.map(s => ({ ...s, id: `item-${Math.random()}` })) } },
      { id: 'sec-portfolio', type: 'portfolio', variant: 1, content: { title: 'Masterworks Gallery', subtitle: "A selection of our most transformative recent engagements.", items: PORTFOLIO_ITEMS.map(item => {
          const desc = item.id === 4 ? "This interior project showcases our commitment to precision and quality. The result is a beautifully refreshed space that exceeds expectations." : `This ${item.category.toLowerCase()} project showcases our commitment to precision and quality. The result is a beautifully refreshed space that exceeds expectations.`;
          const image = item.id === 4 ? "https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=800&auto=format&fit=crop" : item.image;
          return { ...item, image, description: desc, id: `item-${Math.random()}` };
      }) } },
      { id: 'sec-reviews', type: 'reviews', variant: 1, content: { title: 'Client Perspectives', items: REVIEWS.map(r => ({ ...r, id: `item-${Math.random()}` })) } },
      { id: 'sec-about', type: 'about', variant: 1, content: { 
          title: 'About Precision Paintworks', 
          subtitle: "Founded in 2010, Precision Paintworks began with a simple mission: to deliver superior painting results with customer service that is unmatched in the industry.", 
          body: "We believe that your home is your sanctuary. That's why our team of licensed and insured professionals treats every project with the utmost respect, ensuring a clean workspace and a flawless finish every time.",
          licenseTitle: "Fully Licensed & Insured",
          licenseNumber: "License #12345678",
          stats: [{ label: 'YEARS EXPERIENCE', value: '15+' }, { label: 'PROJECTS COMPLETED', value: '500+' }], 
          imageUrl: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=80&w=800&auto=format&fit=crop' 
      } },
      { id: 'sec-foot', type: 'footer', variant: 1, content: { 
          description: "Dedicated to the highest expression of decorative finishing and protection.",
          links: [
            { label: 'Instagram', targetId: 'https://instagram.com' },
            { label: 'LinkedIn', targetId: 'https://linkedin.com' },
            { label: 'Houzz', targetId: 'https://houzz.com' }
          ] 
      } },
  ]);

  // Handle auto-scroll
  useEffect(() => {
    if (lastAddedId) {
        const element = document.getElementById(lastAddedId);
        if (element) {
            // Wait slightly for DOM to update
            setTimeout(() => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
        setLastAddedId(null);
    }
  }, [lastAddedId, sections]);

  // --- ACTIONS ---
  const getGhostContent = (type: SectionType, variant: VariantType) => {
      let content: any = { title: 'New ' + type.charAt(0).toUpperCase() + type.slice(1) + ' Section', subtitle: 'Add more details here' };
      if (type === 'hero') content = { title: 'New Title Section', subtitle: 'A professional headline for your project.', bgImage: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=2070&auto=format&fit=crop' };
      if (type === 'services') content = { title: 'Tailored Services', subtitle: 'A curated approach to finishing.', items: SERVICES.slice(0, 4).map(s => ({ ...s, id: `item-${Math.random()}` })) };
      if (type === 'portfolio') content = { title: 'Project Successes', subtitle: 'Craftsmanship at every scale.', items: PORTFOLIO_ITEMS.slice(0, 3).map(item => ({ ...item, id: `item-${Math.random()}`, description: `This ${item.category.toLowerCase()} project showcases our commitment to precision and quality.` })) };
      if (type === 'reviews') content = { title: 'What Clients Say', items: REVIEWS.slice(0, 3).map(r => ({ ...r, id: `item-${Math.random()}` })) };
      if (type === 'about') content = { 
          title: 'About Precision Paintworks', 
          subtitle: "Founded in 2010, Precision Paintworks began with a simple mission: to deliver superior painting results.", 
          body: "We believe that your home is your sanctuary. That's why our team of professionals treats every project with respect.",
          licenseTitle: "Fully Licensed & Insured",
          licenseNumber: "License #12345678",
          stats: [{ label: 'YEARS EXPERIENCE', value: '15+' }, { label: 'PROJECTS COMPLETED', value: '500+' }], 
          imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop' 
      };
      if (type === 'header') content = { links: [] };
      if (type === 'footer') content = { links: [], description: "Dedicated to excellence." };
      return content;
  };

  const addSection = (type: SectionType, variant: VariantType, index?: number) => {
      const newId = `sec-${Date.now()}`;
      const newSection: PageSection = {
          id: newId,
          type,
          variant,
          content: getGhostContent(type, variant)
      };
      
      const next = [...sections];
      if (index !== undefined) {
          next.splice(index, 0, newSection);
      } else {
          const footerIdx = next.findIndex(s => s.type === 'footer');
          if (footerIdx !== -1) {
              next.splice(footerIdx, 0, newSection);
          } else {
              next.push(newSection);
          }
      }
      setSections(next);
      setLastAddedId(newId);
      setDraggingBlock(null);
      setDragOverIndex(null);
  };

  const updateSectionContent = (id: string, field: string, value: any) => {
      setSections(prev => prev.map(s => s.id === id ? { ...s, content: { ...s.content, [field]: value } } : s));
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
      const idx = sections.findIndex(s => s.id === id);
      if (idx === -1) return;
      const newSections = [...sections];
      if (direction === 'up' && idx > 0) {
          [newSections[idx], newSections[idx - 1]] = [newSections[idx - 1], newSections[idx]];
      } else if (direction === 'down' && idx < sections.length - 1) {
          [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
      }
      setSections(newSections);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const handleOpenImagePicker = (id: string, field: string, index?: number) => {
      setActiveImageTarget({ id, field, index });
      setIsImagePickerOpen(true);
  };

  const handleImageSelect = (url: string) => {
      if (!activeImageTarget) return;
      const { id, field, index } = activeImageTarget;
      
      if (index !== undefined) {
          const section = sections.find(s => s.id === id);
          if (section) {
              const nextItems = [...section.content.items];
              nextItems[index] = { ...nextItems[index], [field]: url };
              updateSectionContent(id, 'items', nextItems);
          }
      } else {
          updateSectionContent(id, field, url);
      }
      setIsImagePickerOpen(false);
      setActiveImageTarget(null);
  };

  const handleOpenIconPicker = (id: string, index: number) => {
      setActiveIconTarget({ id, index });
      setIsIconPickerOpen(true);
  };

  const handleIconSelect = (Icon: any) => {
      if (!activeIconTarget) return;
      const { id, index } = activeIconTarget;
      const section = sections.find(s => s.id === id);
      if (section) {
          const nextItems = [...section.content.items];
          nextItems[index] = { ...nextItems[index], icon: Icon };
          updateSectionContent(id, 'items', nextItems);
      }
      setIsIconPickerOpen(false);
      setActiveIconTarget(null);
  };

  const handleSidebarDragStart = (type: SectionType, variant: VariantType) => {
      setDraggingBlock({ type, variant });
  };

  const handleDropToCanvas = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('sectionType') as SectionType;
    const variant = parseInt(e.dataTransfer.getData('variant')) as VariantType;
    if (type && !isNaN(variant)) {
        addSection(type, variant as VariantType, index);
    }
  };

  const renderSection = (section: PageSection, isPreview = false) => {
    const { id, type, variant, content } = section;
    const updateContent = (field: string, value: any) => updateSectionContent(id, field, value);
    const isEdit = builderMode && !isPreview;

    const Toolbar = () => {
        if (isPreview || type === 'header' || type === 'footer' || !builderMode) return null;
        return (
            <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                {(type === 'hero' || type === 'about') && (
                    <button 
                        onClick={() => handleOpenImagePicker(id, type === 'hero' ? 'bgImage' : 'imageUrl')}
                        className="p-2 bg-white text-gray-600 rounded-lg shadow-lg border border-gray-200 hover:text-primary-600 transition-all flex items-center gap-2 px-3"
                    >
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{t('views.PresentationBuilderView.image')}</span>
                    </button>
                )}
                {(type === 'services' || type === 'portfolio' || type === 'reviews') && (
                    <button 
                        onClick={() => {
                            const newItemId = `item-${Date.now()}`;
                            if (type === 'services') updateSectionContent(id, 'items', [...content.items, { id: newItemId, title: 'New Service', desc: 'Description here', icon: Paintbrush }]);
                            if (type === 'portfolio') updateSectionContent(id, 'items', [...content.items, { id: newItemId, title: 'Modern Interior', category: 'Interior', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800', description: 'Describe the project details here...' }]);
                            if (type === 'reviews') updateSectionContent(id, 'items', [...content.items, { id: newItemId, author: 'New Client', role: 'Homeowner', text: 'Amazing work!', rating: 5 }]);
                            setLastAddedId(newItemId);
                        }} 
                        className="p-2 bg-primary-600 text-white rounded-lg shadow-lg border border-primary-500 hover:bg-primary-700 transition-all flex items-center gap-2 px-3"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{t('views.PresentationBuilderView.addItem')}</span>
                    </button>
                )}
                <button onClick={() => moveSection(id, 'up')} className="p-2 bg-white text-gray-600 rounded-lg shadow-lg border border-gray-200 hover:text-primary-600 transition-all"><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => moveSection(id, 'down')} className="p-2 bg-white text-gray-600 rounded-lg shadow-lg border border-gray-200 hover:text-primary-600 transition-all"><ArrowDown className="w-4 h-4" /></button>
                {type !== 'estimate' && (
                    <button onClick={() => removeSection(id)} className="p-2 bg-white text-red-600 rounded-lg shadow-lg border border-gray-200 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                )}
            </div>
        );
    };

    switch (type) {
        case 'header': return <HeaderSection variant={variant} content={content} viewDevice={viewDevice} />;
        case 'footer': return <FooterSection variant={variant} content={content} toolbar={<Toolbar />} />;
        case 'hero': return <HeroSection variant={variant} content={content} updateContent={updateContent} toolbar={<Toolbar />} isEdit={isEdit} />;
        case 'services': return <ServicesSection id={id} variant={variant} content={content} updateContent={updateContent} toolbar={<Toolbar />} isEdit={isEdit} isPreview={isPreview} handleOpenIconPicker={handleOpenIconPicker} viewDevice={viewDevice} />;
        case 'portfolio': return <PortfolioSection id={id} variant={variant} content={content} updateContent={updateContent} toolbar={<Toolbar />} isEdit={isEdit} handleOpenImagePicker={handleOpenImagePicker} viewDevice={viewDevice} />;
        case 'reviews': return <ReviewsSection id={id} variant={variant} content={content} updateContent={updateContent} toolbar={<Toolbar />} isEdit={isEdit} isPreview={isPreview} handleOpenIconPicker={handleOpenIconPicker} viewDevice={viewDevice} />;
        case 'about': return <AboutSection id={id} variant={variant} content={content} updateContent={updateContent} toolbar={<Toolbar />} isEdit={isEdit} viewDevice={viewDevice} />;
        case 'estimate': return <EstimateSection toolbar={<Toolbar />} data={data} id={id} viewDevice={viewDevice} />;
        default: return null;
    }
  };

  const getCanvasStyles = () => {
      return {
          '--p-primary': branding.primaryColor,
          '--p-heading-font': branding.headingFont,
          '--p-body-font': branding.bodyFont,
      } as React.CSSProperties;
  };

  return (
    <div className="h-full flex flex-col font-sans text-gray-900 bg-white dark:bg-gray-950 dark:text-white overflow-hidden">
      <FilePreviewModal file={viewingAttachment} onClose={() => setViewingAttachment(null)} />

      <ImagePickerModal isOpen={isImagePickerOpen} onClose={() => setIsImagePickerOpen(false)} onSelect={handleImageSelect} />
      <IconPickerModal isOpen={isIconPickerOpen} onClose={() => setIsIconPickerOpen(false)} onSelect={handleIconSelect} />
      
      {/* STYLE OVERRIDES */}
      <style>{`
          .canvas-wrapper {
              font-family: var(--p-body-font);
          }
          .canvas-wrapper h1, .canvas-wrapper h2, .canvas-wrapper h3, .canvas-wrapper h4, .canvas-wrapper .font-heading {
              font-family: var(--p-heading-font);
          }
          .canvas-wrapper .bg-primary-600 {
              background-color: var(--p-primary) !important;
          }
          .canvas-wrapper .text-primary-600 {
              color: var(--p-primary) !important;
          }
          .canvas-wrapper .border-primary-600 {
              border-color: var(--p-primary) !important;
          }
      `}</style>

      {/* GLOBAL TOOLBAR */}
      <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex justify-between items-center z-50 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)] h-16 relative">
          
          {/* Left: Title & Badge */}
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 group">
                  <div className="grid items-center justify-items-start relative max-w-[300px] sm:max-w-[400px] lg:max-w-[500px]">
                      <span className="col-start-1 row-start-1 font-extrabold text-lg tracking-tight leading-none px-0 py-1 invisible whitespace-pre overflow-hidden text-ellipsis border-b border-transparent">
                          {projectName || t('views.PresentationBuilderView.presentationName')}
                      </span>
                      <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="col-start-1 row-start-1 w-full font-extrabold text-gray-900 dark:text-white text-lg tracking-tight leading-none bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-500 focus:ring-0 outline-none transition-all px-0 py-1 truncate"
                          placeholder={t('views.PresentationBuilderView.presentationName')}
                      />
                  </div>
                  
                  <Edit2 className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shrink-0" />
                  <Badge color="blue" className="text-[10px] py-0.5 px-2 uppercase tracking-wider shrink-0">{t('views.PresentationBuilderView.draft')}</Badge>
              </div>
          </div>

          {/* Center: Device Toggles */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
              <button onClick={() => setViewDevice('desktop')} className={`p-1.5 px-3 rounded-md transition-all flex items-center gap-2 ${viewDevice === 'desktop' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} title={t('views.PresentationBuilderView.desktopView')}><Monitor className="w-4 h-4" /></button>
              <button onClick={() => setViewDevice('mobile')} className={`p-1.5 px-3 rounded-md transition-all flex items-center gap-2 ${viewDevice === 'mobile' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`} title={t('views.PresentationBuilderView.mobileView')}><Smartphone className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-3">
              <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mr-2">
                  <ArrowLeft className="w-4 h-4" /> {t('views.PresentationBuilderView.back')}
              </button>
              <Button 
                  onClick={() => setBuilderMode(!builderMode)}
                  className="h-9 text-xs font-bold shadow-sm px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  size="sm"
                  variant="secondary"
              >
                  {builderMode ? (
                      <>
                          <Eye className="w-3.5 h-3.5 mr-2" /> {t('views.PresentationBuilderView.preview')}
                      </>
                  ) : (
                      <>
                          <Edit2 className="w-3.5 h-3.5 mr-2" /> {t('views.PresentationBuilderView.editor')}
                      </>
                  )}
              </Button>

              <Button onClick={onBack} className="shadow-lg shadow-primary-500/20 px-6 h-9 text-xs rounded-lg font-bold" size="sm">
                  <Save className="w-3.5 h-3.5 mr-2" /> {t('views.PresentationBuilderView.saveAndExit')}
              </Button>
          </div>
      </div>

      <div className="flex flex-col-reverse lg:flex-row flex-1 overflow-hidden relative z-0">
          {builderMode && (
             <BuilderSidebar 
                sections={sections}
                onUpdateSectionContent={updateSectionContent}
                branding={branding}
                onUpdateBranding={setBranding}
                onAddSection={addSection} 
                onDragStart={(type, v) => setDraggingBlock({ type, variant: v })}
                onDragEnd={() => setDraggingBlock(null)}
             />
          )}

          <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-950 relative">
              <main className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 py-0 flex flex-col items-center">
                  <div onDragOver={(e) => e.preventDefault()} style={getCanvasStyles()} className={`canvas-wrapper transition-all duration-500 bg-white shadow-2xl relative flex flex-col ${viewDevice === 'mobile' ? 'w-[375px] h-[720px] rounded-[3rem] ring-[12px] ring-gray-900 ring-offset-4 overflow-y-auto mb-12 custom-scrollbar scroll-smooth' : 'w-full max-w-7xl rounded-xl min-h-[800px] mt-4 md:mt-8 mb-8 md:mb-12'}`}>
                    <div className="flex flex-col flex-grow">
                        {builderMode && (
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(0); }}
                            onDragLeave={() => setDragOverIndex(null)}
                            onDrop={(e) => handleDropToCanvas(e, 0)}
                            className={`transition-all duration-300 relative group/drop border-y border-transparent border-dashed overflow-visible ${draggingBlock ? (dragOverIndex === 0 ? 'min-h-[25rem] bg-primary-50/30 border-primary-300 py-8' : 'h-12 bg-gray-50/50') : 'h-0'}`}
                        >
                            <div className={`absolute top-4 inset-x-0 flex items-center justify-center transition-opacity pointer-events-none ${draggingBlock ? 'opacity-100' : 'opacity-0'}`}>
                                <div className={`bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg z-50 transition-transform ${dragOverIndex === 0 ? 'scale-110' : 'scale-100'}`}>
                                    {t('views.PresentationBuilderView.dropHereToAddToTop')}
                                </div>
                            </div>
                            {draggingBlock && dragOverIndex === 0 && (
                                <div className="opacity-40 grayscale pointer-events-none scale-75 origin-center transition-all duration-300">
                                    {renderSection({ id: 'ghost', type: draggingBlock.type, variant: draggingBlock.variant, content: getGhostContent(draggingBlock.type, draggingBlock.variant) }, true)}
                                </div>
                            )}
                        </div>
                        )}

                        {sections.map((section, idx) => (
                            <React.Fragment key={section.id}>
                                <div id={section.id} className={`${section.type === 'header' ? 'sticky top-0 z-[45]' : 'relative'} group border-b border-transparent transition-all shrink-0`}>
                                    {renderSection(section)}
                                </div>
                                
                                {builderMode && (
                                <div 
                                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx + 1); }}
                                    onDragLeave={() => setDragOverIndex(null)}
                                    onDrop={(e) => handleDropToCanvas(e, idx + 1)}
                                    className={`transition-all duration-300 relative group/drop border-y border-transparent border-dashed overflow-visible ${draggingBlock ? (dragOverIndex === idx + 1 ? 'min-h-[25rem] bg-primary-50/30 border-primary-300 py-8' : 'h-12 bg-gray-50/50') : 'h-0'}`}
                                >
                                    <div className={`absolute top-4 inset-x-0 flex items-center justify-center transition-opacity pointer-events-none ${draggingBlock ? 'opacity-100' : 'opacity-0'}`}>
                                        <div className={`bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg z-50 transition-transform ${dragOverIndex === idx + 1 ? 'scale-110' : 'scale-100'}`}>
                                            {t('views.PresentationBuilderView.insertBlockHere')}
                                        </div>
                                    </div>
                                    {draggingBlock && dragOverIndex === idx + 1 && (
                                        <div className="opacity-40 grayscale pointer-events-none scale-75 origin-center transition-all duration-300">
                                            {renderSection({ id: 'ghost', type: draggingBlock.type, variant: draggingBlock.variant, content: getGhostContent(draggingBlock.type, draggingBlock.variant) }, true)}
                                        </div>
                                    )}
                                </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                  </div>
              </main>
          </div>
      </div>
    </div>
  );
};
