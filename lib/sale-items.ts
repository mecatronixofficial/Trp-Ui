export type SaleApiItem = {
  size: '1/4' | '1/2' | '3/4' | '1';
  quantity: number;
  pricePerBar: number;
};

export function isQuarterBarQuantity(value: string | number) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0.25 && Math.abs(quantity * 4 - Math.round(quantity * 4)) < 1e-9;
}

/**
 * Converts a UI bar total into API-valid sale items. The sales API requires
 * each item's quantity to be at least 1, so a partial bar is represented by
 * its supported size instead of a quantity below 1.
 */
export function toSaleApiItems(
  barQuantity: string | number,
  lineTotal: string | number,
): SaleApiItem[] {
  if (!isQuarterBarQuantity(barQuantity)) return [];

  const quarterUnits = Math.round(Number(barQuantity) * 4);
  const fullBars = Math.floor(quarterUnits / 4);
  const remainingQuarters = quarterUnits % 4;
  const amountPerQuarter = Number(lineTotal) / quarterUnits;
  const result: SaleApiItem[] = [];

  if (fullBars > 0) {
    result.push({ size: '1', quantity: fullBars, pricePerBar: amountPerQuarter * 4 });
  }
  if (remainingQuarters > 0) {
    const size = ({ 1: '1/4', 2: '1/2', 3: '3/4' } as const)[remainingQuarters as 1 | 2 | 3];
    result.push({ size, quantity: 1, pricePerBar: amountPerQuarter * remainingQuarters });
  }

  return result;
}
