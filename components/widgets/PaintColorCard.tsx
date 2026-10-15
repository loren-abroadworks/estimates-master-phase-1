
import React, { useState, useMemo } from 'react';
import { Palette, Plus, X, Edit2, PaintBucket, Layers, Droplets } from 'lucide-react';
import { PaintColorEntry, Material, EstimateArea, GlobalSettings } from '../../types';
import { Button, Modal } from '../UI';
import { calculateMaterial } from '../../services/calcEngine';
import { useTranslation } from '@/i18n/LanguageContext';

interface PaintColorCardProps {
  paintColors: PaintColorEntry[];
  materials: Material[];
  estimateAreas: EstimateArea[];
  settings: GlobalSettings;
  activeColorId: string | null;
  onTogglePaintMode: (colorCode: string | null) => void;
  onAddColor: () => void;
  onEditColor: (id: string) => void;
  onRemoveColor: (id: string) => void;
  onShowBreakdown?: (colorCode: string) => void;
}

export const PaintColorCard: React.FC<PaintColorCardProps> = ({
  paintColors,
  materials,
  estimateAreas,
  settings,
  activeColorId,
  onTogglePaintMode,
  onAddColor,
  onEditColor,
  onRemoveColor,
  onShowBreakdown
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // If we are in painting mode, we show a simplified "Active Banner"
  if (activeColorId) {
    const activeColor = paintColors.find(p => p.colorCode === activeColorId);
    
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 w-[90%] max-w-md">
        <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-700 ring-4 ring-gray-900/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white text-gray-900 flex items-center justify-center font-bold text-lg border-2 border-gray-200">
              {activeColor?.colorCode}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('widgets.PaintColorCard.paintingModeActive')}</span>
              <span className="font-bold text-base truncate max-w-[150px] md:max-w-[200px]">
                {activeColor?.colorName || t('widgets.PaintColorCard.unassignedColor')}
              </span>
            </div>
          </div>
          <Button 
            onClick={() => onTogglePaintMode(null)} 
            variant="primary" 
            size="sm"
            className="whitespace-nowrap"
          >
            {t('widgets.PaintColorCard.done')}
          </Button>
        </div>
        <div className="text-center mt-2">
            <span className="bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200">
                {t('widgets.PaintColorCard.tapAnyRowToApply')}
            </span>
        </div>
      </div>
    );
  }

  // Calculate gallons logic reused
  const getCalculatedGallons = (colorCode: string, productId: string) => {
      if (!productId || !colorCode) return 0;
      const material = materials.find(m => m.id === productId);
      if (!material) return 0;
      let total = 0;
      estimateAreas.forEach(area => {
          area.rows.forEach(row => {
              if (row.colorNum === colorCode) {
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
  };
  
  const getSurfacesForColor = (colorCode: string) => {
    const surfaces = new Set<string>();
    estimateAreas.forEach(area => {
        area.rows.forEach(row => {
            if (row.colorNum === colorCode) {
                surfaces.add(`${area.name} - ${row.item}`);
            }
        });
    });
    return Array.from(surfaces);
  };

  // Normal FAB State -> Opens Center Modal now
  return (
    <>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('widgets.PaintColorCard.paintColorCardTitle')} maxWidth="max-w-7xl">
        <div className="space-y-6">
            <div className="space-y-4">
                {paintColors.filter(p => p.colorCode).map(color => {
                    const material = materials.find(m => m.id === color.productId);
                    const totalGallons = getCalculatedGallons(color.colorCode, color.productId);
                    const surfacesList = getSurfacesForColor(color.colorCode);
                    const price = material?.containers[0]?.price || 0;

                    return (
                        <div key={color.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
                            {/* Card Header */}
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center font-bold text-sm">
                                        {color.colorCode}
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('widgets.PaintColorCard.colorHash')}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('widgets.PaintColorCard.estGallons')}</span>
                                    <button 
                                        onClick={() => onShowBreakdown && onShowBreakdown(color.colorCode)}
                                        className="text-2xl font-black text-blue-600 leading-none border-b border-dashed border-blue-300 hover:text-blue-800 transition-colors"
                                    >
                                        {totalGallons.toFixed(1)}
                                    </button>
                                </div>
                            </div>
        
                            {/* Product Block */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="text-xs font-bold text-gray-400 mb-1">{color.brand || t('widgets.PaintColorCard.brandNotSelected')}</div>
                                <div className="w-full text-left group">
                                    <h4 className="text-lg font-extrabold text-gray-900 leading-tight mb-3">
                                        {material ? material.name : t('widgets.PaintColorCard.selectProduct')}
                                    </h4>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                    <span className="font-bold text-gray-700 text-sm">
                                        {color.finish || t('widgets.PaintColorCard.selectSheen')}
                                    </span>
                                    <span className="font-bold text-gray-900 text-sm">{price > 0 ? `$${price.toFixed(2)}/gal` : '-'}</span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">{t('widgets.PaintColorCard.colorNameLabel')}</label>
                                    <div className="font-bold text-gray-900 text-lg">
                                        {color.colorName || t('widgets.PaintColorCard.noColorName')}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">{t('widgets.PaintColorCard.assignedSurfaces')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {surfacesList.length > 0 ? (
                                            surfacesList.map((surface, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs font-bold text-gray-600 border border-gray-200">
                                                    {surface}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-400 italic text-sm">{t('widgets.PaintColorCard.noneAssigned')}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => { setIsOpen(false); onTogglePaintMode(color.colorCode); }} 
                                    className="flex-1 py-3 bg-green-50 text-green-700 font-bold rounded-xl border border-green-100 flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                                >
                                    <PaintBucket className="w-5 h-5" /> {t('widgets.PaintColorCard.paint')}
                                </button>
                                <button
                                    onClick={() => { onEditColor(color.id); setIsOpen(false); }}
                                    className="flex-1 py-3 bg-gray-50 text-gray-600 font-bold rounded-xl border border-gray-200 flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                                >
                                    <Edit2 className="w-5 h-5" /> {t('widgets.PaintColorCard.edit')}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="pt-4 border-t border-gray-100 text-center">
                <button
                    onClick={() => { setIsOpen(false); onAddColor(); }}
                    className="text-base font-bold text-gray-500 hover:text-primary-600 flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                    <Plus className="w-5 h-5" /> {t('widgets.PaintColorCard.addNewColor')}
                </button>
            </div>
        </div>
      </Modal>

      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 bg-primary-500 text-gray-900 ring-2 ring-gray-200 border-0 md:hidden`}
        title={t('widgets.PaintColorCard.openPaintColorCard')}
      >
        <Palette className="w-7 h-7" />
      </button>
    </>
  );
};
