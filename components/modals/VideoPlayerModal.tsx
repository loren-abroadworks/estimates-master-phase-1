
import React from 'react';
import { Modal } from '../UI';
import { Maximize } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  videoUrl?: string; // In a real app, this would be a YouTube/Vimeo embed URL
}

export const VideoPlayerModal = ({ isOpen, onClose, title, videoUrl }: VideoPlayerModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-xl overflow-hidden relative group">
             {/* Mock Video Player UI */}
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
                    <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1"></div>
                </div>
             </div>
             
             {/* Gradient Overlay */}
             <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
             
             {/* Controls Mock */}
             <div className="absolute bottom-0 inset-x-0 p-4 flex items-center gap-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="w-4 h-4 bg-white rounded-full cursor-pointer"></div>
                <div className="h-1 bg-white/30 flex-1 rounded-full overflow-hidden cursor-pointer">
                    <div className="h-full bg-primary-500 w-1/3"></div>
                </div>
                <span className="text-xs font-medium">04:20 / 12:30</span>
                <button className="text-white hover:text-white/80 transition-colors p-1" title={t('modals.VideoPlayerModal.fullscreen')}>
                    <Maximize className="w-5 h-5" />
                </button>
             </div>
             
             {/* Fallback Image / Placeholder */}
             <img 
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200" 
                className="w-full h-full object-cover opacity-60"
                alt={t('modals.VideoPlayerModal.videoThumbnail')}
             />
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-gray-900 dark:text-white mb-2">{t('modals.VideoPlayerModal.aboutThisTutorial')}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('modals.VideoPlayerModal.tutorialDescription')}
            </p>
        </div>
      </div>
    </Modal>
  );
};
