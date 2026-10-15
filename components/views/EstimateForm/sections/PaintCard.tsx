
import React from 'react';
import { Palette, ChevronDown, PaintBucket, Plus, Edit2, Droplets } from 'lucide-react';
import { PaintColorEntry, Material, EstimateArea } from '../../../../types';
import { useTranslation } from '@/i18n/LanguageContext';

interface PaintCardProps {
  paintColors: PaintColorEntry[];
  materials: Material[];
  estimateAreas: EstimateArea[];
  getGallonsForPaintRow: (colorCode: string, productId: string) => number;
  openAreaSelector: (context: 'paint-row' | 'line-item', rowId?: string) => void;
  removeSurfaceFromRow: (rowId: string, surfaceName: string) => void;
  openAddSurfaceModal: (rowId: string) => void;
  updatePaintRow: (id: string, field: string, value: any) => void;
  openColorModal: (rowId: string) => void;
  openSheenModal: (rowId: string) => void;
  openProductModal: (rowId: string) => void;
  removePaintRow: (id: string) => void;
  addPaintRow: () => void;
  paintSectionRef: React.RefObject<HTMLDivElement | null>;
  onTogglePaintMode?: (colorCode: string) => void;
  onEditColor?: (id: string) => void;
  onShowBreakdown?: (colorCode: string) => void;
  readOnly?: boolean;
}

