
import React from 'react';
import { Grid, GripVertical, Settings2, Save, StickyNote, Trash2, Plus, CheckSquare, Square, Percent, TrendingUp, Layers } from 'lucide-react';
import { EstimateArea, MiscLineItem, EstimateRow, GlobalSettings, Material, PaintColorEntry, ProductionRate } from '../../../../types';
import { KebabMenu, Toggle } from '../../../UI';
import { InteriorAreaTable } from './InteriorAreaTable';
import { ExteriorAreaTable } from './ExteriorAreaTable';
import { calculateExteriorProductionHours, calculateLabor } from '../../../../services/calcEngine';
import { useTranslation } from '@/i18n/LanguageContext';

interface ScopeOfWorkProps {
  formLayout: string[];
  estimateAreas: EstimateArea[];
  lineItems: Record<string, MiscLineItem>;
  areaSummaries: { id: string; totalHours: number; totalCost: number }[];
  settings: GlobalSettings;
  materials?: Material[];
  paintColors?: PaintColorEntry[];
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleRowDragStart: (e: React.DragEvent, areaId: string, rowId: string) => void;
  handleRowDrop: (e: React.DragEvent, areaId: string, targetRowId: string) => void;
  handleUpdateAreaName: (areaId: string, currentName: string, newName: string) => void;
  handleDeleteAreaBlock: (id: string) => void;
  handleDuplicateArea: (areaId: string) => void;
  setIsColumnConfigOpen: (val: boolean) => void;
  handleSaveAreaAsTemplate: (area: EstimateArea) => void;
  openRichTextModal: (id: string, initialValue: string, title: string) => void;
  updateAreaOptional: (areaId: string, isOptional: boolean) => void;
  setEstimateAreas: React.Dispatch<React.SetStateAction<EstimateArea[]>>;
  updateAreaRow: (areaId: string, rowId: string, field: keyof EstimateRow | string, value: any) => void;
  deleteAreaRow: (areaId: string, rowId: string) => void;
  handleOpenBreakdown: (areaName: string, row: EstimateRow) => void;
  updateAreaNote: (areaId: string, note: string | undefined) => void;
  handleDeleteMiscItemBlock: (id: string) => void;
  updateMiscLineItem: (id: string, field: keyof MiscLineItem, value: any) => void;
  openAddItemModal: (areaId: string) => void;
  setIsLineItemModalOpen: (val: boolean) => void;
  paintingModeColorId?: string | null;
  handlePaintRow?: (areaId: string, rowId: string) => void;
  checkForNewColor?: (colorCode: string) => void;
  onMoveColumn?: (fromIndex: number, toIndex: number) => void;
  setActiveAreaForConfig?: (id: string | null) => void;
  
  // Added rates prop
  rates: ProductionRate[];
  isExterior?: boolean;
  readOnly?: boolean;
}

