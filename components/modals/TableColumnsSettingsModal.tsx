
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Plus, Clock, CheckSquare, Hash, GripVertical, Settings2 } from 'lucide-react';
import { Modal, TextInput, InputGroup, Select, Button, Badge } from '../UI';
import { ExtraColumn, UnitType } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface TableColumnsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ExtraColumn[];
  onUpdateColumns: (cols: ExtraColumn[]) => void;
}

export const TableColumnsSettingsModal = ({ isOpen, onClose, columns, onUpdateColumns }: TableColumnsSettingsModalProps) => {
  const { t } = useTranslation();
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumn, setNewColumn] = useState<Partial<ExtraColumn>>({ label: '', type: 'hours', unit: UnitType.SQFT, visible: true });
  const [localColumns, setLocalColumns] = useState<ExtraColumn[]>(columns);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync props to local state when modal opens
  useEffect(() => {
      if (isOpen) {
          setLocalColumns(columns);
      }
  }, [isOpen, columns]);

  // Push changes to parent
  const updateColumns = (newCols: ExtraColumn[]) => {
      setLocalColumns(newCols);
      onUpdateColumns(newCols);
  };

  const toggleColumnVisibility = (id: string) => {
    updateColumns(localColumns.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const deleteColumn = (id: string) => {
    updateColumns(localColumns.filter(c => c.id !== id));
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newCols = [...localColumns];
    if (direction === 'up' && index > 0) {
      [newCols[index], newCols[index - 1]] = [newCols[index - 1], newCols[index]];
    } else if (direction === 'down' && index < newCols.length - 1) {
      [newCols[index], newCols[index + 1]] = [newCols[index + 1], newCols[index]];
    }
    updateColumns(newCols);
  };

  const handleAddColumn = () => {
    if (!newColumn.label) return;
    updateColumns([...localColumns, { 
      id: `col-${Date.now()}`, 
      label: newColumn.label, 
      type: newColumn.type || 'hours', 
      unit: newColumn.unit, 
      visible: true 
    }]);
    setNewColumn({ label: '', type: 'hours', unit: UnitType.SQFT, visible: true });
    setIsAddingColumn(false);
  };

  // DnD Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      
      const newCols = [...localColumns];
      const draggedItem = newCols[draggedIndex];
      newCols.splice(draggedIndex, 1);
      newCols.splice(index, 0, draggedItem);
      
      setLocalColumns(newCols); // Update local UI instantly
      setDraggedIndex(index);
  };

  const handleDragEnd = () => {
      setDraggedIndex(null);
      onUpdateColumns(localColumns); // Commit final order to parent
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modals.TableColumnsSettingsModal.title')}>
      <div className="space-y-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('modals.TableColumnsSettingsModal.description')}</p>
        {!isAddingColumn ? (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {localColumns.map((col, idx) => (
              <div 
                key={col.id} 
                className={`flex items-center justify-between p-3 border rounded-lg transition-all ${draggedIndex === idx ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 opacity-50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex items-center gap-3">
                  <div className="cursor-move text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 active:cursor-grabbing">
                      <GripVertical className="w-5 h-5" />
                  </div>
                  <button onClick={() => toggleColumnVisibility(col.id)} className={`p-2 rounded-lg transition-colors ${col.visible ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}>
                    {col.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${col.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{col.label}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {col.type === 'system' && <Badge color="gray">{t('modals.TableColumnsSettingsModal.badgeStandard')}</Badge>}
                      {col.type === 'hours' && <Badge color="blue">{t('modals.TableColumnsSettingsModal.badgeHours')}</Badge>}
                      {col.type === 'checkbox' && <Badge color="amber">{t('modals.TableColumnsSettingsModal.badgeCheckbox')}</Badge>}
                      {col.type === 'quantity' && <Badge color="green">{t('modals.TableColumnsSettingsModal.badgeQty', { unit: col.unit })}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1 mr-2">
                    <button 
                        disabled={idx === 0} 
                        onClick={() => moveColumn(idx, 'up')} 
                        className="p-1 text-gray-400 hover:text-primary-600 dark:text-gray-500 dark:hover:text-primary-400 disabled:opacity-30 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button 
                        disabled={idx === localColumns.length - 1} 
                        onClick={() => moveColumn(idx, 'down')} 
                        className="p-1 text-gray-400 hover:text-primary-600 dark:text-gray-500 dark:hover:text-primary-400 disabled:opacity-30 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  {!col.isLocked ? (
                      <button onClick={() => deleteColumn(col.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                  ) : (
                      <div className="w-8 h-8 flex items-center justify-center text-gray-200 dark:text-gray-700">
                          <Settings2 className="w-4 h-4" />
                      </div>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => setIsAddingColumn(true)} className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 font-bold hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2 text-sm mt-4">
              <Plus className="w-4 h-4" /> {t('modals.TableColumnsSettingsModal.addCustomColumn')}
            </button>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{t('modals.TableColumnsSettingsModal.newColumnDetails')}</h4>
            <TextInput label={t('modals.TableColumnsSettingsModal.columnTitle')} placeholder={t('modals.TableColumnsSettingsModal.columnTitlePlaceholder')} value={newColumn.label || ''} onChange={(v) => setNewColumn({...newColumn, label: v})} />
            <InputGroup label={t('modals.TableColumnsSettingsModal.columnType')}>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setNewColumn({...newColumn, type: 'hours'})} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${newColumn.type === 'hours' ? 'bg-white dark:bg-gray-900 border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm' : 'bg-gray-100 dark:bg-gray-700 border-transparent text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                  <Clock className="w-5 h-5 mb-2" />
                  <span className="font-bold text-xs">{t('modals.TableColumnsSettingsModal.badgeHours')}</span>
                </button>
                <button onClick={() => setNewColumn({...newColumn, type: 'checkbox'})} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${newColumn.type === 'checkbox' ? 'bg-white dark:bg-gray-900 border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm' : 'bg-gray-100 dark:bg-gray-700 border-transparent text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                  <CheckSquare className="w-5 h-5 mb-2" />
                  <span className="font-bold text-xs">{t('modals.TableColumnsSettingsModal.badgeCheckbox')}</span>
                </button>
                <button onClick={() => setNewColumn({...newColumn, type: 'quantity'})} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${newColumn.type === 'quantity' ? 'bg-white dark:bg-gray-900 border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm' : 'bg-gray-100 dark:bg-gray-700 border-transparent text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                  <Hash className="w-5 h-5 mb-2" />
                  <span className="font-bold text-xs">{t('modals.TableColumnsSettingsModal.typeQuantity')}</span>
                </button>
              </div>
            </InputGroup>
            {newColumn.type === 'quantity' && (
              <InputGroup label={t('modals.TableColumnsSettingsModal.unitType')}>
                <Select value={newColumn.unit || UnitType.SQFT} onChange={(v) => setNewColumn({...newColumn, unit: v as UnitType})} options={[{ label: t('modals.TableColumnsSettingsModal.unitSquareFeet'), value: UnitType.SQFT }, { label: t('modals.TableColumnsSettingsModal.unitLinearFeet'), value: UnitType.LNFT }, { label: t('modals.TableColumnsSettingsModal.unitItemCount'), value: UnitType.ITEM }]} />
              </InputGroup>
            )}
            <div className="flex gap-3 pt-4">
              <Button className="flex-1" onClick={handleAddColumn}>{t('modals.TableColumnsSettingsModal.saveColumn')}</Button>
              <Button variant="secondary" className="flex-1" onClick={() => setIsAddingColumn(false)}>{t('modals.TableColumnsSettingsModal.cancel')}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
