import NepaliDate from "nepali-date";

export function toBSDate(adDate: Date): { year: number; month: number; day: number } {
  const nd = new NepaliDate(adDate);
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}

export function toBSString(adDate: Date): string {
  const nd = new NepaliDate(adDate);
  const months = [
    "Baishakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
  ];
  return `${months[nd.getMonth()]} ${nd.getDate()}, ${nd.getYear()}`;
}

export function toBSDateString(adDate: Date = new Date()): string {
  const nd = new NepaliDate(adDate);
  const y = nd.getYear();
  const m = String(nd.getMonth() + 1).padStart(2, "0");
  const d = String(nd.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentBSYear(): number {
  return new NepaliDate(new Date()).getYear();
}

export function getFiscalYearStart(): Date {
  const nd = new NepaliDate(new Date());
  const year = nd.getMonth() >= 3 ? nd.getYear() : nd.getYear() - 1;
  return new NepaliDate(year, 3, 1).getEnglishDate();
}

export function isShrawanFirst(date: Date = new Date()): boolean {
  const nd = new NepaliDate(date);
  return nd.getMonth() === 3 && nd.getDate() === 1;
}
