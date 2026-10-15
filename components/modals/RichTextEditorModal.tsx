
import React, { useState, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List } from 'lucide-react';
import { Modal, Button } from '../UI';
import { useTranslation } from '@/i18n/LanguageContext';

export const RichTextEditorModal = ({ isOpen, onClose, initialValue, onSave, title }: { isOpen: boolean, onClose: () => void, initialValue: string, onSave: (val: string) => void, title: string }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue);
    const contentRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
        if(isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    useEffect(() => {
        if(isOpen && contentRef.current) {
            // Check if value looks like HTML (contains tags)
            if (/<[a-z][\s\S]*>/i.test(value)) {
               contentRef.current.innerHTML = value;
            } else {
               // If basic text, preserve line breaks
               contentRef.current.innerHTML = value.replace(/\n/g, '<br/>');
            }
        }
    }, [isOpen, value]);
  
    const execCmd = (cmd: string) => {
      document.execCommand(cmd, false, undefined);
      contentRef.current?.focus();
    };
  
    const handleSave = () => {
        if (contentRef.current) {
             // Save formatted HTML to preserve structure
             onSave(contentRef.current.innerHTML); 
        }
        onClose();
    };
  
    if (!isOpen) return null;
  
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div className="space-y-4">
           <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 flex gap-2">
                 <button onClick={() => execCmd('bold')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title={t('modals.RichTextEditorModal.bold')}><Bold className="w-4 h-4" /></button>
                 <button onClick={() => execCmd('italic')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title={t('modals.RichTextEditorModal.italic')}><Italic className="w-4 h-4" /></button>
                 <button onClick={() => execCmd('underline')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title={t('modals.RichTextEditorModal.underline')}><Underline className="w-4 h-4" /></button>
                 <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                 <button onClick={() => execCmd('insertUnorderedList')} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300" title={t('modals.RichTextEditorModal.bulletList')}><List className="w-4 h-4" /></button>
              </div>
              <div 
                 ref={contentRef}
                 contentEditable
                 className="min-h-[200px] p-4 outline-none focus:bg-blue-50/10 dark:focus:bg-blue-900/10 transition-colors text-lg leading-relaxed max-h-[400px] overflow-y-auto prose prose-sm max-w-none text-gray-900 dark:text-gray-100"
                 onInput={(e) => setValue(e.currentTarget.innerHTML)}
              />
           </div>
           <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>{t('modals.RichTextEditorModal.cancel')}</Button>
              <Button onClick={handleSave}>{t('modals.RichTextEditorModal.saveChanges')}</Button>
           </div>
        </div>
      </Modal>
    );
  };

export default RichTextEditorModal;
