
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, TextInput, Button, Select } from '../UI';
import { PaintColorEntry, Material, EstimateArea, GlobalSettings } from '../../types';
import { Trash2, AlertCircle, Palette, Droplets, X } from 'lucide-react';
import { calculateMaterial } from '../../services/calcEngine';
import { useTranslation } from '@/i18n/LanguageContext';

interface ManageColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (color: Partial<PaintColorEntry>) => void;
  onDelete?: (id: string) => void;
  onUnassignSurface: (areaId: string, rowId: string) => void;
  initialColor?: PaintColorEntry;
  materials: Material[];
  estimateAreas: EstimateArea[];
  settings: GlobalSettings;
}

const COMMON_SHEENS = [
    { label: 'Flat', value: 'Flat' },
    { label: 'Matte', value: 'Matte' },
    { label: 'Eggshell', value: 'Eggshell' },
    { label: 'Satin', value: 'Satin' },
    { label: 'Low Lustre', value: 'Low Lustre' },
    { label: 'Semi-Gloss', value: 'Semi-Gloss' },
    { label: 'Gloss', value: 'Gloss' },
    { label: 'High Gloss', value: 'High Gloss' },
];

export const ManageColorModal = ({ isOpen, onClose, onSave, onDelete, onUnassignSurface, initialColor, materials, estimateAreas, settings }: ManageColorModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<PaintColorEntry>>({
    colorCode: '',
    colorName: '',
    brand: '',
    productId: '',
    finish: ''
  });

  useEffect(() => {
    if (isOpen) {
        if (initialColor) {
            setFormData(initialColor);
        } else {
            setFormData({
                colorCode: '', 
                colorName: '',
                brand: '',
                productId: '',
                finish: ''
            });
        }
    }
  }, [isOpen, initialColor]);

  // Derived Lists
  const brands = useMemo(() => {
      const b = new Set<string>();
      materials.filter(m => ['Paint', 'Primer', 'Stain'].includes(m.category)).forEach(m => {
          if (m.brand) b.add(m.brand);
      });
      return Array.from(b).sort();
  }, [materials]);

  const products = useMemo(() => {
      return materials.filter(m => 
          ['Paint', 'Primer', 'Stain'].includes(m.category) && 
          (!formData.brand || m.brand === formData.brand)
      );
  }, [materials, formData.brand]);

  // Determine sheen from product ONLY if user hasn't manually selected one yet or just changed product
  const handleProductChange = (prodId: string) => {
      const product = materials.find(m => m.id === prodId);
      const updates: any = { productId: prodId };
      if (product && product.sheen) {
          updates.finish = product.sheen;
      }
      setFormData(prev => ({ ...prev, ...updates }));
  };

  const assignedSurfaces = useMemo(() => {
      if (!formData.colorCode) return [];
      const list: { key: string, label: string, areaId: string, rowId: string }[] = [];
      estimateAreas.forEach(area => {
          area.rows.forEach(row => {
              if (row.colorNum === formData.colorCode) {
                  list.push({
                      key: row.id,
                      label: `${area.name} - ${row.item}`,
                      areaId: area.id,
                      rowId: row.id
                  });
              }
          });
      });
      return list;
  }, [estimateAreas, formData.colorCode]);

  const selectedProductPrice = useMemo(() => {
      if (!formData.productId) return 0;
      const product = materials.find(m => m.id === formData.productId);
      return product?.containers[0]?.price || 0;
  }, [materials, formData.productId]);

  const totalGallons = useMemo(() => {
      if (!formData.colorCode || !formData.productId) return 0;
      const material = materials.find(m => m.id === formData.productId);
      if (!material) return 0;
      
      let total = 0;
      estimateAreas.forEach(area => {
          area.rows.forEach(row => {
              if (row.colorNum === formData.colorCode) {
                  const { requiredWithWaste } = calculateMaterial(
                      row.amount, 
                      material, 
                      row.coats, 
                      settings.wasteEnabled ? settings.wastePercentage : 0
                  );
                  total += requiredWithWaste;
              }
          });
      });
      return total;
  }, [estimateAreas, formData.colorCode, formData.productId, materials, settings]);

  const handleSave = () => {
      onSave(formData);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialColor ? t('modals.ManageColorModal.editPaintColor') : t('modals.ManageColorModal.addPaintColor')} maxWidth="max-w-2xl">
        <div className="space-y-8">
            
            {/* SECTION 1: IDENTITY */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('modals.ManageColorModal.colorIdentity')}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextInput
                        label={t('modals.ManageColorModal.colorNumber')}
                        value={formData.colorCode || ''}
                        onChange={v => setFormData({...formData, colorCode: v})}
                        placeholder="#"
                        className="font-bold"
                    />
                    <TextInput
                        label={t('modals.ManageColorModal.colorName')}
                        value={formData.colorName || ''}
                        onChange={v => setFormData({...formData, colorName: v})}
                        placeholder={t('modals.ManageColorModal.colorNamePlaceholder')}
                    />
                </div>
            </div>

            {/* SECTION 2: PRODUCT SPECIFICATION */}
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('modals.ManageColorModal.productSpecification')}</span>
                    {selectedProductPrice > 0 && (
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-xs font-bold">
                            ${selectedProductPrice.toFixed(2)}/gal
                        </span>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('modals.ManageColorModal.brand')}</label>
                        <select
                            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 appearance-none font-medium text-gray-900 dark:text-white"
                            value={formData.brand || ''}
                            onChange={e => setFormData({...formData, brand: e.target.value, productId: ''})}
                        >
                            <option value="">{t('modals.ManageColorModal.selectBrand')}</option>
                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('modals.ManageColorModal.productLine')}</label>
                        <select
                            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl outline-none focus:ring-2 focus:ring-primary-400/20 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 appearance-none font-medium text-gray-900 dark:text-white"
                            value={formData.productId || ''}
                            onChange={e => handleProductChange(e.target.value)}
                            disabled={!formData.brand}
                        >
                            <option value="">{formData.brand ? t('modals.ManageColorModal.selectProduct') : t('modals.ManageColorModal.selectBrandFirst')}</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('modals.ManageColorModal.finishSheen')}</label>
                        <div className="relative">
                            <Select
                                value={formData.finish || ''}
                                onChange={(v) => setFormData({...formData, finish: v})}
                                options={[{ label: t('modals.ManageColorModal.selectSheen'), value: '' }, ...COMMON_SHEENS]}
                                className="font-medium text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: ASSIGNED SURFACES */}
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('modals.ManageColorModal.assignedSurfaces')}</span>
                    <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 px-2 py-0.5 rounded-full text-xs font-bold">{assignedSurfaces.length}</span>
                </div>
                
                {/* Calculated Gallons - Added Here */}
                {totalGallons > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <Droplets className="w-5 h-5" />
                            <span className="text-sm font-bold uppercase tracking-wide">{t('modals.ManageColorModal.estimatedNeed')}</span>
                        </div>
                        <span className="text-2xl font-black text-blue-900 dark:text-blue-200">{totalGallons.toFixed(1)} <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{t('modals.ManageColorModal.gal')}</span></span>
                    </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 overflow-y-auto custom-scrollbar max-h-[200px]">
                    {assignedSurfaces.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {assignedSurfaces.map((s) => (
                                <div key={s.key} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm group hover:border-red-200 dark:hover:border-red-800 transition-colors">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
                                    <button
                                        onClick={() => onUnassignSurface(s.areaId, s.rowId)}
                                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded transition-colors"
                                        title={t('modals.ManageColorModal.unassignSurface')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-60">
                            <Palette className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('modals.ManageColorModal.noSurfacesAssigned')}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('modals.ManageColorModal.noSurfacesHelper')}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-4 flex gap-3 border-t border-gray-100 dark:border-gray-700">
                {initialColor && onDelete && initialColor.id && (
                    <Button variant="danger" onClick={() => { onDelete(initialColor.id); onClose(); }} className="px-4 shadow-sm">
                        <Trash2 className="w-5 h-5" />
                    </Button>
                )}
                <Button onClick={handleSave} className="flex-1 w-full justify-center shadow-lg shadow-primary-500/20 py-4 text-lg">
                    {initialColor ? t('modals.ManageColorModal.saveChanges') : t('modals.ManageColorModal.createColor')}
                </Button>
            </div>
        </div>
    </Modal>
  );
};
