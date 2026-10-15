
import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, List, MapPin, X, Palette } from 'lucide-react';
import { EstimateArea } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface AreaNavigatorProps {
  areas: EstimateArea[];
}

export const AreaNavigator: React.FC<AreaNavigatorProps> = ({ areas }) => {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // --- Scroll to Area ---
  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Offset for sticky headers (AppHeader + Area Header approx 160px)
      const offset = 180; 
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setActiveId(id);
      setIsOpen(false);
    }
  };

  // --- Intersection Observer for Active State ---
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', 
      threshold: 0
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    areas.forEach((area) => {
      const el = document.getElementById(area.id);
      if (el) observer.observe(el);
    });
    
    // Also observe paint card
    const paintCard = document.getElementById('paint-card-section');
    if (paintCard) observer.observe(paintCard);

    return () => observer.disconnect();
  }, [areas]);

  return (
    <>
      {/* Floating Toggle Button - Positioned above Palette FAB (bottom-24) on mobile, bottom-6 on desktop */}
      <div className="fixed bottom-24 md:bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        
        {/* Menu Pop-up */}
        {isOpen && (
            <div className="mb-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200 flex flex-col max-h-[50vh] overflow-y-auto custom-scrollbar w-64 origin-bottom-right">
            <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1 flex justify-between items-center">
                <span>{t('widgets.AreaNavigator.jumpToSection')}</span>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
            </div>
            
            {/* Paint Card First */}
            <button
                onClick={() => scrollToId('paint-card-section')}
                className={`
                    w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-colors mb-1
                    ${activeId === 'paint-card-section' ? 'bg-primary-50 text-primary-800' : 'text-gray-600 hover:bg-gray-50'}
                `}
            >
                <Palette className="w-4 h-4 text-gray-400" />
                <span className="truncate">{t('widgets.AreaNavigator.paintColorCard')}</span>
            </button>
            
            {/* Only show divider if there are areas */}
            {areas.length > 0 && <div className="h-px bg-gray-100 mx-2 mb-1" />}

            {/* Then Areas */}
            {areas.map((area) => (
                <button
                key={area.id}
                onClick={() => scrollToId(area.id)}
                className={`
                    w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-colors
                    ${activeId === area.id ? 'bg-primary-50 text-primary-800' : 'text-gray-600 hover:bg-gray-50'}
                `}
                >
                <div className={`w-2 h-2 rounded-full ${activeId === area.id ? 'bg-primary-500' : 'bg-gray-300'}`} />
                <span className="truncate">{area.name}</span>
                </button>
            ))}
            </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            h-12 w-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 border border-white/20 backdrop-blur-md
            ${isOpen ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-700 hover:scale-110 hover:bg-white'}
          `}
          title={t('widgets.AreaNavigator.navigateAreas')}
        >
          {isOpen ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Backdrop when open */}
      {isOpen && (
        <div 
            className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[1px]" 
            onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
