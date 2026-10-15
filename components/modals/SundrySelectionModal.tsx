
import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Modal } from '../UI';
import { Material } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface SundrySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  existingSundryIds: string[];
  onSelect: (material: Material) => void;
  onCreateNew: () => void;
}

export const SundrySelectionModal = ({ isOpen, onClose, materials, existingSundryIds, onSelect, onCreateNew }: SundrySelectionModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const availableMaterials = materials
    .filter(m => !['Paint', 'Primer', 'Stain'].includes(m.category))
    .filter(m => !existingSundryIds.includes(m.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.SundrySelectionModal.selectMaterialToAdd')}>
      <div className="space-y-4">
        <div className="p-3 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded-lg mb-4 border border-primary-100 dark:border-primary-800 flex justify-between items-center text-sm">
          <span>{t('modals.SundrySelectionModal.cantFindWhat')}</span>
          <Button size="sm" onClick={onCreateNew} className="bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20">{t('modals.SundrySelectionModal.createNew')}</Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-2">
          {availableMaterials.map(mat => (
            <button key={mat.id} onClick={() => onSelect(mat)} className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all group">
              <div className="text-left">
                <div className="font-bold text-gray-900 dark:text-white text-sm">{mat.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{mat.containers[0]?.sizeLabel} - ${mat.containers[0]?.price.toFixed(2)}</div>
              </div>
              <Plus className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
            </button>
          ))}
          {availableMaterials.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-6">{t('modals.SundrySelectionModal.noMaterialsAvailable')}</p>}
        </div>
      </div>
    </Modal>
  );
};
