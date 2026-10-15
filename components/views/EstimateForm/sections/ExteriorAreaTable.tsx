
import React, { useState } from 'react';
import { GripVertical, Info, CheckSquare, Square, Trash2, AlertCircle, Clock, Droplets, Layers } from 'lucide-react';
import { EstimateArea, EstimateRow, GlobalSettings, Material, PaintColorEntry, ProductionRate } from '../../../../types';
import { SmartMathInput, KebabMenu } from '../../../UI';
import { calculateMaterial, calculateExteriorProductionHours } from '../../../../services/calcEngine';
import { CoatSplitModal } from '../../../modals/CoatSplitModal';
import { useTranslation } from '@/i18n/LanguageContext';

interface ExteriorAreaTableProps {
  area: EstimateArea;
  settings: GlobalSettings;
  materials?: Material[];
  paintColors?: PaintColorEntry[];
  isPainting: boolean;
  paintingModeColorId?: string | null;
  hasDimensions: boolean;
  
  // Actions
  handleRowDragStart: (e: React.DragEvent, areaId: string, rowId: string) => void;
  handleRowDrop: (e: React.DragEvent, areaId: string, targetRowId: string) => void;
  updateAreaRow: (areaId: string, rowId: string, field: string, value: any) => void;
  deleteAreaRow: (areaId: string, rowId: string) => void;
  handleOpenBreakdown: (areaName: string, row: EstimateRow) => void;
  handlePaintRow?: (areaId: string, rowId: string) => void;
  checkForNewColor?: (colorCode: string) => void;
  
  // Added rates
  rates: ProductionRate[];
  readOnly?: boolean;
}

