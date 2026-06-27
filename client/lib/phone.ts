export const DEFAULT_CODE = "+977";

const COUNTRY_CODES = [
  { code: "+977", label: "Nepal (+977)" },
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+86", label: "China (+86)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+94", label: "Sri Lanka (+94)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+66", label: "Thailand (+66)" },
];

export { COUNTRY_CODES };

export function combinePhone(countryCode: string, number: string): string {
  const digits = number.replace(/\D/g, "").slice(0, 10);
  return `${countryCode}${digits}`;
}

export function parsePhone(full: string): { countryCode: string; number: string } {
  if (!full) return { countryCode: DEFAULT_CODE, number: "" };
  const match = full.match(/^(\+\d+)(\d{10})$/);
  if (match) return { countryCode: match[1], number: match[2] };
  const digits = full.replace(/\D/g, "");
  if (digits.length > 10) return { countryCode: DEFAULT_CODE, number: digits.slice(-10) };
  return { countryCode: DEFAULT_CODE, number: digits };
}