export const PaintCard: React.FC<PaintCardProps> = ({
  paintColors,
  materials,
  estimateAreas,
  getGallonsForPaintRow,
  updatePaintRow,
  paintSectionRef,
  onTogglePaintMode,
  onEditColor,
  addPaintRow,
  onShowBreakdown,
  readOnly
}) => {

  const { t } = useTranslation();

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

  // Filter out any accidentally blank color codes, though logic upstream should prevent them
  const validPaintColors = paintColors.filter(p => p.colorCode && p.colorCode.trim() !== '');

  return (
    <section id="paint-card-section" ref={paintSectionRef} className="border-b border-gray-200 dark:border-gray-700 pb-12 mb-12 scroll-mt-24">
       <div className="flex items-center gap-4 mb-8">
         <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center border border-primary-100 dark:border-primary-800 shadow-sm"><Palette className="w-6 h-6 text-primary-600 dark:text-primary-400" /></div>
         <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.PaintCard.paintColorCard')}</h3>
       </div>
       
       <div className="hidden lg:block w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
         <div className="overflow-x-auto custom-scrollbar">
           <table className="w-full min-w-[1000px]">
             <thead>
               <tr className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                 <th className="px-6 py-4 text-center w-24 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('views.EstimateForm.sections.PaintCard.colorHash')}</th>
                 <th className="px-6 py-4 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[200px] text-left">{t('views.EstimateForm.sections.PaintCard.colorDetails')}</th>
                 <th className="px-6 py-4 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[160px] text-left">{t('views.EstimateForm.sections.PaintCard.brand')}</th>
                 <th className="px-6 py-4 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[220px] text-left">{t('views.EstimateForm.sections.PaintCard.product')}</th>
                 <th className="px-6 py-4 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[120px] text-left">{t('views.EstimateForm.sections.PaintCard.sheen')}</th>
                 <th className="px-6 py-4 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">{t('views.EstimateForm.sections.PaintCard.assignedSurfaces')}</th>
                 <th className="px-6 py-4 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px] text-center">{t('views.EstimateForm.sections.PaintCard.estGal')}</th>
                 {!readOnly && <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[140px]">{t('views.EstimateForm.sections.PaintCard.actions')}</th>}
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
               {validPaintColors.map((row) => {
                  const gallons = getGallonsForPaintRow(row.colorCode, row.productId);
                  const surfacesList = getSurfacesForColor(row.colorCode);
                  const material = materials.find(m => m.id === row.productId);
                  
                  return (
                 <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors group">
                   {/* Color # */}
                   <td className="px-6 py-5 align-top text-center">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 mx-auto text-lg select-none border border-gray-200 dark:border-gray-600">
                          {row.colorCode}
                      </div>
                   </td>
                   
                   {/* Color Name */}
                   <td className="px-6 py-5 align-top">
                      <input 
                        type="text" 
                        disabled={readOnly}
                        className={`w-full bg-transparent border-none outline-none text-base font-bold placeholder-gray-400 p-0 focus:ring-0 ${readOnly ? 'text-gray-900 dark:text-white cursor-default' : 'text-gray-900 dark:text-white'}`}
                        placeholder={t('views.EstimateForm.sections.PaintCard.enterColorName')}
                        value={row.colorName || ''}
                        onChange={(e) => updatePaintRow(row.id, 'colorName', e.target.value)}
                      />
                   </td>

                   {/* Brand (Read Only Text) */}
                   <td className="px-6 py-5 align-top">
                        <span className={`text-sm font-medium ${row.brand ? "text-gray-900 dark:text-white" : "text-gray-400 italic"}`}>
                           {row.brand || t('views.EstimateForm.sections.PaintCard.none')}
                        </span>
                   </td>

                   {/* Product (Read Only Text) */}
                   <td className="px-6 py-5 align-top">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${material ? "text-gray-900 dark:text-white" : "text-gray-400 italic"} leading-tight`}>{material ? material.name : t('views.EstimateForm.sections.PaintCard.selectProduct')}</span>
                        </div>
                   </td>

                   {/* Sheen (Read Only Text) */}
                   <td className="px-6 py-5 align-top">
                        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                          {row.finish || "-"}
                        </span>
                    </td>

                   {/* Surfaces */}
                   <td className="px-6 py-5 align-top">
                      <div className="flex flex-col gap-2">
                          {surfacesList.length > 0 ? (
                              surfacesList.slice(0, 3).map((surface, idx) => (
                                  <span key={idx} className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md px-2 py-1 text-xs font-bold w-fit border border-gray-200 dark:border-gray-600">
                                      {surface}
                                  </span>
                              ))
                          ) : (
                              <span className="text-gray-300 dark:text-gray-500 italic text-sm">{t('views.EstimateForm.sections.PaintCard.noSurfaces')}</span>
                          )}
                          {surfacesList.length > 3 && (
                              <span className="text-xs font-bold text-gray-400 dark:text-gray-500">+{surfacesList.length - 3} more</span>
                          )}
                      </div>
                   </td>

                   {/* Gallons */}
                   <td className="px-6 py-5 align-top text-center">
                        <button 
                            onClick={() => onShowBreakdown && onShowBreakdown(row.colorCode)}
                            className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg px-3 py-1.5 font-bold text-sm border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all cursor-pointer"
                            title={t('views.EstimateForm.sections.PaintCard.clickToViewBreakdown')}
                        >
                            <Droplets className="w-3.5 h-3.5 fill-current" />
                            {gallons.toFixed(1)}
                        </button>
                   </td>

                   {/* Actions */}
                   {!readOnly && (
                   <td className="px-6 py-5 align-top text-right">
                        <div className="flex justify-end gap-2">
                            {onTogglePaintMode && (
                                <button 
                                    onClick={() => onTogglePaintMode(row.colorCode)}
                                    className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-700 dark:hover:text-green-300 rounded-lg transition-colors"
                                    title={t('views.EstimateForm.sections.PaintCard.paintWithThisColor')}
                                >
                                    <PaintBucket className="w-4 h-4 fill-current" />
                                </button>
                            )}
                            {onEditColor && (
                                <button 
                                    onClick={() => onEditColor(row.id)}
                                    className="p-2 bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                                    title={t('views.EstimateForm.sections.PaintCard.editColorDetails')}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                   </td>
                   )}
                 </tr>
               );})}
               {validPaintColors.length === 0 && (
                 <tr>
                   <td colSpan={readOnly ? 7 : 8} className="text-center py-16">
                     <div className="flex flex-col items-center gap-3">
                       <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-600">
                         <Palette className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                       </div>
                       <p className="text-gray-400 dark:text-gray-500 font-bold text-base">{t('views.EstimateForm.sections.PaintCard.noPaintColorsAdded')}</p>
                     </div>
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
         
         {/* Add Button Inside Card Footer */}
         {!readOnly && (
         <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 p-4">
            <button
                onClick={() => addPaintRow()}
                className="w-full py-3 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 font-bold hover:text-primary-600 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-gray-700 rounded-xl transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm"
            >
                <Plus className="w-5 h-5" /> {t('views.EstimateForm.sections.PaintCard.addNewColor')}
            </button>
         </div>
         )}
       </div>

       {/* Mobile Card View */}
       <div className="lg:hidden space-y-4">
          {validPaintColors.map((row) => {
              const gallons = getGallonsForPaintRow(row.colorCode, row.productId);
              const surfacesList = getSurfacesForColor(row.colorCode);
              const material = materials.find(m => m.id === row.productId);
              const price = material?.containers[0]?.price || 0;

              return (
                  <div key={row.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center font-bold text-sm">#{row.colorCode}</div>
                             <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('views.EstimateForm.sections.PaintCard.jobColor')}</span>
                          </div>
                          <div className="flex flex-col text-right">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('views.EstimateForm.sections.PaintCard.estGallons')}</span>
                              <button 
                                onClick={() => onShowBreakdown && onShowBreakdown(row.colorCode)}
                                className="text-lg font-black text-blue-600 dark:text-blue-400 border-b border-dashed border-blue-300 dark:border-blue-700 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                              >
                                {gallons.toFixed(1)}
                              </button>
                          </div>
                      </div>
  
                      {/* Product Header Block */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600">
                          <div className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">{row.brand || t('views.EstimateForm.sections.PaintCard.brandNotSelected')}</div>
                          <div className="w-full text-left flex justify-between items-center group">
                             <h4 className="text-xl font-extrabold text-gray-900 dark:text-white">
                                 {material ? material.name : t('views.EstimateForm.sections.PaintCard.selectProduct')}
                             </h4>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {row.finish || t('views.EstimateForm.sections.PaintCard.selectSheen')}
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white text-sm">{price > 0 ? `$${price.toFixed(2)}/gal` : '-'}</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                           <div>
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 block">{t('views.EstimateForm.sections.PaintCard.colorName')}</label>
                              <input
                                type="text"
                                disabled={readOnly}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-transparent rounded-lg text-left font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-400/20"
                                value={row.colorName || ''}
                                onChange={(e) => updatePaintRow(row.id, 'colorName', e.target.value)}
                                placeholder={t('views.EstimateForm.sections.PaintCard.enterColorName')}
                              />
                           </div>
                           
                           <div>
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 block">{t('views.EstimateForm.sections.PaintCard.assignedSurfaces')}</label>
                              <div className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                                  <div className="flex flex-wrap gap-1.5">
                                      {surfacesList.length > 0 ? (
                                          surfacesList.map((surface, idx) => (
                                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-white dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-sm">
                                                  {surface}
                                              </span>
                                          ))
                                      ) : (
                                          <span className="text-gray-400 dark:text-gray-500 italic text-sm">{t('views.EstimateForm.sections.PaintCard.none')}</span>
                                      )}
                                  </div>
                              </div>
                           </div>
                      </div>
                      
                      {!readOnly && (
                      <div className="flex gap-2 mt-2">
                          {onTogglePaintMode && (
                              <button 
                                onClick={() => onTogglePaintMode(row.colorCode)}
                                className="flex-1 py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-bold rounded-xl border border-green-100 dark:border-green-800 flex items-center justify-center gap-2 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                              >
                                  <PaintBucket className="w-5 h-5" /> {t('views.EstimateForm.sections.PaintCard.paint')}
                              </button>
                          )}
                          {onEditColor && (
                              <button 
                                onClick={() => onEditColor(row.id)}
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                  <Edit2 className="w-5 h-5" /> {t('views.EstimateForm.sections.PaintCard.edit')}
                              </button>
                          )}
                      </div>
                      )}
                  </div>
              );
          })}
          {validPaintColors.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center flex flex-col items-center gap-3">
               <div className="w-14 h-14 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center border border-gray-100 dark:border-gray-600">
                 <Palette className="w-6 h-6 text-gray-300 dark:text-gray-500" />
               </div>
               <p className="text-gray-400 dark:text-gray-500 font-medium">{t('views.EstimateForm.sections.PaintCard.noPaintColorsAdded')}</p>
            </div>
          )}
          
          {!readOnly && (
          <div className="pt-4 text-center">
                <button
                    onClick={() => addPaintRow()}
                    className="text-base font-bold text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                    <Plus className="w-5 h-5" /> {t('views.EstimateForm.sections.PaintCard.addNewColor')}
                </button>
           </div>
           )}
       </div>
    </section>
  );
};
