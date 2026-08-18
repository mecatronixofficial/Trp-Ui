type StockEntry = {
  date: string | Date;
  quantity?: number | string;
  branch?: string | { _id?: string } | null;
};

type ProductionEntry = {
  date: string | Date;
  branch?: string | { _id?: string } | null;
};

const branchId = (entry: StockEntry) =>
  String(typeof entry.branch === "object" ? entry.branch?._id || "" : entry.branch || "");

/**
 * Returns the stock carried by the most recent stock day before `day`.
 *
 * Closing stock remains as a historical, dated entry in the API. When the
 * next production starts, that latest total becomes opening production stock;
 * older stock days must not be accumulated again.
 */
export function getOpeningProductionStock(
  entries: StockEntry[],
  day: string,
  toDateKey: (date: string | Date) => string,
  forBranch?: string,
  productionEntries: ProductionEntry[] = [],
) {
  const totalsByDay: Record<string, number> = {};

  for (const entry of entries) {
    if (forBranch && branchId(entry) !== forBranch) continue;
    const entryDay = toDateKey(entry.date);
    if (entryDay >= day) continue;
    totalsByDay[entryDay] =
      (totalsByDay[entryDay] || 0) + Math.max(0, Number(entry.quantity || 0));
  }

  const latestDay = Object.keys(totalsByDay).sort().at(-1);
  if (!latestDay) return 0;

  const latestProductionDay = productionEntries
    .filter((entry) => (!forBranch || branchId(entry) === forBranch) && toDateKey(entry.date) < day)
    .map((entry) => toDateKey(entry.date))
    .sort()
    .at(-1);

  // A later production day has already consumed this stock. This prevents an
  // older positive closing entry from being carried again after a zero close.
  return latestProductionDay && latestProductionDay > latestDay ? 0 : totalsByDay[latestDay];
}
