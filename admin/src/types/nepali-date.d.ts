declare module "nepali-date" {
  class NepaliDate {
    constructor(date: Date);
    constructor(year: number, month: number, date: number);
    getYear(): number;
    getMonth(): number;
    getDate(): number;
    getDay(): number;
    getHours(): number;
    getMinutes(): number;
    getSeconds(): number;
    getMilliseconds(): number;
    getTime(): number;
    setYear(year: number): void;
    setMonth(month: number): void;
    setDate(date: number): void;
    set(year: number, month: number, date: number): void;
    setEnglishDate(date: Date): void;
    getEnglishDate(): Date;
    format(formatString: string): string;
    toString(): string;
    static minimum(): NepaliDate;
    static maximum(): NepaliDate;
  }

  export default NepaliDate;
}