export const ScopeOfWork: React.FC<ScopeOfWorkProps> = ({
  formLayout,
  estimateAreas,
  lineItems,
  areaSummaries,
  settings,
  materials,
  paintColors,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleRowDragStart,
  handleRowDrop,
  handleUpdateAreaName,
  handleDeleteAreaBlock,
  handleDuplicateArea,
  setIsColumnConfigOpen,
  handleSaveAreaAsTemplate,
  openRichTextModal,
  updateAreaOptional,
  setEstimateAreas,
  updateAreaRow,
  deleteAreaRow,
  handleOpenBreakdown,
  updateAreaNote,
  handleDeleteMiscItemBlock,
  updateMiscLineItem,
  openAddItemModal,
  setIsLineItemModalOpen,
  paintingModeColorId,
  handlePaintRow,
  checkForNewColor,
  setActiveAreaForConfig,
  rates,
  isExterior,
  readOnly
}) => {
  const { t } = useTranslation();
  const isPainting = !!paintingModeColorId;
  
  const handleMakeAllItemsSplit = (areaId: string) => {
    setEstimateAreas(prev => prev.map(area => {
      if (area.id !== areaId) return area;
      return {
        ...area,
        rows: area.rows.map(row => ({
          ...row,
          coatQuantities: row.coatQuantities || Array(row.coats || 2).fill(row.amount)
        }))
      };
    }));
  };

  const isExteriorMode = isExterior || settings.extraColumns.some(c => c.id === 'col-coat1' && c.visible);

  const getRowTotalHours = (row: EstimateRow) => {
      let base = 0;
      
      if (row.isHoursOverridden) {
          base = row.hours || 0;
      } else {
          if (isExteriorMode) {
              const rate = rates.find(r => r.id === row.productionRateId);
              if (rate) {
                  base = calculateExteriorProductionHours(row, rate, settings);
              }
          } else {
              const rate = rates.find(r => r.id === row.productionRateId);
              if (rate) {
                 const { totalLaborHours } = calculateLabor(row.amount, rate, row.coats, 1, 1, 0, 0, false);
                 base = totalLaborHours;
              }
          }
      }
      
      base = Math.round(base * 100) / 100;

      const extras = settings.extraColumns.reduce((acc, col) => {
          if (col.type === 'hours') {
              if (['col-coat1', 'col-coat2', 'col-coat3'].includes(col.id)) return acc;
              
              return acc + (Number(row.customValues[col.id]) || 0);
          }
          return acc;
      }, 0);
      
      return base + extras;
  };

  return (
    <section className="border-b border-gray-200 dark:border-gray-700 pb-6 md:pb-10">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center border border-primary-100 dark:border-primary-800">
            <Grid className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-heading">{t('views.EstimateForm.sections.ScopeOfWork.areaAndLineItems')}</h3>
        </div>
      </div>

      <div className="space-y-6">
        {formLayout.map((itemId, index) => {
          const area = estimateAreas.find((a) => a.id === itemId);
          const miscItem = lineItems[itemId];

          if (area) {
            const hasDimensions = area.length > 0 || area.width > 0 || area.height > 0 || isPainting;
            const isAreaOptional = area.isOptional || false;

            const colTotals = area.rows.reduce(
              (acc, row) => {
                if (row.isOptional && !isAreaOptional) return acc; 
                acc.totalHrs += getRowTotalHours(row); 
                return acc;
              },
              { totalHrs: 0 } as Record<string, number>
            );

            return (
              <div
                key={area.id}
                id={area.id}
                draggable={!isPainting && !readOnly}
                onDragStart={(e) => !readOnly && handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => !readOnly && handleDrop(e, index)}
                className={`group border-b border-gray-200 dark:border-gray-700 pb-6 mb-6 last:border-0 last:mb-0 last:pb-0 transition-opacity ${isPainting ? 'hover:opacity-100' : ''}`}
              >
                <div className="sticky top-0 z-30 bg-slate-900 py-2 px-4 shadow-md border border-slate-800 rounded-t-xl rounded-b-none mb-0 transition-all">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 w-full">
                        {!isPainting && !readOnly && (
                        <div className="cursor-grab text-slate-500 hover:text-white active:cursor-grabbing opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-4 h-4" />
                        </div>
                        )}
                        <div className="flex-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            <input
                            type="text"
                            disabled={isPainting || readOnly}
                            value={area.name}
                            onChange={(e) => handleUpdateAreaName(area.id, area.name, e.target.value)}
                            className={`text-lg md:text-xl font-bold font-heading bg-transparent border-b-2 border-transparent hover:border-slate-600 focus:border-primary-400 outline-none transition-all w-full md:w-auto placeholder-slate-600 ${
                            isAreaOptional ? "text-amber-400" : "text-white"
                            }`}
                        />
                        {isAreaOptional && (
                            <span className="ml-2 text-[10px] font-bold text-amber-900 bg-amber-400 px-2 py-0.5 rounded-full align-middle whitespace-nowrap">
                            {t('views.EstimateForm.sections.ScopeOfWork.optional')}
                            </span>
                        )}
                        </div>
                        
                        {!isPainting && !readOnly && (
                            <div className="md:hidden">
                            <KebabMenu
                                onDelete={() => handleDeleteAreaBlock(area.id)}
                                onDuplicate={() => handleDuplicateArea(area.id)}
                                items={[
                                { label: t('views.EstimateForm.sections.ScopeOfWork.tableColumns'), icon: Settings2, onClick: () => { if(setActiveAreaForConfig) setActiveAreaForConfig(area.id); setIsColumnConfigOpen(true); } },
                                { label: t('views.EstimateForm.sections.ScopeOfWork.saveAsTemplate'), icon: Save, onClick: () => handleSaveAreaAsTemplate(area) },
                                {
                                    label: t('views.EstimateForm.sections.ScopeOfWork.addNote'),
                                    icon: StickyNote,
                                    onClick: () => openRichTextModal(area.id, area.note || "", area.name + " " + t('views.EstimateForm.sections.ScopeOfWork.notesSuffix')),
                                },
                                {
                                    label: isAreaOptional ? t('views.EstimateForm.sections.ScopeOfWork.markRequired') : t('views.EstimateForm.sections.ScopeOfWork.markOptional'),
                                    icon: isAreaOptional ? CheckSquare : Square,
                                    onClick: () => updateAreaOptional(area.id, !isAreaOptional)
                                },
                                {
                                    label: t('views.EstimateForm.sections.ScopeOfWork.makeAllItemsSplit'),
                                    icon: Layers,
                                    onClick: () => handleMakeAllItemsSplit(area.id)
                                }
                                ]}
                                className="text-white"
                            />
                            </div>
                        )}
                        </div>
                    </div>

                    <div className={`flex flex-wrap md:flex-nowrap items-center gap-3 transition-opacity w-full md:w-auto mt-1 md:mt-0 ${isPainting ? 'opacity-50 pointer-events-none' : 'opacity-100 md:opacity-50 md:group-hover:opacity-100'}`}>
                        <div className={`hidden md:flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-700 ${readOnly ? 'pointer-events-none' : ''}`}>
                            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">{t('views.EstimateForm.sections.ScopeOfWork.optional')}</span>
                            <div className="scale-75 origin-left">
                                <Toggle checked={isAreaOptional} onChange={(v) => updateAreaOptional(area.id, v)} />
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-1 md:flex-none">
                        {['Length', 'Width', 'Height'].map((dim) => {
                            const key = dim.toLowerCase() as 'length' | 'width' | 'height';
                            const val = area[key];
                            return (
                                <div
                                    key={key}
                                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 border shadow-sm transition-all flex-1 md:flex-none ${
                                    !val ? "border-amber-500/50 ring-1 ring-amber-500/20 bg-slate-800" : "border-slate-700 bg-slate-800 hover:border-slate-600"
                                    }`}
                                >
                                    <input
                                    type="number"
                                    disabled={isPainting || readOnly}
                                    className="w-full md:w-10 bg-transparent text-right font-bold text-sm text-white outline-none placeholder-slate-600"
                                    placeholder="0"
                                    value={val === 0 ? "" : val}
                                    onChange={(e) =>
                                        setEstimateAreas((prev) =>
                                        prev.map((a) => (a.id === area.id ? { ...a, [key]: parseFloat(e.target.value) || 0 } : a))
                                        )
                                    }
                                    />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{dim.charAt(0)}</span>
                                </div>
                            );
                        })}
                        </div>

                        {!readOnly && (
                        <div className="pl-2 border-l border-slate-700 hidden md:block">
                        <KebabMenu
                            onDelete={() => handleDeleteAreaBlock(area.id)}
                            onDuplicate={() => handleDuplicateArea(area.id)}
                            items={[
                            { label: t('views.EstimateForm.sections.ScopeOfWork.tableColumns'), icon: Settings2, onClick: () => { if(setActiveAreaForConfig) setActiveAreaForConfig(area.id); setIsColumnConfigOpen(true); } },
                            { label: t('views.EstimateForm.sections.ScopeOfWork.saveAsTemplate'), icon: Save, onClick: () => handleSaveAreaAsTemplate(area) },
                            {
                                label: t('views.EstimateForm.sections.ScopeOfWork.addNote'),
                                icon: StickyNote,
                                onClick: () => openRichTextModal(area.id, area.note || "", area.name + " " + t('views.EstimateForm.sections.ScopeOfWork.notesSuffix')),
                            },
                            {
                                label: t('views.EstimateForm.sections.ScopeOfWork.makeAllItemsSplit'),
                                icon: Layers,
                                onClick: () => handleMakeAllItemsSplit(area.id)
                            }
                            ]}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                        />
                        </div>
                        )}
                    </div>
                    </div>
                </div>

                {isExteriorMode ? (
                    <ExteriorAreaTable 
                        area={area}
                        settings={settings}
                        materials={materials}
                        paintColors={paintColors}
                        isPainting={isPainting}
                        paintingModeColorId={paintingModeColorId}
                        hasDimensions={hasDimensions}
                        handleRowDragStart={handleRowDragStart}
                        handleRowDrop={handleRowDrop}
                        updateAreaRow={updateAreaRow}
                        deleteAreaRow={deleteAreaRow}
                        handleOpenBreakdown={handleOpenBreakdown}
                        handlePaintRow={handlePaintRow}
                        checkForNewColor={checkForNewColor}
                        rates={rates}
                        readOnly={readOnly}
                    />
                ) : (
                    <InteriorAreaTable 
                        area={area}
                        settings={settings}
                        materials={materials}
                        paintColors={paintColors}
                        isPainting={isPainting}
                        paintingModeColorId={paintingModeColorId}
                        hasDimensions={hasDimensions}
                        handleRowDragStart={handleRowDragStart}
                        handleRowDrop={handleRowDrop}
                        updateAreaRow={updateAreaRow}
                        deleteAreaRow={deleteAreaRow}
                        handleOpenBreakdown={handleOpenBreakdown}
                        handlePaintRow={handlePaintRow}
                        checkForNewColor={checkForNewColor}
                        rates={rates}
                        readOnly={readOnly}
                    />
                )}

                {!readOnly && (
                <div className={`flex items-center justify-between mt-3 ${isPainting ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center justify-between mt-4 w-full">
                  <button
                    id="add-item-btn-trigger"
                    onClick={() => openAddItemModal(area.id)}
                    disabled={!hasDimensions}
                    className={`font-bold text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-1.5 w-auto border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 transition-colors text-xs py-2 px-3 whitespace-nowrap shrink-0 md:text-base md:gap-2 md:py-2 md:px-4 ${
                      !hasDimensions ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <Plus className="w-4 h-4 md:mr-1" /> 
                    <span className="md:hidden">{t('views.EstimateForm.sections.ScopeOfWork.addItem')}</span>
                    <span className="hidden md:inline">{t('views.EstimateForm.sections.ScopeOfWork.addLineItem')}</span>
                  </button>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div className="flex flex-col items-end md:flex-row md:items-center">
                      <div className="text-[10px] md:text-sm text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider md:normal-case md:font-medium md:text-gray-500 md:tracking-normal md:mr-1">
                        {t('views.EstimateForm.sections.ScopeOfWork.totalHrs')}
                      </div>
                      <div className="font-black text-gray-900 dark:text-white text-sm md:text-base md:font-bold">
                        {(colTotals.totalHrs).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
                </div>
                )}
                {(area.note !== undefined && !isPainting) && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div
                      onClick={() => !readOnly && openRichTextModal(area.id, area.note || "", area.name + " " + t('views.EstimateForm.sections.ScopeOfWork.notesSuffix'))}
                      className={`p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 group/note relative flex items-start gap-3 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-white dark:hover:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600 transition-all'}`}
                    >
                      <div className="pt-0.5 text-gray-300 dark:text-gray-600">
                        <StickyNote className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        {area.note ? (
                          <div
                            className="prose prose-sm max-w-none text-gray-600 dark:text-gray-300"
                            dangerouslySetInnerHTML={{ __html: area.note }}
                          />
                        ) : (
                          <div className="text-gray-400 dark:text-gray-500 italic">{t('views.EstimateForm.sections.ScopeOfWork.clickToAddNotes', { name: area.name })}</div>
                        )}
                      </div>
                      {!readOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAreaNote(area.id, undefined);
                        }}
                        className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-100 lg:opacity-0 lg:group-hover/note:opacity-100 transition-all"
                        title={t('views.EstimateForm.sections.ScopeOfWork.removeNote')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          else if (miscItem && !isPainting) {
            const isMiscOptional = miscItem.isOptional || false;
            const isPercent = miscItem.operationType === 'percent';
            
            const profitMargin = settings.financialModel?.miscExpenseProfit || 0;
            const applyProfit = settings.financialModel?.applyProfitToMisc && miscItem.operationType !== 'percent';
            const baseTotal = miscItem.total;
            const profitAmount = applyProfit ? baseTotal * (profitMargin / 100) : 0;
            const clientTotal = baseTotal + profitAmount;

            return (
              <div
                key={miscItem.id}
                draggable={!readOnly}
                onDragStart={(e) => !readOnly && handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => !readOnly && handleDrop(e, index)}
                className={`group relative border-b border-gray-200 dark:border-gray-700 pb-6 mb-6 last:border-0 last:mb-0 last:pb-0 transition-all ${
                  isMiscOptional ? "bg-amber-50/30 dark:bg-amber-900/10 p-4 -mx-4 rounded-lg" : ""
                }`}
              >
                <div className="flex gap-3">
                  {!readOnly && (
                  <div className="pt-2 cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 active:cursor-grabbing opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1 flex items-center gap-3">
                        <input
                          type="text"
                          disabled={readOnly}
                          className={`text-lg font-bold bg-transparent border-none outline-none w-full font-heading placeholder-gray-300 dark:placeholder-gray-600 p-0 focus:ring-0 ${
                            isMiscOptional ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"
                          }`}
                          value={miscItem.description}
                          onChange={(e) => updateMiscLineItem(miscItem.id, "description", e.target.value)}
                          placeholder={t('views.EstimateForm.sections.ScopeOfWork.sectionTitle')}
                        />
                        {isMiscOptional && (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {t('views.EstimateForm.sections.ScopeOfWork.optional')}
                          </span>
                        )}
                      </div>
                      
                      {!readOnly && (
                      <div className="hidden md:flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity pl-2">
                        <div className="flex items-center gap-2 mr-2">
                          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{t('views.EstimateForm.sections.ScopeOfWork.optional')}</span>
                          <Toggle
                            checked={isMiscOptional}
                            onChange={(v) => updateMiscLineItem(miscItem.id, "isOptional", v)}
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteMiscItemBlock(miscItem.id)}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      )}

                      {!readOnly && (
                      <div className="md:hidden pl-2">
                         <KebabMenu 
                            onDelete={() => handleDeleteMiscItemBlock(miscItem.id)}
                            items={[
                                { label: isMiscOptional ? t('views.EstimateForm.sections.ScopeOfWork.markRequired') : t('views.EstimateForm.sections.ScopeOfWork.markOptional'), icon: isMiscOptional ? CheckSquare : Square, onClick: () => updateMiscLineItem(miscItem.id, "isOptional", !isMiscOptional) }
                            ]}
                         />
                      </div>
                      )}

                    </div>
                    <div
                      onClick={() => !readOnly && openRichTextModal(miscItem.id, miscItem.details || "", miscItem.description)}
                      className={`w-full bg-transparent border-none outline-none text-base text-gray-600 dark:text-gray-300 p-0 leading-relaxed rounded min-h-[3rem] ${
                        !miscItem.details ? "text-gray-300 dark:text-gray-600" : ""
                      } ${isMiscOptional ? "opacity-75" : ""} ${readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      {miscItem.details ? (
                        <div dangerouslySetInnerHTML={{ __html: miscItem.details }} />
                      ) : (
                        miscItem.placeholder || t('views.EstimateForm.sections.ScopeOfWork.clickToAddDetails')
                      )}
                    </div>
                    {miscItem.itemType === "priced" && (
                      <div
                        className={`mt-3 pt-3 border-t flex flex-wrap gap-4 items-center ${
                          isMiscOptional ? "border-amber-200 dark:border-amber-800" : "border-gray-100 dark:border-gray-700"
                        }`}
                      >
                        <div className={`flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 border border-gray-200 dark:border-gray-600 ${readOnly ? 'pointer-events-none opacity-80' : ''}`}>
                            <button 
                                onClick={() => updateMiscLineItem(miscItem.id, "operationType", "flat")}
                                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${!isPercent ? 'bg-white dark:bg-gray-600 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t('views.EstimateForm.sections.ScopeOfWork.flatDollar')}
                            </button>
                            <button
                                onClick={() => updateMiscLineItem(miscItem.id, "operationType", "percent")}
                                className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${isPercent ? 'bg-white dark:bg-gray-600 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {t('views.EstimateForm.sections.ScopeOfWork.percentPct')}
                            </button>
                        </div>

                        {!isPercent && (
                            <>
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary-100 focus-within:border-primary-400">
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">{t('views.EstimateForm.sections.ScopeOfWork.qty')}</span>
                            <input
                                type="number"
                                disabled={readOnly}
                                className="w-16 bg-transparent border-none outline-none text-sm font-bold text-gray-900 dark:text-white text-center"
                                value={miscItem.quantity === 0 ? "" : miscItem.quantity}
                                onChange={(e) =>
                                updateMiscLineItem(miscItem.id, "quantity", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                            />
                            </div>
                            <span className="text-gray-300 dark:text-gray-600">×</span>
                            </>
                        )}

                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary-100 focus-within:border-primary-400">
                          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">{isPercent ? t('views.EstimateForm.sections.ScopeOfWork.percent') : t('views.EstimateForm.sections.ScopeOfWork.price')}</span>
                          {!isPercent && <span className="text-gray-400 dark:text-gray-500 text-sm">$</span>}
                          <input
                            type="number"
                            disabled={readOnly}
                            className="w-20 bg-transparent border-none outline-none text-sm font-bold text-gray-900 dark:text-white"
                            value={miscItem.unitPrice === 0 ? "" : miscItem.unitPrice}
                            onChange={(e) =>
                              updateMiscLineItem(miscItem.id, "unitPrice", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                          />
                          {isPercent && <span className="text-gray-400 dark:text-gray-500 text-sm"><Percent className="w-3 h-3" /></span>}
                        </div>
                        
                        <div className="ml-auto font-bold text-gray-900 dark:text-white text-lg">${clientTotal.toFixed(2)}</div>
                      </div>
                    )}
                    
                    {(applyProfit && miscItem.itemType === 'priced') && (
                        <div className="w-full mt-2 px-3 py-2 bg-green-50/80 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-1.5 text-green-800 dark:text-green-300 font-bold uppercase tracking-wider text-[10px]">
                                <TrendingUp className="w-3 h-3" /> {t('views.EstimateForm.sections.ScopeOfWork.profit', { profitMargin })}
                            </div>
                            <div className="flex items-center gap-3 text-green-900 dark:text-green-200">
                                <div className="flex items-center gap-1">
                                    <span className="text-green-600 dark:text-green-400">{t('views.EstimateForm.sections.ScopeOfWork.cost')}</span>
                                    <span className="font-medium">${baseTotal.toFixed(2)}</span>
                                </div>
                                <span className="text-green-300 dark:text-green-700 hidden sm:inline">|</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-green-600 dark:text-green-400">{t('views.EstimateForm.sections.ScopeOfWork.markup')}</span>
                                    <span className="font-medium">+${profitAmount.toFixed(2)}</span>
                                </div>
                                <span className="text-green-300 dark:text-green-700 hidden sm:inline">|</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-green-600 dark:text-green-400">{t('views.EstimateForm.sections.ScopeOfWork.final')}</span>
                                    <span className="font-bold">${clientTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}

        {!readOnly && !isPainting && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6 text-center">
          <button
            id="add-misc-item-trigger"
            onClick={() => setIsLineItemModalOpen(true)}
            className="text-base font-bold text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
          >
            {t('views.EstimateForm.sections.ScopeOfWork.add')} <Plus className="w-5 h-5" />
          </button>
        </div>
        )}
      </div>
    </section>
  );
};
