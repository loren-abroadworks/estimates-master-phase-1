
import { LineItem, Material, ProductionRate, GlobalSettings, UnitType, EstimateRow, MaterialContainer } from "../types";

/**
 * Calculates the quantity based on input dimensions.
 */
export const calculateQuantity = (
  unit: UnitType,
  length: number, 
  width?: number,
  height?: number,
  count?: number 
): number => {
  if (unit === UnitType.ITEM) {
    return count !== undefined ? count : length; 
  }
  
  if (unit === UnitType.SQFT) {
    if (width && height) return length * height; 
    if (width) return length * width; 
    return length; 
  }
  
  if (unit === UnitType.LNFT) {
    return length;
  }
  
  return 0;
};

/**
 * F.M.4 Labor Costing Model
 */
export const calculateLabor = (
  quantity: number,
  rate: ProductionRate,
  coats: number,
  diffHeight: number, 
  diffAccess: number, 
  globalLaborRate: number,
  marginPercent: number = 0,
  useLaborMargin: boolean = false,
  coatQuantities?: number[]
) => {
  const safeRate1 = rate.baseRate > 0 ? rate.baseRate : 1;
  const safeRate2 = rate.rate2ndCoat && rate.rate2ndCoat > 0 ? rate.rate2ndCoat : safeRate1;
  const safeRate3 = rate.rate3rdCoat && rate.rate3rdCoat > 0 ? rate.rate3rdCoat : safeRate2;
  const safeRate4 = rate.rate4thCoat && rate.rate4thCoat > 0 ? rate.rate4thCoat : safeRate3;

  let baseHours = 0; 
  let hoursWithCoats = 0; 

  // Helper to get quantity for a specific coat index (1-based)
  const getQty = (coatIndex: number) => {
      if (coatQuantities && coatQuantities.length >= coatIndex) {
          return coatQuantities[coatIndex - 1];
      }
      return quantity;
  };

  if (coats >= 1) {
    const h1 = getQty(1) / safeRate1;
    baseHours = h1;
    hoursWithCoats += h1;
  }
  
  if (coats >= 2) {
    const h2 = getQty(2) / safeRate2;
    hoursWithCoats += h2;
  }

  if (coats >= 3) {
    const h3 = getQty(3) / safeRate3;
    hoursWithCoats += h3;
  }

  if (coats >= 4) {
    const extraCoats = coats - 3;
    // For 4th+ coats, we assume the 4th coat quantity applies to all subsequent coats if specified
    // or just use the base quantity
    const qty4Plus = getQty(4); 
    const h4Plus = (qty4Plus / safeRate4) * extraCoats;
    hoursWithCoats += h4Plus;
  }

  if (coats === 0) hoursWithCoats = 0;
  
  const totalLaborHours = hoursWithCoats * diffHeight * diffAccess;
  
  const baseHourlyRate = rate.laborRate > 0 ? rate.laborRate : globalLaborRate;
  
  const finalHourlyRate = useLaborMargin 
    ? baseHourlyRate * (1 + marginPercent)
    : baseHourlyRate;

  const laborCost = totalLaborHours * finalHourlyRate;
  
  return { baseHours, totalLaborHours, laborCost };
};

/**
 * Exterior Specific Logic
 */
