/**
 * Commission calculation utilities for Proffskontakt CRM
 * 
 * Base formula for SunBro/Hyllinge Solkraft:
 * 1. Customer pays price after green tech deduction (e.g., 78,000 SEK)
 * 2. Calculate total order value: price / (1 - green_tech_percent) = e.g., 78000 / 0.515 = 151,456.31
 * 3. Calculate ex-moms: total * 0.8 = 121,165.04
 * 4. Subtract base cost (23,000): 121,165.04 - 23,000 = 98,165.04
 * 5. Subtract battery material cost (6150 EUR * 11 SEK): 98,165.04 - 67,650 = 30,515
 * 6. Subtract LF Finans fee (3% of customer payment incl moms): 30,515 - (78000 * 0.03) = 28,175
 * 7. This is the invoiceable amount
 * 
 * Closer commission:
 * - Base commission: 8,000 SEK for standard battery (min 22,000 SEK invoice)
 * - If invoice < 22,000: commission reduced by 50% of the difference
 * 
 * Opener commission:
 * - Fixed 1,000 SEK per closed deal from their booked lead
 */

export interface CommissionParams {
  priceToCustomerInclMoms: number;  // Price customer pays after green tech deduction
  greenTechDeductionPercent: number; // e.g., 48.5
  materialCostEur: number;           // e.g., 6150
  eurToSekRate: number;              // e.g., 11
  baseCost: number;                  // e.g., 23000 (SunBro/Hyllinge base cost)
  lfFinansPercent: number;           // e.g., 3
  discountAmount?: number;           // Any discount given
  numPropertyOwners?: number;        // Number of property owners (affects green tech eligibility)
  fullGreenDeduction?: boolean;      // Whether full green deduction applies
}

export interface CommissionResult {
  totalOrderValue: number;           // Full order value before green tech
  exMomsValue: number;               // Value excluding VAT
  afterBaseCost: number;             // After subtracting base cost
  materialCostSek: number;           // Material cost in SEK
  afterMaterialCost: number;         // After subtracting material
  lfFinansFee: number;               // LF Finans fee
  invoiceableAmount: number;         // Final invoiceable amount
  closerCommission: number;          // Closer's commission
  openerCommission: number;          // Opener's commission (fixed 1000)
}

export function calculateCommission(params: CommissionParams): CommissionResult {
  const {
    priceToCustomerInclMoms,
    greenTechDeductionPercent,
    materialCostEur,
    eurToSekRate,
    baseCost,
    lfFinansPercent,
    discountAmount = 0,
  } = params;

  // Step 1: Calculate total order value (reverse the green tech deduction)
  // Green tech gives 48.5% off, so customer pays 51.5% (1 - 0.485 = 0.515)
  const deductionMultiplier = 1 - (greenTechDeductionPercent / 100);
  const totalOrderValue = priceToCustomerInclMoms / deductionMultiplier;

  // Step 2: Calculate ex-moms (80% of total, since VAT is 25%)
  const exMomsValue = totalOrderValue * 0.8;

  // Step 3: Subtract base cost (organization's fixed costs)
  const afterBaseCost = exMomsValue - baseCost;

  // Step 4: Calculate and subtract material cost in SEK
  const materialCostSek = materialCostEur * eurToSekRate;
  const afterMaterialCost = afterBaseCost - materialCostSek;

  // Step 5: Calculate LF Finans fee (percentage of what customer actually pays)
  const lfFinansFee = priceToCustomerInclMoms * (lfFinansPercent / 100);
  const invoiceableAmount = afterMaterialCost - lfFinansFee;

  // Step 6: Calculate closer commission
  // Base: 8,000 SEK if invoicing at least 22,000 SEK
  // Reduced by 50% of any amount below 22,000 threshold
  const baseCloserCommission = 8000;
  const minimumInvoiceThreshold = 22000;
  
  let closerCommission = baseCloserCommission;
  if (invoiceableAmount < minimumInvoiceThreshold) {
    const shortfall = minimumInvoiceThreshold - invoiceableAmount;
    closerCommission = baseCloserCommission - (shortfall * 0.5);
  }
  
  // Apply any discount reduction (50% of discount comes from commission)
  if (discountAmount > 0) {
    closerCommission -= discountAmount * 0.5;
  }
  
  // Commission can't be negative
  closerCommission = Math.max(0, closerCommission);

  // Step 7: Opener commission is fixed
  const openerCommission = 1000;

  return {
    totalOrderValue: Math.round(totalOrderValue * 100) / 100,
    exMomsValue: Math.round(exMomsValue * 100) / 100,
    afterBaseCost: Math.round(afterBaseCost * 100) / 100,
    materialCostSek: Math.round(materialCostSek * 100) / 100,
    afterMaterialCost: Math.round(afterMaterialCost * 100) / 100,
    lfFinansFee: Math.round(lfFinansFee * 100) / 100,
    invoiceableAmount: Math.round(invoiceableAmount * 100) / 100,
    closerCommission: Math.round(closerCommission * 100) / 100,
    openerCommission,
  };
}

/**
 * Default settings for SunBro and Hyllinge Solkraft
 */
export const DEFAULT_COMMISSION_SETTINGS = {
  baseCost: 23000,
  eurToSekRate: 11,
  lfFinansPercent: 3,
  greenTechDeductionPercent: 48.5,
};

/**
 * Default Emaldo battery product
 */
export const DEFAULT_EMALDO_BATTERY = {
  name: 'Emaldo 15.36 kWh',
  capacityKwh: 15.36,
  basePriceInclMoms: 78000,
  materialCostEur: 6150,
};

/**
 * Example calculation for reference:
 * 
 * Input:
 * - Customer price after green tech: 78,000 SEK
 * - Green tech deduction: 48.5%
 * - Material cost: 6,150 EUR
 * - EUR/SEK rate: 11
 * - Base cost: 23,000 SEK
 * - LF Finans: 3%
 * 
 * Calculation:
 * 1. Total order value: 78,000 / 0.515 = 151,456.31 SEK
 * 2. Ex-moms: 151,456.31 * 0.8 = 121,165.05 SEK
 * 3. After base cost: 121,165.05 - 23,000 = 98,165.05 SEK
 * 4. Material cost SEK: 6,150 * 11 = 67,650 SEK
 * 5. After material: 98,165.05 - 67,650 = 30,515.05 SEK
 * 6. LF Finans fee: 78,000 * 0.03 = 2,340 SEK
 * 7. Invoiceable: 30,515.05 - 2,340 = 28,175.05 SEK
 * 
 * Commission:
 * - Closer: 8,000 SEK (invoiceable > 22,000 threshold)
 * - Opener: 1,000 SEK (fixed)
 */
