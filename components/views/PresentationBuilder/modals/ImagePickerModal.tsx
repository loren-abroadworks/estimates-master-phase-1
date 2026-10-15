
import React, { useState } from 'react';
import { Modal, Button } from '../../../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const ImagePickerModal = ({ 
    isOpen, 
    onClose, 
    onSelect 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSelect: (url: string) => void 
}) => {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const [images, setImages] = useState([
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1616594039964-40891a909d72?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?q=80&w=2070&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop"
    ]);

    const handleUpload = () => {
        setUploading(true);
        setTimeout(() => {
            const newImg = "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=800&auto=format&fit=crop";
            setImages([newImg, ...images]);
            setUploading(false);
        }, 1200);
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('views.PresentationBuilder.modals.ImagePickerModal.selectImage')} maxWidth="max-w-4xl">
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{t('views.PresentationBuilder.modals.ImagePickerModal.library')}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('views.PresentationBuilder.modals.ImagePickerModal.chooseFromExisting')}</p>
                    </div>
                    <Button onClick={handleUpload} disabled={uploading}>
                        {uploading ? t('views.PresentationBuilder.modals.ImagePickerModal.uploading') : t('views.PresentationBuilder.modals.ImagePickerModal.uploadNew')}
                    </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto custom-scrollbar p-1">
                    {images.map((img, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => onSelect(img)}
                            className="aspect-video rounded-xl overflow-hidden cursor-pointer hover:ring-4 ring-primary-500/30 border border-gray-100 dark:border-gray-700 group transition-all"
                        >
                            <img src={img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={t('views.PresentationBuilder.modals.ImagePickerModal.libraryImageAlt', { idx })} />
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
