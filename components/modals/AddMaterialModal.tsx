
import React, { useState, useEffect } from 'react';
import { Material } from '../../types';
import { Modal, TextInput, NumberInput, Toggle, Button, Select, InputGroup } from '../UI';
import { Paintbrush, Package, Droplets, DollarSign, Tag, Check, Lock, X, Wand2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (material: Material) => void;
  defaultValues?: Partial<Material> & { price?: number, unitLabel?: string };
  mode?: 'paint' | 'general';
}

const COMMON_BRANDS = [
  'Sherwin-Williams', 'Benjamin Moore', 'Behr', 'PPG', 'Valspar', 'Farrow & Ball', 'Dunn-Edwards', 'Kelly-Moore'
];

const COMMON_SHEENS = [
  'Flat', 'Matte', 'Eggshell', 'Satin', 'Low Lustre', 'Semi-Gloss', 'Gloss', 'High Gloss'
];

// Define standard paint sizes and their gallon conversion
const PAINT_CONTAINER_SIZES = [
    { label: '5 Gallon', gallons: 5 },
    { label: '1 Gallon', gallons: 1 },
    { label: '1/2 Gallon', gallons: 0.5 },
    { label: 'Quart', gallons: 0.25 },
    { label: 'Pint', gallons: 0.125 },
    { label: '1/2 Pint', gallons: 0.0625 },
    { label: '1/4 Pint', gallons: 0.03125 },
];

