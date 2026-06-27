import { doc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import NepaliDate from "nepali-date";

type CounterType = "orders" | "batches" | "purchases" | "invoices" | "otcCoupons" | "journalEntries";

function getBSYear(): number {
  const nd = new NepaliDate(new Date());
  return nd.getYear();
}

function isShrawanFirst(): boolean {
  const nd = new NepaliDate(new Date());
  return nd.getMonth() === 3 && nd.getDate() === 1;
}

function prefix(type: CounterType): string {
  switch (type) {
    case "orders": return "GPT";
    case "batches": return "B";
    case "purchases": return "PR";
    case "invoices": return "INV";
    case "otcCoupons": return "OTC";
    case "journalEntries": return "JE";
  }
}

function formatNumber(num: number, digits: number): string {
  return String(num).padStart(digits, "0");
}

export async function getNextCounter(type: CounterType): Promise<string> {
  const counterPath = `counters/${type}`;
  const counterRef = doc(db, counterPath);
  const now = Timestamp.now();
  const year = getBSYear();

  const newSeq = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);

    if (!snap.exists()) {
      const seq = 1;
      transaction.set(counterRef, { sequence: seq, year, updatedAt: now });
      return seq;
    }

    const data = snap.data() as { sequence: number; year: number };
    const seq = data.year === year ? data.sequence + 1 : 1;
    const reset = data.year !== year || (type === "orders" && isShrawanFirst());
    transaction.update(counterRef, {
      sequence: reset ? 1 : data.sequence + 1,
      year,
      updatedAt: now,
    });
    return reset ? 1 : data.sequence + 1;
  });

  if (type === "orders") return `${year}${formatNumber(newSeq, 5)}`;

  const p = prefix(type);
  if (type === "otcCoupons") {
    const nd = new NepaliDate(new Date());
    const datestamp = `${nd.getYear()}${formatNumber(nd.getMonth() + 1, 2)}${formatNumber(nd.getDate(), 2)}`;
    return `${p}-${datestamp}-${formatNumber(newSeq, 3)}`;
  }

  return `${p}-${year}-${formatNumber(newSeq, 4)}`;
}
