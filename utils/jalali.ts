/**
 * Gregorian → Jalali (Shamsi) conversion — pure frontend helper.
 * Used by the dashboard so every generated date/label is guaranteed
 * Shamsi regardless of the OS/browser Intl locale settings.
 * (Database and backend keep storing their existing date strings.)
 */

const div = (a: number, b: number): number => Math.trunc(a / b);

const G_DAYS_IN_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/**
 * Convert a Gregorian date to Jalali. Classic well-tested algorithm,
 * accurate for the years this app deals with.
 */
export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  const gy0 = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  const jyBase = gy0 <= 1600 ? 0 : 979;
  const gy = gy0 - (gy0 <= 1600 ? 621 : 1600);

  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy
    + div(gy2 + 3, 4)
    - div(gy2 + 99, 100)
    + div(gy2 + 399, 400)
    - 80
    + gd
    + G_DAYS_IN_MONTH[gm - 1];

  let jy = jyBase + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { jy, jm, jd };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "1405/06/10" — same format the database stores. */
export function jalaliString(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

/** "25 مرداد" — compact, unambiguous axis label. */
export function jalaliDayLabel(date: Date): string {
  const { jm, jd } = toJalali(date);
  return `${JALALI_MONTHS[jm - 1]} ${jd}`;
}

/** "مرداد 05" — monthly axis label (month name + 2-digit year). */
export function jalaliMonthLabel(date: Date): string {
  const { jy, jm } = toJalali(date);
  return `${JALALI_MONTHS[jm - 1]} ${String(jy).slice(2)}`;
}
