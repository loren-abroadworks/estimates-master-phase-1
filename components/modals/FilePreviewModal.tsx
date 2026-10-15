
import React from 'react';
import { X, Download } from 'lucide-react';
import { Attachment } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

export const FilePreviewModal = ({ file, onClose }: { file: Attachment | null, onClose: () => void }) => {
    const { t } = useTranslation();
    if (!file) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200 backdrop-blur-sm" onClick={onClose}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 text-white bg-black/50" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col">
                    <h3 className="font-bold text-lg truncate pr-4 text-white">{file.name}</h3>
                    <span className="text-xs text-gray-400">{file.date} • {file.size || t('modals.FilePreviewModal.unknownSize')}</span>
                </div>
                <div className="flex items-center gap-4">
                    {file.url && (
                        <a 
                            href={file.url} 
                            download 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                            title={t('modals.FilePreviewModal.download')}
                        >
                            <Download className="w-5 h-5" />
                        </a>
                    )}
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white bg-white/5"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
                <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {file.type === 'image' ? (
                        <img 
                            src={file.url} 
                            alt={file.name} 
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm animate-in zoom-in-95 duration-300" 
                        />
                    ) : (
                        <iframe 
                            src={file.url} 
                            className="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl" 
                            title={file.name}
                        ></iframe>
                    )}
                </div>
            </div>
        </div>
    );
};