export const calculateExteriorProductionHours = (
  row: EstimateRow,
  rate: ProductionRate,
  settings: GlobalSettings
): number => {
  let coatHours = 0;

  // 1. Calculate Coat Hours
  // Check for legacy explicit columns (Coat 1, 2, 3 inputs)
  const qty1 = Number(row.customValues['col-coat1']) || 0;
  const qty2 = Number(row.customValues['col-coat2']) || 0;
  const qty3 = Number(row.customValues['col-coat3']) || 0;
  const hasLegacyCoats = qty1 > 0 || qty2 > 0 || qty3 > 0;

  if (hasLegacyCoats) {
      // Legacy Logic
      if (qty1 > 0) {
        const r1 = rate.baseRate > 0 ? rate.baseRate : 150;
        coatHours += qty1 / r1;
      }
      if (qty2 > 0) {
        const r2 = rate.rate2ndCoat && rate.rate2ndCoat > 0 ? rate.rate2ndCoat : (rate.baseRate || 150);
        coatHours += qty2 / r2;
      }
      if (qty3 > 0) {
        const r3 = rate.rate3rdCoat && rate.rate3rdCoat > 0 ? rate.rate3rdCoat : (rate.rate2ndCoat || rate.baseRate || 150);
        coatHours += qty3 / r3;
      }
  } else {
      // Standard/Unified Logic (uses row.amount + row.coats OR row.coatQuantities)
      const { baseHours } = calculateLabor(
          row.amount, 
          rate, 
          row.coats, 
          1, 1, 
          settings.defaultLaborRate, 
          0, 
          false, 
          row.coatQuantities
      );
      coatHours = baseHours;
  }

  let totalHours = coatHours;

  // Wash Checkbox
  if (row.customValues['col-wash'] === true) {
      const washRate = 300; 
      totalHours += (row.amount / washRate);
  }

  // Prime Checkbox
  if (row.customValues['col-prime'] === true) {
      const primeRate = rate.baseRate > 0 ? rate.baseRate : 150;
      totalHours += (row.amount / primeRate);
  }
  
  return totalHours;
};

/**
 * Helper: Optimize Containers (Recursive Mix Strategy)
 * Finds the cheapest combination of containers to fulfill the gallonsNeeded.
 */
export const optimizeContainers = (gallonsNeeded: number, containers: MaterialContainer[]) => {
  if (!containers || containers.length === 0) return { containersUsed: [], cost: 0 };
  if (gallonsNeeded <= 0.001) return { containersUsed: [], cost: 0 };

  // Recursive solver function
  // returns { items: [{ label, count, price, cost }], cost: number }
  const solve = (remGallons: number, availableContainers: MaterialContainer[]): { items: any[], cost: number } => {
      // Base case: Demand met
      if (remGallons <= 0.001) return { items: [], cost: 0 };
      
      // Base case: No containers left to fill demand
      if (availableContainers.length === 0) return { items: [], cost: Infinity };

      const current = availableContainers[0];
      const rest = availableContainers.slice(1);

      // Strategy A: Buy Ceiling of Current
      // Use this container size exclusively to cover the remainder
      const countCeil = Math.ceil(remGallons / current.gallons);
      const costCeil = countCeil * current.price;
      const resCeil = { 
          items: [{ label: current.sizeLabel, count: countCeil, price: current.price, cost: costCeil }], 
          cost: costCeil 
      };

      // Strategy B: Buy Floor of Current + Solve Rest
      // Buy as many full units of this size as possible, fill remainder with smaller sizes
      const countFloor = Math.floor(remGallons / current.gallons);
      let resFloor = { items: [], cost: Infinity };
      
      if (countFloor > 0) {
          const remainder = remGallons - (countFloor * current.gallons);
          const subResult = solve(remainder, rest);
          
          if (subResult.cost !== Infinity) {
              resFloor = {
                  items: [
                      { label: current.sizeLabel, count: countFloor, price: current.price, cost: countFloor * current.price }, 
                      ...subResult.items
                  ],
                  cost: (countFloor * current.price) + subResult.cost
              };
          }
      }

      // Strategy C: Skip Current
      // Don't use this size at all, try to fill entirely with smaller sizes
      // (Useful if smaller sizes are strangely cheaper or fit better)
      const resSkip = solve(remGallons, rest);

      // Find the winner
      let winner = resSkip;
      if (resCeil.cost < winner.cost) winner = resCeil;
      if (resFloor.cost < winner.cost) winner = resFloor;

      return winner;
  };

  // 1. Sort descending by size (largest first)
  const sortedContainers = [...containers].sort((a, b) => b.gallons - a.gallons);
  
  // 2. Run solver
  const result = solve(gallonsNeeded, sortedContainers);

  // 3. Flatten/Merge results (e.g. if recursion produced two separate "1 Gallon" entries, merge them)
  const mergedItems: { label: string; count: number; cost: number; price: number }[] = [];
  if (result.items) {
      result.items.forEach(i => {
          const existing = mergedItems.find(m => m.label === i.label);
          if (existing) {
              existing.count += i.count;
              existing.cost += i.cost;
          } else {
              mergedItems.push(i);
          }
      });
  }

  return {
    containersUsed: mergedItems,
    cost: result.cost === Infinity ? 0 : result.cost
  };
};

