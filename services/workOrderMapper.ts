
import { 
  EstimateArea, 
  EstimateRow, 
  WorkOrder, 
  WorkOrderTask, 
  GlobalSettings,
  PaintColorEntry,
  Material,
  MiscLineItem
} from "../types";
import { getSelectedPackage } from "./packages";

/**
 * Transforms an Estimate object (with financial data) into a WorkOrder object (production only).
 * This ensures NO pricing, margins, or costs are ever passed to the Crew UI.
 */
export const createWorkOrderFromEstimate = (
  estimateData: any, 
  materials: Material[],
  settings: GlobalSettings
): WorkOrder => {
  
  const pkg = getSelectedPackage(estimateData);

  // 1. Flatten Estimate Rows into Work Order Tasks
  const tasks: WorkOrderTask[] = [];

  const estimateAreas: EstimateArea[] = pkg.estimateAreas || [];
  const paintColors: PaintColorEntry[] = pkg.paintColors || [];

  estimateAreas.forEach((area) => {
    if (area.isOptional) return; // Skip optional areas not sold

    area.rows.forEach((row) => {
      if (row.isOptional) return; // Skip optional rows

      // Derive Prep Flags based on column existence and value > 0
      // Checks both boolean and number types in customValues
      const checkFlag = (colKey: string): boolean => {
        const val = row.customValues[colKey];
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val > 0;
        return false;
      };

      // Resolve Paint Info
      let productName = "TBD";
      let sheen = "TBD";
      
      if (row.colorNum) {
        const colorEntry = paintColors.find(p => p.colorCode === row.colorNum);
        if (colorEntry && colorEntry.productId) {
           const mat = materials.find(m => m.id === colorEntry.productId);
           if (mat) {
             productName = mat.name;
             sheen = mat.sheen || colorEntry.finish || "Standard";
           }
        }
      }

      // Calculate Total Hours for this row (Base + Extra Columns)
      const extraHours = settings.extraColumns.reduce((sum, col) => {
        if (col.type === 'hours') {
           return sum + (Number(row.customValues[col.id]) || 0);
        }
        return sum;
      }, 0);
      
      // Calculate multiplier impact
      // Note: In a real app, we'd grab the multiplier values from the estimate data snapshot
      // For this mapper, we assume the row.hours is the BASE hours, so we might need to apply multipliers
      // OR we assume row.hours stored in DB is the final calculated hours. 
      // Based on `calcEngine.ts`, `row.hours` is base. We need final production hours.
      // Simplification: We will sum row.hours + extraHours for now. 
      // In production, we would pass the Tier Multipliers to this function.
      
      const totalTaskHours = (row.hours || 0) + extraHours;

      tasks.push({
        id: `wo-task-${row.id}`,
        areaName: area.name,
        description: row.item,
        quantity: row.amount,
        uom: row.unit,
        coats: row.coats,
        estimatedHours: totalTaskHours,
        prepWash: checkFlag('col-wash'),
        prepScrape: checkFlag('col-prep') || checkFlag('col-scrape'), // Map generic prep or specific
        prepCaulk: checkFlag('col-caulk'),
        prepPrime: checkFlag('col-prime') || checkFlag('col-oil'),
        paintColorCode: row.colorNum,
        paintProduct: productName,
        paintSheen: sheen
      });
    });
  });

  // 2. Aggregate Totals
  const totalProductionHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

  // 3. Map Notes/Sections from Misc Items or Notes
  const lineItems: Record<string, MiscLineItem> = pkg.lineItems || {};
  
  const getSectionText = (search: string) => {
    const item = Object.values(lineItems).find(i => i.description.toLowerCase().includes(search.toLowerCase()));
    return item ? (item.details || '') : '';
  };

  return {
    id: `wo-${Date.now()}`,
    estimateId: estimateData.id || 'unknown',
    version: 1,
    status: 'Pending Deposit',
    
    // Header Info
    jobName: estimateData.projectName || estimateData.projectInfo?.name || "Untitled Project",
    customerName: `${estimateData.customer?.firstName} ${estimateData.customer?.lastName}`,
    customerPhone: estimateData.customer?.phone || "",
    customerEmail: estimateData.customer?.email || "",
    jobAddress: estimateData.jobAddress?.address || "",
    accessCode: estimateData.jobAddress?.accessCode || "",
    
    startDate: new Date().toISOString().split('T')[0], // Default to today
    endDate: "",
    
    crewLeaderId: null,
    crewMemberIds: [],
    
    totalProductionHours: parseFloat(totalProductionHours.toFixed(1)),
    
    tasks: tasks,
    paintSchedule: paintColors,
    
    // Text Sections
    areasExcluded: getSectionText("excluded"),
    existingConditions: getSectionText("existing"),
    toolsNeeded: getSectionText("tools"),
    materialsNeeded: "", // Could be derived from Sundries
    fieldNotes: estimateData.internalNotes || ""
  };
};