export const ExteriorAreaTable: React.FC<ExteriorAreaTableProps> = ({
  area,
  settings,
  materials,
  paintColors,
  isPainting,
  paintingModeColorId,
  hasDimensions,
  handleRowDragStart,
  handleRowDrop,
  updateAreaRow,
  deleteAreaRow,
  handleOpenBreakdown,
  handlePaintRow,
  checkForNewColor,
  rates,
  readOnly
}) => {
  const { t } = useTranslation();
  const [activeSplitRow, setActiveSplitRow] = useState<EstimateRow | null>(null);

  // STRICT Exterior Column Order
  // Replaced individual coat columns with single 'sys-coats'
  const exteriorColumnOrder = [
      'sys-item', 
      'sys-color', 
      'sys-amount', // Added Amount column for clarity
      'sys-coats',  // Single Coats column
      'sys-hours', 
      'col-wash', 'col-prep', 'col-caulk', 'col-plastic', 'col-prime', 
      'sys-gallons'
  ];

  // Resolve columns.
  const visibleColumns = exteriorColumnOrder
    .map(id => settings.extraColumns.find(c => c.id === id))
    .filter(Boolean)
    .filter(c => c!.visible) as typeof settings.extraColumns;

  // Helper for Row Display only (Restricted to Coats as requested)
  // Calculates on the fly to ensure accuracy if state is 0 but inputs are present
  const getDisplayHours = (row: EstimateRow) => {
      let hours = 0;
      if (row.isHoursOverridden) {
          hours = row.hours || 0;
      } else {
          const rate = rates.find(r => r.id === row.productionRateId);
          if (rate) {
              hours = calculateExteriorProductionHours(row, rate, settings);
          } else {
              hours = row.hours || 0;
          }
      }
      // Round to 2 decimals per requirement
      return Math.round(hours * 100) / 100;
  };

  // Helper for row totals (Grand Total for Footer / Calculation)
  // Re-uses the display logic so totals match what's visible
  const getRowTotalHours = (row: EstimateRow) => {
    return getDisplayHours(row);
  };

  const colTotals = area.rows.reduce(
    (acc, row) => {
      if (row.isOptional && !area.isOptional) return acc;
      // Sum rounded values
      acc.totalHrs += getRowTotalHours(row); 
      
      // Accumulate other columns for footer
      settings.extraColumns.forEach((col) => {
        if (col.type === "hours" && !['col-coat1', 'col-coat2', 'col-coat3'].includes(col.id)) {
          acc[col.id] = (acc[col.id] || 0) + (Number(row.customValues[col.id]) || 0);
        }
      });
      return acc;
    },
    { totalHrs: 0 } as Record<string, number>
  );

  return (
    <>
        {/* Desktop Table View */}
        <div className="hidden lg:block w-full overflow-x-auto custom-scrollbar relative border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl mb-4 bg-white dark:bg-gray-800">
        {!hasDimensions && !readOnly && (
            <div className="absolute inset-0 z-10 bg-white/60 dark:bg-gray-800/60 backdrop-blur-[1px] flex items-center justify-center">
            <div className="bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg shadow-md border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-amber-800 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-bold text-xs">{t('views.EstimateForm.sections.ExteriorAreaTable.enterDimensionsToEdit')}</span>
            </div>
            </div>
        )}
        <table className="w-full min-w-[1200px]">
            <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-left">
                <th className="px-1 py-2 w-8"></th>
                {visibleColumns.map((col) => {
                let thClass = "px-2 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-default";
                if (col.id === 'sys-item') thClass += " min-w-[200px] w-[25%] text-left pl-4";
                else thClass += " text-center min-w-[110px]"; // WIDER COLUMNS (was 80px)
                
                // Customize Label for Coats to indicate Quantity
                let label = col.label;
                if (col.id.includes('coat')) label += ' (Qty)';

                return <th key={col.id} className={thClass}>{label}</th>;
                })}
                <th className="px-1 py-2 w-8"></th>
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {area.rows.map((row) => {
                const isRowOptional = row.isOptional || false;
                const isMatchedColor = isPainting && row.colorNum === paintingModeColorId;
                
                // Exterior Gallon Calc
                let estGallons = 0;
                if (row.colorNum && materials && paintColors) {
                    const paintEntry = paintColors.find(pc => pc.colorCode === row.colorNum);
                    if (paintEntry?.productId) {
                        const material = materials.find(m => m.id === paintEntry.productId);
                        if (material) {
                            const { requiredWithWaste } = calculateMaterial(row.amount, material, row.coats, settings.wasteEnabled ? settings.wastePercentage : 0, row.coatQuantities);
                            estGallons = requiredWithWaste;
                        }
                    }
                }

                return (
                <tr
                    key={row.id}
                    className={`transition-colors group ${isPainting ? (isMatchedColor ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer') : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} ${isRowOptional ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}
                    draggable={!isPainting && !readOnly}
                    onDragStart={(e) => handleRowDragStart(e, area.id, row.id)}
                    onDrop={(e) => handleRowDrop(e, area.id, row.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => isPainting && handlePaintRow && handlePaintRow(area.id, row.id)}
                >
                    {/* Drag Handle */}
                    <td className="px-1 py-2 text-center text-gray-300 dark:text-gray-600">
                        {isPainting ? (
                            isMatchedColor && <div className="w-2 h-2 rounded-full bg-primary-500 mx-auto animate-pulse" />
                        ) : (
                            !readOnly && (
                            <div className="cursor-grab hover:text-gray-500 dark:hover:text-gray-400 active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical className="w-4 h-4" />
                            </div>
                            )
                        )}
                    </td>

                    {/* Columns */}
                    {visibleColumns.map(col => {
                        // System: Item Name
                        if (col.id === 'sys-item') {
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <div className="flex flex-col">
                                        <input
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            className={`w-full bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-primary-400 outline-none font-bold text-base disabled:text-gray-400 dark:disabled:text-gray-500 transition-all ${isRowOptional ? "text-gray-500 dark:text-gray-400 line-through decoration-amber-500/50" : "text-gray-900 dark:text-white"} ${isPainting ? 'pointer-events-none' : ''}`}
                                            value={row.item}
                                            onChange={(e) => updateAreaRow(area.id, row.id, "item", e.target.value)}
                                        />
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{row.unit}</span>
                                    </div>
                                </td>
                            );
                        }
                        
                        // System: Color
                        if (col.id === 'sys-color') {
                            return (
                                <td key={col.id} className="px-4 py-2 text-center">
                                    {isPainting ? (
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${isMatchedColor ? 'bg-primary-500 text-white shadow-lg scale-110' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>
                                            {row.colorNum}
                                        </span>
                                    ) : (
                                        <input
                                            disabled={!hasDimensions || readOnly}
                                            className={`w-full bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-primary-400 outline-none font-medium text-center text-base disabled:text-gray-400 dark:disabled:text-gray-500 ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}
                                            value={row.colorNum}
                                            onChange={(e) => updateAreaRow(area.id, row.id, "colorNum", e.target.value)}
                                            onBlur={(e) => checkForNewColor && checkForNewColor(e.target.value)}
                                        />
                                    )}
                                </td>
                            );
                        }

                        // System: Amount (SqFt/LnFt)
                        if (col.id === 'sys-amount') {
                            const hasSplit = row.coatQuantities && row.coatQuantities.some(q => q !== row.amount);
                            
                            if (hasSplit && row.coatQuantities) {
                                return (
                                    <td key={col.id} className="px-4 py-2">
                                        <div 
                                            onClick={() => setActiveSplitRow(row)}
                                            className="cursor-pointer bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md px-2 py-1.5 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group/split relative"
                                            title={t('views.EstimateForm.sections.ExteriorAreaTable.clickToEditSplit')}
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                {row.coatQuantities.map((q, i) => (
                                                    <div key={i} className="flex justify-between items-center gap-3">
                                                        <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px]">{t('views.EstimateForm.sections.ExteriorAreaTable.coatN', { n: i+1 })}</span>
                                                        <span className="font-bold text-gray-700 dark:text-gray-300">{q}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="absolute -top-1 -right-1 opacity-0 group-hover/split:opacity-100 transition-opacity">
                                                <div className="bg-blue-600 text-white rounded-full p-0.5 shadow-sm">
                                                    <Layers className="w-2 h-2" />
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                );
                            }

                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <SmartMathInput
                                        value={row.amount}
                                        onChange={(val) => {
                                            // Reset split if amount is changed manually
                                            if (row.coatQuantities) {
                                                updateAreaRow(area.id, row.id, "coatQuantities", undefined);
                                            }
                                            updateAreaRow(area.id, row.id, "amount", val);
                                        }}
                                        disabled={!hasDimensions || isPainting || readOnly}
                                        className={`!py-1 !px-2 !text-base bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-primary-400 focus:bg-white dark:focus:bg-gray-800 transition-all text-left font-medium min-w-[100px] ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"} ${isPainting ? 'pointer-events-none' : ''}`}
                                        placeholder="0"
                                    />
                                </td>
                            );
                        }

                        // System: Coats
                        if (col.id === 'sys-coats') {
                            const hasSplit = row.coatQuantities && row.coatQuantities.some(q => q !== row.amount);
                            
                            if (hasSplit) {
                                return (
                                    <td key={col.id} className="px-4 py-2">
                                        <div 
                                            onClick={(e) => { e.stopPropagation(); setActiveSplitRow(row); }}
                                            className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md py-1.5 px-2 text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group/coats relative"
                                            title={t('views.EstimateForm.sections.ExteriorAreaTable.splitActiveClickToEdit')}
                                        >
                                            <span className="font-bold text-blue-700 dark:text-blue-300">{row.coats}</span>
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                <Layers className="w-3 h-3 text-blue-500" />
                                            </div>
                                        </div>
                                    </td>
                                );
                            }

                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <div className="flex items-center gap-1 relative group/coats">
                                        <input
                                            type="number"
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            className={`w-full bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-primary-400 outline-none font-medium text-base disabled:text-gray-400 dark:disabled:text-gray-500 text-center ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"} ${isPainting ? 'pointer-events-none' : ''}`}
                                            value={row.coats} // Always show value, default is handled in data creation
                                            onChange={(e) => updateAreaRow(area.id, row.id, "coats", parseFloat(e.target.value) || 0)}
                                        />
                                        {!isPainting && !readOnly && hasDimensions && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveSplitRow(row); }}
                                                className={`p-1 rounded-md transition-all ${hasSplit ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 opacity-100 ring-1 ring-blue-200 dark:ring-blue-800' : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 opacity-0 group-hover/coats:opacity-100'}`}
                                                title={hasSplit ? t('views.EstimateForm.sections.ExteriorAreaTable.splitActiveLabel') : t('views.EstimateForm.sections.ExteriorAreaTable.splitCoatQuantities')}
                                            >
                                                <Layers className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            );
                        }

                        // System: Total Hours (Base + Coats)
                        if (col.id === 'sys-hours') {
                            return (
                                <td key={col.id} className="px-4 py-2">
                                    <div className={`w-full relative group/input`}>
                                        <SmartMathInput
                                            value={getDisplayHours(row)}
                                            onChange={(val) => {
                                                const rounded = Math.round(val * 100) / 100;
                                                updateAreaRow(area.id, row.id, "hours", rounded);
                                            }}
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            className={`!py-1 !px-2 !text-base bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-primary-400 focus:bg-white dark:focus:bg-gray-800 transition-all text-center font-bold min-w-[60px] ${
                                                isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"
                                            } ${isPainting ? 'pointer-events-none opacity-50' : ''}`}
                                            placeholder="0"
                                        />
                                    </div>
                                </td>
                            );
                        }

                        // System: Gallons
                        if (col.id === 'sys-gallons') {
                            return (
                                <td key={col.id} className="px-4 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                                    {estGallons > 0 ? estGallons.toFixed(1) : '-'}
                                </td>
                            );
                        }

                        // Explicit Logic for Exterior Columns
                        
                        // Coat Columns -> Smart Inputs (Quantities)
                        if (col.id.includes('coat')) {
                            const coatIndex = parseInt(col.id.replace('col-coat', '')) - 1; // 0-based index
                            const hasSplit = row.coatQuantities && row.coatQuantities.length > coatIndex && row.coatQuantities[coatIndex] !== row.amount;
                            
                            return (
                                <td key={col.id} className="px-2 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1 relative group/coats">
                                        <SmartMathInput
                                            value={Number(row.customValues[col.id]) || 0}
                                            onChange={(val) => updateAreaRow(area.id, row.id, col.id, val)}
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            className={`!bg-transparent !border-b !border-transparent hover:!border-gray-200 dark:hover:!border-gray-600 focus:!border-primary-400 outline-none text-center !text-base disabled:text-gray-300 dark:disabled:text-gray-600 ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white font-medium"} ${isPainting ? 'pointer-events-none' : ''}`}
                                            placeholder="0"
                                        />
                                        {/* Only show split button on Coat 1 column to manage all coats, or maybe just keep it simple and let them edit directly? 
                                            Actually, for Exterior, these ARE the quantities. The split modal is more for the "Unified" approach where you have ONE quantity column.
                                            But the user asked to "add it like as an extra feature where in when the user click something on the input field for that or maybe the header column it will show like the detailed sqft or qty per coat".
                                            
                                            Wait, for Exterior table, we ALREADY have separate columns for Coat 1, Coat 2, Coat 3. 
                                            So "Split Coats" modal is redundant here IF the user is using the Exterior Table view.
                                            
                                            HOWEVER, the user said: "lets change how the input for the interior and exterior estimate works because right now they completely two separate things... make it one thing preferrably the interior estimate one."
                                            
                                            AND: "now we are not deleting how we input the exterior estimate input for the coat we are now just adding it like as an extra feature"
                                            
                                            So, if I am in the "Exterior Table" (which has explicit columns), I probably don't need the modal because I can just type in the columns.
                                            BUT, if I am in the "Interior Table" (Unified view) but working on an Exterior area, I NEED the modal to set these specific coat values.
                                            
                                            The prompt implies we are keeping the Exterior Table as is ("not deleting how we input...").
                                            
                                            So, for THIS file (ExteriorAreaTable), we might not strictly need the modal if the columns are already there.
                                            BUT, if the user switches views, we need to ensure data syncs.
                                            
                                            Let's add the modal trigger to the "Coats" column if it exists, or maybe just leave this table as "Explicit Mode".
                                            
                                            Actually, looking at the code, `ExteriorAreaTable` DOES NOT have a `sys-coats` column usually, it has `col-coat1`, `col-coat2` etc.
                                            
                                            If the user wants to use the "Unified" approach for Exterior, they would likely use the `InteriorAreaTable` component (or a unified component) even for exterior areas.
                                            
                                            BUT, the `ScopeOfWork` component chooses which table to render based on `isExteriorMode`.
                                            
                                            If I am in `ExteriorAreaTable`, I see `col-coat1`, `col-coat2`, etc.
                                            If I edit `col-coat1`, I am setting the quantity for Coat 1.
                                            
                                            The `coatQuantities` array on `EstimateRow` is the new source of truth.
                                            We need to ensure that when `col-coatX` is updated here, it UPDATES `coatQuantities` in the background too?
                                            OR, does `coatQuantities` replace `customValues['col-coatX']`?
                                            
                                            The `calculateLabor` function now uses `coatQuantities`.
                                            The `calculateExteriorProductionHours` function was updated to use `coatQuantities` if present.
                                            
                                            So, we need to make sure that editing these inputs updates `coatQuantities`.
                                            
                                            AND, we should probably add the modal here too just for consistency if they want to see it all in one place?
                                            Actually, the user said "when the user click something on the input field for that... it will show like the detailed sqft".
                                            
                                            In `ExteriorAreaTable`, the inputs ARE the detailed sqft. So the modal is less critical here.
                                            
                                            However, to fully support the "Unified" vision, we should probably ensure that `ExteriorAreaTable` writes to `coatQuantities`.
                                            
                                            Let's just add the modal to the `sys-coats` column if it were here, but it's not.
                                            
                                            Wait, `ExteriorAreaTable` has `col-coat1`, `col-coat2`...
                                            
                                            Let's stick to the plan: The "Unified" input is primarily for the `InteriorAreaTable` (which is now the "Standard" table).
                                            The `ExteriorAreaTable` is the "Legacy/Advanced" view where you see everything explicitly.
                                            
                                            So, I will NOT add the modal to `ExteriorAreaTable` columns because they are already explicit.
                                            I WILL ensure that updates to these columns sync to `coatQuantities` if possible, or rely on the fact that `calculateExteriorProductionHours` handles both.
                                            
                                            Actually, `calculateExteriorProductionHours` prefers `coatQuantities`.
                                            So if I edit `col-coat1` here, it updates `customValues['col-coat1']`.
                                            Does `calculateExteriorProductionHours` handle that? Yes, it falls back to `customValues`.
                                            
                                            So `ExteriorAreaTable` is fine as is?
                                            
                                            User said: "now we are not deleting how we input the exterior estimate input for the coat we are now just adding it like as an extra feature"
                                            
                                            This implies the "Extra Feature" (Modal) is for the "Unified" view (Interior style).
                                            
                                            So I might have been right to focus on `InteriorAreaTable`.
                                            
                                            BUT, I should probably check if I need to do anything here.
                                            
                                            If the user switches from "Unified" (Interior Table) to "Explicit" (Exterior Table), they expect to see the values they entered in the modal.
                                            
                                            The `ExteriorAreaTable` reads from `row.customValues['col-coat1']`.
                                            The `CoatSplitModal` writes to `row.coatQuantities`.
                                            
                                            We have a data sync issue. `coatQuantities` [100, 100] vs `customValues` { 'col-coat1': 100 }.
                                            
                                            We should probably migrate `ExteriorAreaTable` to read/write `coatQuantities` instead of `customValues` for these specific columns?
                                            OR, ensure they stay in sync.
                                            
                                            For now, let's leave `ExteriorAreaTable` mostly alone, but maybe add the modal to the `sys-item` or `sys-hours` column as a "Quick Edit" feature?
                                            
                                            Actually, I'll just add the modal capability to `ExteriorAreaTable` just in case, but attach it to a button?
                                            
                                            No, let's look at `ScopeOfWork.tsx`. It renders `ExteriorAreaTable` if `isExteriorMode` is true.
                                            
                                            If I want to "make it one thing preferably the interior estimate one", I should probably encourage using `InteriorAreaTable` for everything, and only use `ExteriorAreaTable` if explicitly requested.
                                            
                                            The user said: "we are now just adding it like as an extra feature where in when the user click something on the input field for that or maybe the header column it will show like the detailed sqft or qty per coat".
                                            
                                            This confirms the Modal approach on the "Unified" table.
                                            
                                            I will NOT modify `ExteriorAreaTable` to add the modal, as it already shows the details.
                                            I WILL however, make sure `ExteriorAreaTable` is compatible with `coatQuantities` if I can.
                                            
                                            Actually, let's just finish the `InteriorAreaTable` changes (I think I did that).
                                            
                                            Wait, I was editing `ExteriorAreaTable.tsx` in the previous turn but it got cut off?
                                            No, I viewed it.
                                            
                                            Let's look at `ScopeOfWork.tsx` again.
                                            I need to make sure `InteriorAreaTable` is used more often?
                                            
                                            "lets change how the input for the interior and exterior estimate works... make it one thing preferrably the interior estimate one."
                                            
                                            This means we should probably DEFAULT to `InteriorAreaTable` even for Exterior scopes, UNLESS the user explicitly turns on the "Exterior Columns" (Coat 1, Coat 2, etc).
                                            
                                            If they turn on those columns, `isExteriorMode` becomes true, and we switch to `ExteriorAreaTable`.
                                            
                                            So, the plan is:
                                            1. `InteriorAreaTable` now supports "Split Coats" via Modal. (Done)
                                            2. This allows it to handle Exterior-like complexity without the extra columns.
                                            3. If the user wants to see the columns, they enable them, and `ScopeOfWork` switches to `ExteriorAreaTable`.
                                            
                                            So `ExteriorAreaTable` just needs to handle the data correctly.
                                            
                                            If `coatQuantities` exists, `ExteriorAreaTable` should probably display those values in the `col-coatX` columns?
                                            
                                            Yes.
                                            
                                            So I SHOULD modify `ExteriorAreaTable` to read from `coatQuantities` if available, and write to it.
                                            
                                            Let's modify `ExteriorAreaTable` to sync with `coatQuantities`.
                                        */
                                        }
                                        <SmartMathInput
                                            value={
                                                (row.coatQuantities && row.coatQuantities.length > coatIndex) 
                                                    ? row.coatQuantities[coatIndex] 
                                                    : (Number(row.customValues[col.id]) || 0)
                                            }
                                            onChange={(val) => {
                                                // We need to update BOTH customValues (legacy/display) AND coatQuantities (new logic)
                                                // Or better yet, have a unified update handler.
                                                // For now, let's update the customValue, and let the parent/reducer handle syncing if needed?
                                                // Or just update customValues here, and let the calc engine fallback?
                                                // The calc engine prefers coatQuantities.
                                                
                                                // If we only update customValues, and coatQuantities exists, the calc engine will ignore our update!
                                                // So we MUST update coatQuantities if it exists.
                                                
                                                if (row.coatQuantities) {
                                                    const newCoats = [...row.coatQuantities];
                                                    // Ensure array is long enough
                                                    while (newCoats.length <= coatIndex) newCoats.push(0);
                                                    newCoats[coatIndex] = val;
                                                    updateAreaRow(area.id, row.id, 'coatQuantities', newCoats);
                                                }
                                                
                                                // Always update the legacy customValue for display/compatibility
                                                updateAreaRow(area.id, row.id, col.id, val);
                                            }}
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            className={`!bg-transparent !border-b !border-transparent hover:!border-gray-200 dark:hover:!border-gray-600 focus:!border-primary-400 outline-none text-center !text-base disabled:text-gray-300 dark:disabled:text-gray-600 ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white font-medium"} ${isPainting ? 'pointer-events-none' : ''}`}
                                            placeholder="0"
                                        />
                                    </div>
                                </td>
                            );
                        }

                        // Prep/Wash/Prime -> Can be Checkbox OR Hours depending on type setting, but strictly handled
                        return (
                            <td key={col.id} className="px-2 py-2 text-center">
                                {col.type === "checkbox" ? (
                                    <div className="flex justify-center">
                                        <button
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            onClick={() => updateAreaRow(area.id, row.id, col.id, !row.customValues[col.id])}
                                            className={`h-8 w-12 rounded-md border flex items-center justify-center transition-all duration-200 text-xs font-bold uppercase tracking-wider ${row.customValues[col.id] ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-400'} ${(!hasDimensions || isPainting || readOnly) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                                        >
                                            {row.customValues[col.id] ? t('views.EstimateForm.sections.ExteriorAreaTable.yes') : t('views.EstimateForm.sections.ExteriorAreaTable.no')}
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="number"
                                        disabled={!hasDimensions || isPainting || readOnly}
                                        className={`w-full bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:border-primary-400 outline-none text-center text-base disabled:text-gray-300 dark:disabled:text-gray-600 ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white font-medium"} ${isPainting ? 'pointer-events-none' : ''}`}
                                        value={row.customValues[col.id] !== undefined ? (Number(row.customValues[col.id]) === 0 ? "" : Number(row.customValues[col.id])) : ""}
                                        onChange={(e) => updateAreaRow(area.id, row.id, col.id, parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                )}
                            </td>
                        );
                    })}

                    {/* Kebab */}
                    <td className="px-1 py-2 text-right w-8">
                        {(hasDimensions && !isPainting && !readOnly) && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                            <KebabMenu items={[
                                { label: t('views.EstimateForm.sections.ExteriorAreaTable.breakdown'), icon: Info, onClick: () => handleOpenBreakdown(area.name, row) },
                                { label: isRowOptional ? t('views.EstimateForm.sections.ExteriorAreaTable.markRequired') : t('views.EstimateForm.sections.ExteriorAreaTable.markOptional'), icon: isRowOptional ? CheckSquare : Square, onClick: () => updateAreaRow(area.id, row.id, "isOptional", !row.isOptional) },
                                { label: t('views.EstimateForm.sections.ExteriorAreaTable.deleteRow'), icon: Trash2, onClick: () => deleteAreaRow(area.id, row.id), className: "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" },
                            ]} />
                        </div>
                        )}
                        {readOnly && (
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => handleOpenBreakdown(area.name, row)}>
                                <Info className="w-4 h-4" />
                            </button>
                        )}
                    </td>
                </tr>
                );
            })}
            </tbody>
            <tfoot>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <td className="px-1 py-2" />
                    {visibleColumns.map(col => {
                        if (col.id === 'sys-item') return <td key={col.id} className="px-4 py-2 font-bold text-gray-500 dark:text-gray-400 text-right uppercase tracking-wider text-xs">{t('views.EstimateForm.sections.ExteriorAreaTable.totals')}</td>;
                        if (col.id === 'sys-hours') return <td key={col.id} className="px-4 py-2"><div className="px-2 py-0.5 rounded-md font-bold text-center w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">{colTotals.totalHrs.toFixed(2)}</div></td>;
                        
                        // For Coats columns (Qty), we skip summing them in footer for now or sum quantity
                        if (['col-coat1', 'col-coat2', 'col-coat3'].includes(col.id)) return <td key={col.id} className="px-2 py-2"></td>;

                        if (col.type === 'hours') return <td key={col.id} className="px-2 py-2 text-center"><div className="px-1 py-0.5 rounded-md font-bold text-center w-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">{(colTotals[col.id] || 0).toFixed(2)}</div></td>;
                        
                        return <td key={col.id} className="px-2 py-2"></td>
                    })}
                    <td className="px-1 py-2" />
                </tr>
            </tfoot>
        </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
            {!hasDimensions && !readOnly && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-3 text-amber-800 dark:text-amber-400 text-sm font-bold">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {t('views.EstimateForm.sections.ExteriorAreaTable.enterDimensionsMobile')}
                </div>
            )}
            {area.rows.map((row) => {
                const isRowOptional = row.isOptional || false;
                const isMatchedColor = isPainting && row.colorNum === paintingModeColorId;
                
                let estGallons = 0;
                if (row.colorNum && materials && paintColors) {
                    const paintEntry = paintColors.find(pc => pc.colorCode === row.colorNum);
                    if (paintEntry?.productId) {
                        const material = materials.find(m => m.id === paintEntry.productId);
                        if (material) {
                            const { requiredWithWaste } = calculateMaterial(row.amount, material, row.coats, settings.wasteEnabled ? settings.wastePercentage : 0, row.coatQuantities);
                            estGallons = requiredWithWaste;
                        }
                    }
                }

                return (
                    <div
                    key={row.id}
                    onClick={() => isPainting && handlePaintRow && handlePaintRow(area.id, row.id)}
                    className={`bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm relative transition-all ${
                        isPainting ? (isMatchedColor ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'active:bg-gray-50 dark:active:bg-gray-700 border-dashed') : 
                        (isRowOptional ? "border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-900/10" : "border-gray-200 dark:border-gray-700")
                    }`}
                    >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 mr-2">
                        <input
                            disabled={!hasDimensions || isPainting || readOnly}
                            className={`w-full bg-transparent font-bold text-lg outline-none border-b border-transparent focus:border-primary-400 placeholder-gray-400 dark:placeholder-gray-600 ${
                            isRowOptional ? "text-gray-500 dark:text-gray-400 line-through" : "text-gray-900 dark:text-white"
                            } ${isPainting ? 'pointer-events-none' : ''}`}
                            value={row.item}
                            onChange={(e) => updateAreaRow(area.id, row.id, "item", e.target.value)}
                            placeholder={t('views.EstimateForm.sections.ExteriorAreaTable.itemNamePlaceholder')}
                        />
                        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">{row.unit}</div>
                        </div>
                        {(hasDimensions && !isPainting && !readOnly) && (
                        <KebabMenu
                            items={[
                            { label: t('views.EstimateForm.sections.ExteriorAreaTable.breakdown'), icon: Info, onClick: () => handleOpenBreakdown(area.name, row) },
                            {
                                label: isRowOptional ? t('views.EstimateForm.sections.ExteriorAreaTable.markRequired') : t('views.EstimateForm.sections.ExteriorAreaTable.markOptional'),
                                icon: isRowOptional ? CheckSquare : Square,
                                onClick: () => updateAreaRow(area.id, row.id, "isOptional", !isRowOptional),
                            },
                            {
                                label: t('views.EstimateForm.sections.ExteriorAreaTable.deleteRow'),
                                icon: Trash2,
                                onClick: () => deleteAreaRow(area.id, row.id),
                                className: "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30",
                            },
                            ]}
                        />
                        )}
                    </div>
                    
                    {/* Mobile Grid Layout */}
                    <div className={`grid grid-cols-2 gap-4 mb-4 ${isPainting ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">
                            {t('views.EstimateForm.sections.ExteriorAreaTable.amountUnit', { unit: row.unit })}
                            </label>
                            {(row.coatQuantities && row.coatQuantities.some(q => q !== row.amount)) ? (
                                <div 
                                    onClick={() => setActiveSplitRow(row)}
                                    className="cursor-pointer bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    <div className="flex flex-col gap-1">
                                        {row.coatQuantities.map((q, i) => (
                                            <div key={i} className="flex justify-between items-center">
                                                <span className="font-bold text-blue-600 dark:text-blue-400 text-xs uppercase">{t('views.EstimateForm.sections.ExteriorAreaTable.coatN', { n: i+1 })}</span>
                                                <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{q}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <SmartMathInput
                                value={row.amount}
                                onChange={(val) => {
                                    if (row.coatQuantities) {
                                        updateAreaRow(area.id, row.id, "coatQuantities", undefined);
                                    }
                                    updateAreaRow(area.id, row.id, "amount", val);
                                }}
                                disabled={!hasDimensions || isPainting || readOnly}
                                className={`!py-2 !text-sm font-bold ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
                                placeholder="0"
                                />
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">
                            {t('views.EstimateForm.sections.ExteriorAreaTable.coats')}
                            </label>
                            {(row.coatQuantities && row.coatQuantities.some(q => q !== row.amount)) ? (
                                <div 
                                    onClick={(e) => { e.stopPropagation(); setActiveSplitRow(row); }}
                                    className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <span className="font-bold text-blue-700 dark:text-blue-300">{row.coats}</span>
                                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="number"
                                        disabled={!hasDimensions || isPainting || readOnly}
                                        className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded-lg outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-gray-800 transition-all font-bold text-sm text-center ${
                                        isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"
                                        }`}
                                        value={row.coats}
                                        onChange={(e) => updateAreaRow(area.id, row.id, "coats", parseFloat(e.target.value) || 0)}
                                    />
                                    {!isPainting && !readOnly && hasDimensions && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveSplitRow(row); }}
                                            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all ${
                                                (row.coatQuantities && row.coatQuantities.some(q => q !== row.amount))
                                                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800' 
                                                    : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                                            }`}
                                            title={t('views.EstimateForm.sections.ExteriorAreaTable.splitCoatQuantities')}
                                        >
                                            <Layers className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Extra Columns Mobile Grid */}
                    {visibleColumns.filter(c => c.type !== 'system' && !['sys-amount', 'sys-coats'].includes(c.id)).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 pt-2 border-t border-gray-50 dark:border-gray-700">
                            {visibleColumns
                            .filter((c) => c.type !== 'system' && !['sys-amount', 'sys-coats'].includes(c.id))
                            .map((col) => (
                                <div key={col.id} className="flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">
                                        {col.label}
                                    </label>
                                    
                                    {col.type === 'checkbox' ? (
                                        <button
                                            disabled={!hasDimensions || isPainting || readOnly}
                                            onClick={() => updateAreaRow(area.id, row.id, col.id, !row.customValues[col.id])}
                                            className={`h-9 w-full rounded-lg border flex items-center justify-center transition-all duration-200 text-xs font-bold uppercase tracking-wider ${
                                            row.customValues[col.id] 
                                                ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' 
                                                : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400'
                                            } ${(!hasDimensions || isPainting || readOnly) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {row.customValues[col.id] ? t('views.EstimateForm.sections.ExteriorAreaTable.yes') : t('views.EstimateForm.sections.ExteriorAreaTable.no')}
                                        </button>
                                    ) : (
                                        <input
                                            type="number"
                                            className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-400 dark:border-gray-500 rounded-lg outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-gray-800 transition-all font-bold text-sm text-center ${isRowOptional ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
                                            value={row.customValues[col.id] !== undefined ? (Number(row.customValues[col.id]) === 0 ? "" : Number(row.customValues[col.id])) : ""}
                                            onChange={(e) => updateAreaRow(area.id, row.id, col.id, parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            disabled={!hasDimensions || isPainting || readOnly}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className={`col-span-2 ${isPainting ? 'pointer-events-none' : ''}`}>
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-1">{t('views.EstimateForm.sections.ExteriorAreaTable.colorAssignment')}</label>
                            <div className={`flex items-center gap-2 p-1.5 rounded-lg border ${isMatchedColor ? 'bg-primary-100 border-primary-300 dark:bg-primary-900/30 dark:border-primary-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                            <input
                                type="text"
                                disabled={!hasDimensions || isPainting || readOnly}
                                className={`w-12 h-10 rounded-md text-center font-bold text-sm border-gray-400 dark:border-gray-500 border outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 ${isMatchedColor ? 'bg-primary-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'}`}
                                value={row.colorNum}
                                onChange={(e) => updateAreaRow(area.id, row.id, "colorNum", e.target.value)}
                                onBlur={(e) => checkForNewColor && checkForNewColor(e.target.value)}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('views.EstimateForm.sections.ExteriorAreaTable.colorHash')}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('views.EstimateForm.sections.ExteriorAreaTable.enterIdToLink')}</span>
                            </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5" title={t('views.EstimateForm.sections.ExteriorAreaTable.totalLaborHours')}>
                                <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                <span className="font-bold text-gray-700 dark:text-gray-300">{getRowTotalHours(row).toFixed(2)} {t('views.EstimateForm.sections.ExteriorAreaTable.hrsUnit')}</span>
                            </div>
                            <div className="flex items-center gap-1.5" title={t('views.EstimateForm.sections.ExteriorAreaTable.estimatedGallons')}>
                                <Droplets className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                                <span className="font-bold text-gray-700 dark:text-gray-300">{estGallons > 0 ? estGallons.toFixed(1) : '-'} {t('views.EstimateForm.sections.ExteriorAreaTable.galUnit')}</span>
                            </div>
                        </div>
                    </div>
                    </div>
                );
            })}
        </div>

        {activeSplitRow && (
            <CoatSplitModal
                isOpen={true}
                onClose={() => setActiveSplitRow(null)}
                baseQuantity={activeSplitRow.amount}
                coats={activeSplitRow.coats}
                initialQuantities={activeSplitRow.coatQuantities}
                onSave={(quantities) => updateAreaRow(area.id, activeSplitRow.id, 'coatQuantities', quantities)}
            />
        )}
    </>
  );
};