/**
 * F.M.6 Material Costing Engine
 */
export const calculateMaterial = (
  quantity: number,
  material: Material | null,
  coats: number,
  wastePercent: number,
  coatQuantities?: number[]
) => {
  if (!material) {
    return {
      requiredGallons: 0,
      requiredWithWaste: 0,
      containersUsed: [],
      materialCost: 0
    };
  }

  const isPaintProduct = ['Paint', 'Primer', 'Stain'].includes(material.category);

  // Helper to get quantity for a specific coat index (1-based)
  const getQty = (coatIndex: number) => {
      if (coatQuantities && coatQuantities.length >= coatIndex) {
          return coatQuantities[coatIndex - 1];
      }
      return quantity;
  };

  if (!isPaintProduct) {
    const unitPrice = material.containers[0]?.price || 0;
    const itemCost = quantity * unitPrice * (1 + wastePercent); 
    return {
      requiredGallons: 0,
      requiredWithWaste: quantity, 
      containersUsed: [{ label: material.containers[0]?.sizeLabel || 'Unit', count: quantity, cost: itemCost, price: unitPrice }],
      materialCost: itemCost
    };
  }

  // 1. Raw Need for paint products
  let rawGallons = 0;
  for (let i = 1; i <= coats; i++) {
      let coverage = material.coveragePerGallon > 0 ? material.coveragePerGallon : 350;
      if (i === 2 && material.coverageCoat2 && material.coverageCoat2 > 0) coverage = material.coverageCoat2;
      else if (i === 3 && material.coverageCoat3 && material.coverageCoat3 > 0) coverage = material.coverageCoat3;
      else if (i >= 4 && material.coverageCoat4 && material.coverageCoat4 > 0) coverage = material.coverageCoat4;
      
      rawGallons += getQty(i) / coverage;
  }
  
  // 2. Add Waste
  const gallonsWithWaste = rawGallons * (1 + wastePercent);
  
  // 3. Optimize Containers
  const { containersUsed, cost } = optimizeContainers(gallonsWithWaste, material.containers);

  return {
    requiredGallons: rawGallons,
    requiredWithWaste: gallonsWithWaste,
    containersUsed,
    materialCost: cost
  };
};

/**
 * Main wrapper to recalculate a full line item
 */
export const calculateLineItem = (
  item: LineItem,
  globalSettings: GlobalSettings,
  useLaborMargin: boolean = false
): LineItem => {
  const quantity = calculateQuantity(
    item.measurement.unit,
    item.measurement.length,
    item.measurement.width,
    item.measurement.height,
    item.measurement.count
  );

  const labor = calculateLabor(
    quantity,
    item.productionRate,
    item.coats,
    item.difficultyHeight, 
    item.difficultyAccess, 
    globalSettings.defaultLaborRate,
    globalSettings.laborMargin,
    useLaborMargin,
    item.coatQuantities
  );

  const effectiveWaste = globalSettings.wasteEnabled ? globalSettings.wastePercentage : 0;

  const material = calculateMaterial(
    quantity,
    item.material,
    item.coats,
    effectiveWaste,
    item.coatQuantities
  );

  return {
    ...item,
    calculatedQuantity: quantity,
    baseLaborHours: labor.baseHours,
    totalLaborHours: labor.totalLaborHours,
    laborCost: labor.laborCost,
    materialRequiredGallons: material.requiredGallons,
    materialRequiredWithWaste: material.requiredWithWaste,
    containersUsed: material.containersUsed,
    materialCost: material.materialCost,
    totalCost: labor.laborCost + material.materialCost
  };
};
