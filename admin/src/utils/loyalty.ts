import { doc, setDoc, addDoc, collection, increment, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { combinePhone, parsePhone } from "./phone";
import type { LoyaltySettings } from "../types";

function normalizePhone(phone: string): string {
  const { countryCode, number } = parsePhone(phone);
  return combinePhone(countryCode, number);
}

function getSettings(): Promise<LoyaltySettings | null> {
  return import("../lib/firestore").then((m) =>
    m.getDocument<LoyaltySettings>("settings/loyalty")
  );
}

export async function earnLoyaltyPoints(opts: {
  phone: string;
  name: string;
  grandTotal: number;
  referenceType: "invoice" | "order";
  referenceId: string;
  referenceNumber: string;
}) {
  const settings = await getSettings();
  if (!settings?.enabled) return;
  const pointsEarned = Math.floor(opts.grandTotal / (settings.pointsPerRupee || 100));
  if (pointsEarned <= 0) return;
  const phone = normalizePhone(opts.phone);

  await setDoc(doc(db, "loyaltyAccounts", phone), {
    phone,
    name: opts.name,
    pointsBalance: increment(pointsEarned),
    totalEarned: increment(pointsEarned),
    lastActivityAt: serverTimestamp(),
  }, { merge: true });

  await addDoc(collection(db, "loyaltyTransactions"), {
    phone,
    type: "earn",
    points: pointsEarned,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    referenceNumber: opts.referenceNumber,
    description: `Earned ${pointsEarned} point${pointsEarned > 1 ? "s" : ""} from ${opts.referenceNumber}`,
    createdAt: serverTimestamp(),
  });

  return pointsEarned;
}

export async function deductLoyaltyPoints(opts: {
  phone: string;
  points: number;
  referenceType: "invoice" | "order";
  referenceId: string;
  referenceNumber: string;
  description: string;
}) {
  if (opts.points <= 0) return;
  const phone = normalizePhone(opts.phone);
  await setDoc(doc(db, "loyaltyAccounts", phone), {
    phone,
    pointsBalance: increment(-opts.points),
    totalRedeemed: increment(opts.points),
    lastActivityAt: serverTimestamp(),
  }, { merge: true });

  await addDoc(collection(db, "loyaltyTransactions"), {
    phone,
    type: "redeem",
    points: -opts.points,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    referenceNumber: opts.referenceNumber,
    description: opts.description,
    createdAt: serverTimestamp(),
  });
}

export async function revertLoyaltyPoints(opts: {
  phone: string;
  points: number;
  referenceType: "invoice" | "order";
  referenceId: string;
  referenceNumber: string;
}) {
  if (opts.points <= 0) return;
  const phone = normalizePhone(opts.phone);
  await setDoc(doc(db, "loyaltyAccounts", phone), {
    phone,
    pointsBalance: increment(-opts.points),
    totalEarned: increment(-opts.points),
    lastActivityAt: serverTimestamp(),
  }, { merge: true });

  await addDoc(collection(db, "loyaltyTransactions"), {
    phone,
    type: "adjust",
    points: -opts.points,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    referenceNumber: opts.referenceNumber,
    description: `Reverted ${opts.points} point${opts.points > 1 ? "s" : ""} from ${opts.referenceNumber}`,
    createdAt: serverTimestamp(),
  });
}

export async function getLoyaltyAccount(phone: string) {
  const { getDocument } = await import("../lib/firestore");
  return getDocument<{ phone: string; name: string; pointsBalance: number; totalEarned: number; totalRedeemed: number }>(`loyaltyAccounts/${normalizePhone(phone)}`);
}

export async function getPointsToRedeem(phone: string, grandTotal: number): Promise<{ maxPoints: number; maxDiscount: number } | null> {
  const account = await getLoyaltyAccount(phone);
  if (!account) return null;
  const settings = await getSettings();
  if (!settings?.enabled) return null;
  const maxByBalance = account.pointsBalance;
  const maxByPercent = Math.floor(grandTotal * (settings.maxRedemptionPercent / 100) / settings.redemptionRate);
  const maxPoints = Math.min(maxByBalance, maxByPercent);
  const maxDiscount = maxPoints * settings.redemptionRate;
  return { maxPoints, maxDiscount };
}