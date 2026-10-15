import React, { useState, useEffect } from 'react';
import { Modal, NumberInput, Button } from '../UI';
import { Layers, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface CoatSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseQuantity: number;
  coats: number;
  initialQuantities?: number[];
  onSave: (quantities: number[] | undefined) => void;
}

export const CoatSplitModal = ({ 
  isOpen, 
  onClose, 
  baseQuantity, 
  coats, 
  initialQuantities, 
  onSave 
}: CoatSplitModalProps) => {
  const { t } = useTranslation();
  const [quantities, setQuantities] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      const newQuantities = [];
      for (let i = 0; i < coats; i++) {
        // If we have a stored quantity for this coat, use it.
        // Otherwise, default to the base quantity.
        if (initialQuantities && initialQuantities.length > i) {
          newQuantities.push(initialQuantities[i]);
        } else {
          newQuantities.push(baseQuantity);
        }
      }
      setQuantities(newQuantities);
    }
  }, [isOpen, coats, baseQuantity, initialQuantities]);

  const handleQuantityChange = (index: number, value: number) => {
    const next = [...quantities];
    next[index] = value;
    setQuantities(next);
  };

  const handleSave = () => {
    onSave(quantities);
    onClose();
  };

  const handleReset = () => {
    const reset = Array(coats).fill(baseQuantity);
    setQuantities(reset);
  };

  const handleTurnOffSplit = () => {
    onSave(undefined);
    onClose();
  };

  const handleAddCoat = () => {
    setQuantities([...quantities, baseQuantity]);
  };

  const isSplitActive = initialQuantities && initialQuantities.length > 0;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.CoatSplitModal.title')} maxWidth="md:max-w-md">
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
          <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-bold mb-1">{t('modals.CoatSplitModal.advancedControl')}</p>
            <p>{t('modals.CoatSplitModal.helperText')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {quantities.map((qty, index) => (
            <div key={index} className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="w-24 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider pt-2">
                {t('modals.CoatSplitModal.coatLabel', { number: index + 1 })}
              </div>
              <div className="flex-1">
                <NumberInput 
                  value={qty} 
                  onChange={(v) => handleQuantityChange(index, v)} 
                  placeholder="0"
                />
              </div>
            </div>
          ))}
          <button 
            onClick={handleAddCoat}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-xs font-bold uppercase tracking-wider mt-2 group transition-all"
          >
            <div className="p-1 rounded-full bg-primary-50 dark:bg-primary-900/30 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50">
              <Plus className="w-3 h-3" />
            </div>
            {t('modals.CoatSplitModal.addCoat')}
          </button>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
          {isSplitActive ? (
            <button 
              onClick={handleTurnOffSplit}
              className="text-red-500 hover:text-red-700 text-sm font-medium hover:underline"
            >
              {t('modals.CoatSplitModal.turnOffSplit')}
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset} className="text-gray-500">{t('modals.CoatSplitModal.resetValues')}</Button>
            <button 
              onClick={handleSave} 
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg shadow-primary-500/20 transition-all active:scale-95"
            >
              {t('modals.CoatSplitModal.applySplit')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
