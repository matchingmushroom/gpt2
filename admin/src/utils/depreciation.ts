import { Timestamp } from "firebase/firestore";
import { getCollection, setDocument } from "../lib/firestore";
import { postJournalEntry } from "./accountingEngine";
import type { FixedAsset, DepreciationMethod } from "../types";

interface DepreciationResult {
  assetId: string;
  assetName: string;
  periodDepreciation: number;
  accumulatedDepreciation: number;
  bookValueAfter: number;
}

function monthsBetween(start: Date, end: Date): number {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

export function calculateDepreciation(
  asset: FixedAsset,
  asOfDate: Date,
): number {
  const purchaseDate = new Date(asset.purchaseDate.seconds * 1000);
  const monthsOwned = monthsBetween(purchaseDate, asOfDate);
  if (monthsOwned <= 0) return 0;

  const yearsOwned = monthsOwned / 12;

  if (asset.depreciationMethod === "straight_line") {
    const annualDep = (asset.cost - asset.salvageValue) / asset.usefulLifeYears;
    const totalFromPurchase = Math.round(annualDep * yearsOwned * 100) / 100;
    return Math.round((totalFromPurchase - asset.accumulatedDepreciation) * 100) / 100;
  }

  if (asset.depreciationMethod === "wdv" && asset.wdvRate) {
    let bookValue = asset.cost;
    const fullYears = Math.floor(yearsOwned);
    for (let y = 0; y < fullYears; y++) {
      bookValue -= bookValue * asset.wdvRate;
    }
    const partialYearMonths = monthsOwned - fullYears * 12;
    if (partialYearMonths > 0) {
      bookValue -= bookValue * asset.wdvRate * (partialYearMonths / 12);
    }
    return Math.round((asset.cost - bookValue - asset.accumulatedDepreciation) * 100) / 100;
  }

  return 0;
}

export async function runDepreciationForPeriod(
  periodStart: Date,
  periodEnd: Date,
  createdBy: string,
): Promise<DepreciationResult[]> {
  const assets = await getCollection<FixedAsset>("fixedAssets");
  const results: DepreciationResult[] = [];

  for (const asset of assets) {
    if (!asset.isActive) continue;

    const purchaseDate = new Date(asset.purchaseDate.seconds * 1000);
    if (purchaseDate > periodEnd) continue;

    const periodDepreciation = calculateDepreciation(asset, periodEnd);
    if (periodDepreciation <= 0) continue;

    const newAccumulated = Math.round((asset.accumulatedDepreciation + periodDepreciation) * 100) / 100;
    const newBookValue = Math.max(0, Math.round((asset.cost - newAccumulated) * 100) / 100);

    await postJournalEntry({
      entryDate: periodEnd,
      description: `Depreciation — ${asset.name} (${formatPeriod(periodStart, periodEnd)})`,
      lines: [
        { accountCode: asset.depExpenseAccountCode, accountName: "", debit: periodDepreciation, credit: 0 },
        { accountCode: asset.accDepAccountCode, accountName: "", debit: 0, credit: periodDepreciation },
      ],
      referenceType: "depreciation",
      referenceId: `${asset.id}-${periodEnd.getTime()}`,
      createdBy,
    });

    await setDocument(`fixedAssets/${asset.id}`, {
      accumulatedDepreciation: newAccumulated,
      currentBookValue: newBookValue,
    });

    results.push({
      assetId: asset.id,
      assetName: asset.name,
      periodDepreciation,
      accumulatedDepreciation: newAccumulated,
      bookValueAfter: newBookValue,
    });
  }

  return results;
}

function formatPeriod(start: Date, end: Date): string {
  const s = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  const e = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
  return s === e ? s : `${s} to ${e}`;
}