export const AddMaterialModal = ({ isOpen, onClose, onSave, defaultValues, mode = 'general' }: AddMaterialModalProps) => {
  const { t } = useTranslation();
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    code: '',
    category: 'Consumable',
    sheen: '',
    coveragePerGallon: 350,
    coverageCoat2: 0,
    coverageCoat3: 0,
    coverageCoat4: 0,
    defaultCoats: 2,
    unitLabel: 'Item',
    price: 0,
    isDefault: false
  });

  // State for multi-container pricing (Paint Mode)
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1 Gallon']);
  const [sizePrices, setSizePrices] = useState<Record<string, string | number>>({ '1 Gallon': 0 });
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  
  // Multiplier State
  const [useMultipliers, setUseMultipliers] = useState(false);
  const [multipliers, setMultipliers] = useState({ coat2: 1.5, coat3: 2.0, coat4: 2.0 });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: defaultValues?.name || '',
        brand: defaultValues?.brand || '',
        code: defaultValues?.code || '',
        category: defaultValues?.category || (mode === 'paint' ? 'Paint' : 'Consumable'),
        sheen: defaultValues?.sheen || '',
        coveragePerGallon: defaultValues?.coveragePerGallon || 350,
        coverageCoat2: defaultValues?.coverageCoat2 || 0,
        coverageCoat3: defaultValues?.coverageCoat3 || 0,
        coverageCoat4: defaultValues?.coverageCoat4 || 0,
        defaultCoats: defaultValues?.defaultCoats || (mode === 'paint' ? 2 : 0),
        unitLabel: defaultValues?.unitLabel || (mode === 'paint' ? 'Gallon' : 'Item'),
        price: defaultValues?.price || 0,
        isDefault: defaultValues?.isDefault || false
      });
      setUseMultipliers(false);

      // Initialize Paint Container State
      if (mode === 'paint') {
          // If editing an existing material with containers
          if (defaultValues?.containers && defaultValues.containers.length > 0) {
              const sizes: string[] = [];
              const prices: Record<string, number> = {};
              defaultValues.containers.forEach(c => {
                  sizes.push(c.sizeLabel);
                  prices[c.sizeLabel] = c.price;
              });
              
              if (!sizes.includes('1 Gallon')) sizes.push('1 Gallon');
              setSelectedSizes(sizes);
              setSizePrices(prices);
          } else {
              const mockSelected = ['5 Gallon', '1 Gallon', 'Quart'];
              const mockPrices = {
                  '5 Gallon': 225.00,
                  '1 Gallon': 45.00,
                  '1/2 Gallon': 0,
                  'Quart': 18.00,
                  'Pint': 0,
                  '1/2 Pint': 0,
                  '1/4 Pint': 0
              };
              setSelectedSizes(mockSelected);
              setSizePrices(mockPrices);
          }

          const brand = defaultValues?.brand || '';
          if (brand && !COMMON_BRANDS.includes(brand)) {
              setUseCustomBrand(true);
          } else {
              setUseCustomBrand(false);
          }
      }
    }
  }, [isOpen, defaultValues, mode]);

  // Recalculate coverages based on current multipliers and base
  const recalculateFromMultipliers = (base: number, currentMults: typeof multipliers) => {
      setFormData(prev => ({
          ...prev,
          coveragePerGallon: base,
          coverageCoat2: Math.round(base * currentMults.coat2),
          coverageCoat3: Math.round(base * currentMults.coat3),
          coverageCoat4: Math.round(base * currentMults.coat4),
      }));
  };

  const handleBaseCoverageChange = (val: number) => {
      if (useMultipliers) {
          recalculateFromMultipliers(val, multipliers);
      } else {
          setFormData(prev => ({ ...prev, coveragePerGallon: val }));
      }
  };

  const handleMultiplierChange = (coat: 'coat2' | 'coat3' | 'coat4', val: number) => {
      const newMults = { ...multipliers, [coat]: val };
      setMultipliers(newMults);
      recalculateFromMultipliers(formData.coveragePerGallon, newMults);
  };

  const handleSave = () => {
    if (!formData.name) return;

    let finalContainers: { sizeLabel: string; gallons: number; price: number }[] = [];

    if (mode === 'paint') {
        finalContainers = selectedSizes.map(label => {
            const sizeDef = PAINT_CONTAINER_SIZES.find(s => s.label === label);
            return {
                sizeLabel: label,
                gallons: sizeDef ? sizeDef.gallons : 0,
                price: parseFloat(sizePrices[label]?.toString() || '0') || 0
            };
        });
        
        if (!finalContainers.find(c => c.sizeLabel === '1 Gallon')) {
            const price = parseFloat(sizePrices['1 Gallon']?.toString() || '0') || 0;
            finalContainers.push({ sizeLabel: '1 Gallon', gallons: 1, price });
        }
    } else {
        finalContainers = [{
            sizeLabel: formData.unitLabel,
            gallons: 0,
            price: formData.price
        }];
    }

    const newMaterial: Material = {
      id: defaultValues?.id || `mat-${Date.now()}`,
      name: formData.name,
      brand: mode === 'paint' ? formData.brand : undefined,
      code: mode === 'paint' ? formData.code : undefined,
      category: formData.category,
      sheen: mode === 'paint' ? formData.sheen : undefined,
      coveragePerGallon: mode === 'paint' ? formData.coveragePerGallon : 0,
      coverageCoat2: mode === 'paint' ? formData.coverageCoat2 : 0,
      coverageCoat3: mode === 'paint' ? formData.coverageCoat3 : 0,
      coverageCoat4: mode === 'paint' ? formData.coverageCoat4 : 0,
      defaultCoats: mode === 'paint' ? formData.defaultCoats : 0,
      isDefault: formData.isDefault,
      containers: finalContainers,
      lastUsed: Date.now(),
    };
    onSave(newMaterial);
    onClose();
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleContainerSize = (label: string) => {
      if (label === '1 Gallon') return;
      if (selectedSizes.includes(label)) {
          setSelectedSizes(prev => prev.filter(s => s !== label));
      } else {
          setSelectedSizes(prev => [...prev, label]);
      }
  };

  const updateContainerPrice = (label: string, value: string) => {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
          setSizePrices(prev => ({ ...prev, [label]: value }));
      }
  };

  if (!isOpen) return null;

  const isEditing = !!defaultValues?.id;
  const modalTitle = mode === 'paint'
      ? (isEditing ? t('modals.AddMaterialModal.editPaintProduct') : t('modals.AddMaterialModal.addPaintProduct'))
      : (isEditing ? t('modals.AddMaterialModal.editMaterialItem') : t('modals.AddMaterialModal.addMaterialItem'));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="max-w-2xl">
      <div className="space-y-8 py-2">
        
        {/* --- PAINT MODE LAYOUT --- */}
        {mode === 'paint' && (
          <div className="space-y-6">
             {/* Identity Section */}
             <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4" /> {t('modals.AddMaterialModal.productIdentity')}
                </h4>
                <InputGroup label={t('modals.AddMaterialModal.brand')}>
                    {!useCustomBrand ? (
                        <Select 
                            value={COMMON_BRANDS.includes(formData.brand) ? formData.brand : ''} 
                            onChange={(v) => {
                                if (v === 'OTHER') {
                                    setUseCustomBrand(true);
                                    updateField('brand', '');
                                } else {
                                    updateField('brand', v);
                                }
                            }}
                            options={[
                                { label: t('modals.AddMaterialModal.selectBrand'), value: '' },
                                ...COMMON_BRANDS.map(b => ({ label: b, value: b })),
                                { label: t('modals.AddMaterialModal.otherCustom'), value: 'OTHER' }
                            ]}
                        />
                    ) : (
                        <div className="flex gap-2 items-start">
                            <div className="flex-1">
                                <TextInput
                                    value={formData.brand}
                                    onChange={(v) => updateField('brand', v)}
                                    placeholder={t('modals.AddMaterialModal.enterCustomBrand')}
                                    className="bg-white dark:bg-gray-900"
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    setUseCustomBrand(false);
                                    updateField('brand', '');
                                }}
                                className="mt-0.5 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shadow-sm h-[46px] w-[46px] flex items-center justify-center"
                                title={t('modals.AddMaterialModal.backToList')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </InputGroup>
                
                <TextInput
                    label={t('modals.AddMaterialModal.productName')}
                    placeholder={t('modals.AddMaterialModal.productNamePlaceholder')}
                    value={formData.name}
                    onChange={(v) => updateField('name', v)}
                    className="font-bold text-lg"
                />
             </div>

             {/* Specs Section */}
             <div className="space-y-6">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Paintbrush className="w-4 h-4" /> {t('modals.AddMaterialModal.finishType')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label={t('modals.AddMaterialModal.category')}>
                            <Select
                                value={formData.category}
                                onChange={(v) => updateField('category', v)}
                                options={[
                                    { label: t('modals.AddMaterialModal.optionPaint'), value: 'Paint' },
                                    { label: t('modals.AddMaterialModal.optionPrimer'), value: 'Primer' },
                                    { label: t('modals.AddMaterialModal.optionStain'), value: 'Stain' }
                                ]}
                            />
                        </InputGroup>
                        <InputGroup label={t('modals.AddMaterialModal.sheenFinish')}>
                            <Select
                                value={formData.sheen}
                                onChange={(v) => updateField('sheen', v)}
                                options={[{ label: t('modals.AddMaterialModal.selectSheen'), value: '' }, ...COMMON_SHEENS.map(s => ({ label: s, value: s }))]}
                            />
                        </InputGroup>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Droplets className="w-4 h-4" /> {t('modals.AddMaterialModal.coveragePricing')}
                        </h4>
                        <div className="flex items-center gap-2">
                            <Wand2 className={`w-3 h-3 ${useMultipliers ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                            <Toggle
                                label={t('modals.AddMaterialModal.multipliers')}
                                checked={useMultipliers} 
                                onChange={(v) => {
                                    setUseMultipliers(v);
                                    if (v) recalculateFromMultipliers(formData.coveragePerGallon, multipliers);
                                }} 
                            />
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <NumberInput
                                label={t('modals.AddMaterialModal.coat1Base')}
                                value={formData.coveragePerGallon}
                                onChange={handleBaseCoverageChange}
                                className="bg-white dark:bg-gray-900 font-bold"
                                placeholder="350"
                            />
                            {useMultipliers ? (
                                <>
                                    <div className="relative">
                                        <NumberInput label={t('modals.AddMaterialModal.coat2Mult')} value={multipliers.coat2} onChange={(v) => handleMultiplierChange('coat2', v)} className="bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-bold" step={0.1} />
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono text-center">{t('modals.AddMaterialModal.approxSqft', { value: formData.coverageCoat2 })}</div>
                                    </div>
                                    <div className="relative">
                                        <NumberInput label={t('modals.AddMaterialModal.coat3Mult')} value={multipliers.coat3} onChange={(v) => handleMultiplierChange('coat3', v)} className="bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-bold" step={0.1} />
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono text-center">{t('modals.AddMaterialModal.approxSqft', { value: formData.coverageCoat3 })}</div>
                                    </div>
                                    <div className="relative">
                                        <NumberInput label={t('modals.AddMaterialModal.coat4Mult')} value={multipliers.coat4} onChange={(v) => handleMultiplierChange('coat4', v)} className="bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-bold" step={0.1} />
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono text-center">{t('modals.AddMaterialModal.approxSqft', { value: formData.coverageCoat4 })}</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <NumberInput label={t('modals.AddMaterialModal.coat2')} value={formData.coverageCoat2} onChange={(v) => updateField('coverageCoat2', v)} className="bg-white dark:bg-gray-900" placeholder={t('modals.AddMaterialModal.optional')} />
                                    <NumberInput label={t('modals.AddMaterialModal.coat3')} value={formData.coverageCoat3} onChange={(v) => updateField('coverageCoat3', v)} className="bg-white dark:bg-gray-900" placeholder={t('modals.AddMaterialModal.optional')} />
                                    <NumberInput label={t('modals.AddMaterialModal.coat4')} value={formData.coverageCoat4} onChange={(v) => updateField('coverageCoat4', v)} className="bg-white dark:bg-gray-900" placeholder={t('modals.AddMaterialModal.optional')} />
                                </>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {useMultipliers
                                ? t('modals.AddMaterialModal.multiplierHelpText')
                                : t('modals.AddMaterialModal.coverageHelpText')
                            }
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 block">{t('modals.AddMaterialModal.availableSizesPrices')}</label>
                        <div className="space-y-2">
                            {PAINT_CONTAINER_SIZES.map((size) => {
                                const isSelected = selectedSizes.includes(size.label);
                                const isMandatory = size.label === '1 Gallon';
                                
                                return (
                                    <div key={size.label} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'bg-white dark:bg-gray-900 border-primary-300 dark:border-primary-700 shadow-sm' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-70'}`}>
                                        <button
                                            onClick={() => toggleContainerSize(size.label)}
                                            disabled={isMandatory}
                                            className={`w-6 h-6 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-gray-400'} ${isMandatory ? 'cursor-not-allowed opacity-90' : ''}`}
                                        >
                                            {isSelected && <Check className="w-4 h-4" />}
                                        </button>
                                        <div className="flex-1 font-medium text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2">
                                            {size.label}
                                            {isMandatory && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">{t('modals.AddMaterialModal.default')}</span>}
                                        </div>
                                        <div className={`w-40 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs font-bold">$</span>
                                                <input
                                                    type="text"
                                                    value={sizePrices[size.label] || ''}
                                                    onChange={(e) => updateContainerPrice(size.label, e.target.value)}
                                                    className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-900 text-right font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-400/20 focus:border-primary-400 outline-none text-sm"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
             </div>
          </div>
        )}

        {/* --- GENERAL MODE LAYOUT --- */}
        {mode === 'general' && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4" /> {t('modals.AddMaterialModal.itemDetails')}
                </h4>
                <TextInput label={t('modals.AddMaterialModal.itemName')} placeholder={t('modals.AddMaterialModal.itemNamePlaceholder')} value={formData.name} onChange={(v) => updateField('name', v)} className="font-bold text-lg" />
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label={t('modals.AddMaterialModal.category')}>
                        <Select value={formData.category} onChange={(v) => updateField('category', v)} options={[{ label: t('modals.AddMaterialModal.optionConsumable'), value: 'Consumable' }, { label: t('modals.AddMaterialModal.optionTool'), value: 'Tool' }, { label: t('modals.AddMaterialModal.optionEquipment'), value: 'Equipment' }]} />
                    </InputGroup>
                    <TextInput label={t('modals.AddMaterialModal.unitType')} placeholder={t('modals.AddMaterialModal.unitTypePlaceholder')} value={formData.unitLabel} onChange={(v) => updateField('unitLabel', v)} />
                </div>
            </div>
            <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                    <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400"><DollarSign className="w-5 h-5" /></div>
                    <div><div className="font-bold">{t('modals.AddMaterialModal.unitCost')}</div><div className="text-xs text-gray-500 dark:text-gray-400">{t('modals.AddMaterialModal.pricePerUnit', { unit: formData.unitLabel.toLowerCase() || 'item' })}</div></div>
                </div>
                <div className="w-32">
                    <NumberInput label="" placeholder="0.00" value={formData.price} onChange={(v) => updateField('price', v)} step={0.01} className="text-right font-bold text-lg" />
                </div>
            </div>
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
             {mode !== 'paint' && (
               <>
                 <Toggle checked={formData.isDefault} onChange={(v) => updateField('isDefault', v)} label="" />
                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('modals.AddMaterialModal.addToFavorites')}</span>
               </>
             )}
          </div>
          <div className="flex gap-3 w-full md:w-auto">
              <Button variant="secondary" onClick={onClose} className="flex-1 md:flex-none">{t('modals.AddMaterialModal.cancel')}</Button>
              <Button onClick={handleSave} disabled={!formData.name} className="flex-1 md:flex-none px-8 shadow-lg shadow-primary-500/20">
                {mode === 'paint' ? t('modals.AddMaterialModal.savePaint') : t('modals.AddMaterialModal.saveItem')}
              </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddMaterialModal;
