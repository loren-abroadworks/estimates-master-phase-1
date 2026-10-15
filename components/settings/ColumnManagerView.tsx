
import React, { useState } from 'react';
import { Eye, EyeOff, Plus, Clock, CheckSquare, Hash, Settings2, Layout, Palette, Ruler, Beaker } from 'lucide-react';
import { Card, Button, KebabMenu, TextInput, InputGroup, Select, Badge, Modal, SearchInput } from '../UI';
import { GlobalSettings, ExtraColumn, UnitType } from '../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface ColumnManagerViewProps {
  settings: GlobalSettings;
  onUpdateSettings: (s: GlobalSettings) => void;
}

export const ColumnManagerView = ({ settings, onUpdateSettings }: ColumnManagerViewProps) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newColumn, setNewColumn] = useState<Partial<ExtraColumn>>({ label: '', type: 'hours', unit: UnitType.SQFT, visible: true });

  const toggleVisibility = (id: string) => {
    onUpdateSettings({
       ...settings,
       extraColumns: settings.extraColumns.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
    });
  };

  const deleteColumn = (id: string) => {
    onUpdateSettings({
        ...settings,
        extraColumns: settings.extraColumns.filter(c => c.id !== id)
    });
  };

  const handleAdd = () => {
    if (!newColumn.label) return;
    const col: ExtraColumn = {
        id: `col-${Date.now()}`,
        label: newColumn.label!,
        type: newColumn.type || 'hours',
        unit: newColumn.unit,
        visible: true
    };
    onUpdateSettings({
        ...settings,
        extraColumns: [...settings.extraColumns, col]
    });
    setNewColumn({ label: '', type: 'hours', unit: UnitType.SQFT, visible: true });
    setIsAdding(false);
  };

  const filteredColumns = settings.extraColumns.filter(col => 
    col.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    col.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-heading">{t('settings.ColumnManagerView.tableColumns')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-lg md:text-xl">{t('settings.ColumnManagerView.subtitle')}</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="shadow-lg shadow-primary-500/20 flex items-center w-full md:w-auto justify-center">
            <Plus className="w-5 h-5 mr-2" /> {t('settings.ColumnManagerView.addColumn')}
        </Button>
      </div>

      <div className="mb-8">
        <SearchInput 
            value={searchTerm} 
            onChange={setSearchTerm} 
            placeholder={t('settings.ColumnManagerView.searchPlaceholder')}
            className="md:max-w-md w-full" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {filteredColumns.map(col => {
             return (
             <Card key={col.id} className="p-4 flex items-center justify-between hover:shadow-md transition-all border-0 shadow-lg group bg-white dark:bg-gray-800">
                 <div className="flex items-center gap-3 flex-1 min-w-0">
                     <button 
                        onClick={() => toggleVisibility(col.id)}
                        className={`p-2 rounded-lg transition-colors shrink-0 ${col.visible ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                        title={col.visible ? t('settings.ColumnManagerView.hideColumn') : t('settings.ColumnManagerView.showColumn')}
                     >
                        {col.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                     </button>
                     
                     <div className="flex flex-col min-w-0">
                         <h4 className={`text-base font-bold font-heading truncate ${col.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{col.label}</h4>
                         <div className="flex flex-wrap gap-1 mt-1">
                             {col.type === 'system' && <Badge color="gray" className="text-[10px] px-1.5 py-0.5">{t('settings.ColumnManagerView.badgeSystem')}</Badge>}
                             {col.type === 'hours' && <Badge color="blue" className="text-[10px] px-1.5 py-0.5">{t('settings.ColumnManagerView.badgeHours')}</Badge>}
                             {col.type === 'checkbox' && <Badge color="amber" className="text-[10px] px-1.5 py-0.5">{t('settings.ColumnManagerView.badgeCheckbox')}</Badge>}
                             {col.type === 'quantity' && <Badge color="green" className="text-[10px] px-1.5 py-0.5">{t('settings.ColumnManagerView.badgeQty', { unit: col.unit })}</Badge>}
                         </div>
                     </div>
                 </div>
                 
                 <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-2">
                    <KebabMenu 
                        onDelete={!col.isLocked ? () => deleteColumn(col.id) : undefined} 
                        items={col.isLocked ? [] : undefined} 
                    />
                 </div>
             </Card>
         )})}
         
         {filteredColumns.length === 0 && (
             <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                   <Settings2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.ColumnManagerView.noColumnsFound')}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">{t('settings.ColumnManagerView.noColumnsHint')}</p>
                <Button onClick={() => setIsAdding(true)} variant="secondary" className="mt-6 w-full md:w-auto bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">{t('settings.ColumnManagerView.addNewColumn')}</Button>
             </div>
         )}
      </div>

      {/* Add Column Modal */}
      <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} title={t('settings.ColumnManagerView.modalTitle')}>
        <div className="space-y-6">
            <TextInput
                label={t('settings.ColumnManagerView.columnTitleLabel')}
                placeholder={t('settings.ColumnManagerView.columnTitlePlaceholder')}
                value={newColumn.label || ''} 
                onChange={(v) => setNewColumn({...newColumn, label: v})}
            />
            <InputGroup label={t('settings.ColumnManagerView.columnTypeLabel')}>
                <div className="grid grid-cols-3 gap-3">
                    <button 
                        onClick={() => setNewColumn({...newColumn, type: 'hours'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${newColumn.type === 'hours' ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}
                    >
                        <Clock className="w-6 h-6 mb-2" />
                        <span className="font-bold text-xs">{t('settings.ColumnManagerView.typeHoursInput')}</span>
                    </button>
                    <button 
                        onClick={() => setNewColumn({...newColumn, type: 'checkbox'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${newColumn.type === 'checkbox' ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}
                    >
                        <CheckSquare className="w-6 h-6 mb-2" />
                        <span className="font-bold text-xs">{t('settings.ColumnManagerView.badgeCheckbox')}</span>
                    </button>
                    <button 
                        onClick={() => setNewColumn({...newColumn, type: 'quantity'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${newColumn.type === 'quantity' ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}
                    >
                        <Hash className="w-6 h-6 mb-2" />
                        <span className="font-bold text-xs">{t('settings.ColumnManagerView.typeQuantity')}</span>
                    </button>
                </div>
            </InputGroup>
            
            {newColumn.type === 'quantity' && (
                    <InputGroup label={t('settings.ColumnManagerView.unitTypeLabel')}>
                    <Select 
                        value={newColumn.unit || UnitType.SQFT}
                        onChange={(v) => setNewColumn({...newColumn, unit: v as UnitType})}
                        options={[
                            { label: t('settings.ColumnManagerView.unitSqft'), value: UnitType.SQFT },
                            { label: t('settings.ColumnManagerView.unitLnft'), value: UnitType.LNFT },
                            { label: t('settings.ColumnManagerView.unitItem'), value: UnitType.ITEM }
                        ]}
                    />
                </InputGroup>
            )}

            <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <Button onClick={handleAdd} size="lg" className="w-full">{t('settings.ColumnManagerView.saveColumn')}</Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
