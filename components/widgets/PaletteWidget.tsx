
import React, { useState, useMemo } from 'react';
import { Palette, Plus, X, Edit2, PaintBucket, Layers, Droplets } from 'lucide-react';
import { PaintColorEntry, Material, EstimateArea, GlobalSettings } from '../../types';
import { Button, Modal } from '../UI';
import { calculateMaterial } from '../../services/calcEngine';
import { useTranslation } from '@/i18n/LanguageContext';

interface PaletteWidgetProps {
  paintColors: PaintColorEntry[];
  materials: Material[];
  estimateAreas: EstimateArea[];
  settings: GlobalSettings;
  activeColorId: string | null;
  onTogglePaintMode: (colorCode: string | null) => void;
  onAddColor: () => void;
  onEditColor: (id: string) => void;
  onRemoveColor: (id: string) => void;
}

export const PaletteWidget: React.FC<PaletteWidgetProps> = ({
  paintColors,
  materials,
  estimateAreas,
  settings,
  activeColorId,
  onTogglePaintMode,
  onAddColor,
  onEditColor,
  onRemoveColor
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
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('widgets.PaletteWidget.paintingModeActive')}</span>
              <span className="font-bold text-base truncate max-w-[150px] md:max-w-[200px]">
                {activeColor?.colorName || t('widgets.PaletteWidget.unassignedColor')}
              </span>
            </div>
          </div>
          <Button 
            onClick={() => onTogglePaintMode(null)} 
            variant="primary" 
            size="sm"
            className="whitespace-nowrap"
          >
            {t('widgets.PaletteWidget.done')}
          </Button>
        </div>
        <div className="text-center mt-2">
            <span className="bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200">
                {t('widgets.PaletteWidget.tapAnyRowToApply')}
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

  // Normal FAB State -> Opens Center Modal now
  return (
    <>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('widgets.PaletteWidget.paintColorCard')} maxWidth="max-w-7xl">
        <div className="space-y-6">
            <div className="hidden md:block overflow-hidden border border-gray-200 rounded-2xl">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-center w-24 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colColorNum')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colColorDetails')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colBrand')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colProduct')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colSheen')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colAssignedSurfaces')}</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colEstGal')}</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('widgets.PaletteWidget.colActions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paintColors.filter(p => p.colorCode).map(color => {
                            const material = materials.find(m => m.id === color.productId);
                            const totalGallons = getCalculatedGallons(color.colorCode, color.productId);
                            
                            return (
                                <tr key={color.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 text-center align-middle">
                                        <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-800 shadow-sm mx-auto text-lg">
                                            {color.colorCode}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <div className="font-bold text-gray-900 text-lg mb-1">{color.colorName || t('widgets.PaletteWidget.unassignedColor')}</div>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <span className="text-sm font-medium text-gray-700">
                                            {material?.brand || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        {material ? (
                                            <div className="font-bold text-gray-800">{material.name}</div>
                                        ) : (
                                            <span className="text-gray-400 italic text-sm">{t('widgets.PaletteWidget.productNotSelected')}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        <span className="text-sm text-gray-600">
                                            {material?.sheen || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-middle">
                                        {color.surfaces && color.surfaces.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                {color.surfaces.slice(0, 3).map((surface, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                        {surface}
                                                    </span>
                                                ))}
                                                {color.surfaces.length > 3 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                                        +{color.surfaces.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">{t('widgets.PaletteWidget.none')}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 align-middle text-center">
                                        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                                            <Droplets className="w-4 h-4" />
                                            <span className="font-bold text-lg">{totalGallons.toFixed(1)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-middle text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => { setIsOpen(false); onTogglePaintMode(color.colorCode); }}
                                                className="p-2.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors border border-primary-100 shadow-sm hover:shadow-md"
                                                title={t('widgets.PaletteWidget.paintWithThisColor')}
                                            >
                                                <PaintBucket className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => { onEditColor(color.id); setIsOpen(false); }} // Close modal when opening edit
                                                className="p-2.5 rounded-xl bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm hover:shadow-md"
                                                title={t('widgets.PaletteWidget.viewInfoEdit')}
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {paintColors.length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-gray-400">{t('widgets.PaletteWidget.noColorsDefined')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden space-y-4">
                {paintColors.filter(p => p.colorCode).map(color => {
                    const material = materials.find(m => m.id === color.productId);
                    const totalGallons = getCalculatedGallons(color.colorCode, color.productId);
                    return (
                        <div key={color.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-800 text-lg shadow-sm">
                                        {color.colorCode}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 text-lg">{color.colorName || t('widgets.PaletteWidget.unassigned')}</div>
                                        <div className="text-sm text-gray-500">
                                            {material ? `${material.brand} • ${material.sheen}` : t('widgets.PaletteWidget.noProduct')}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('widgets.PaletteWidget.estLabel')}</div>
                                    <div className="font-black text-gray-900 text-xl">{totalGallons.toFixed(1)} <span className="text-sm font-medium text-gray-400">{t('widgets.PaletteWidget.galUnit')}</span></div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <Button 
                                    onClick={() => { setIsOpen(false); onTogglePaintMode(color.colorCode); }} 
                                    className="flex-1 text-sm py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 border-primary-200"
                                >
                                    <PaintBucket className="w-4 h-4 mr-2" /> {t('widgets.PaletteWidget.paint')}
                                </Button>
                                <Button
                                    onClick={() => { onEditColor(color.id); setIsOpen(false); }}
                                    variant="secondary"
                                    className="flex-1 text-sm py-2"
                                >
                                    <Edit2 className="w-4 h-4 mr-2" /> {t('widgets.PaletteWidget.edit')}
                                </Button>
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
                    <Plus className="w-5 h-5" /> {t('widgets.PaletteWidget.addNewColor')}
                </button>
            </div>
        </div>
      </Modal>

      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 bg-primary-500 text-gray-900 ring-2 ring-gray-200 border-0`}
        title={t('widgets.PaletteWidget.openPaintColorCard')}
      >
        <Palette className="w-7 h-7" />
      </button>
    </>
  );
};
