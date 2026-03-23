/**
 * Fetch BYN/USD exchange rate from the National Bank of Belarus (NBRB) API.
 * Returns the official rate: how many BYN per 1 USD.
 * To convert BYN → USD: amount_usd = amount_byn / rate
 */
export async function fetchNbrbRate(date: string): Promise<{ rate: number; date: string }> {
  const res = await fetch(`https://api.nbrb.by/exrates/rates/431?ondate=${date}`);
  if (!res.ok) {
    throw new Error(`NBRB API error: ${res.status} for date ${date}`);
  }
  const data = await res.json();
  return {
    rate: data.Cur_OfficialRate / data.Cur_Scale,
    date: date,
  };
}

/** Format a local Date as YYYY-MM-DD without timezone shift */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get the rate date for a period — last day of month, or today if the month hasn't ended yet */
export function getRateDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0); // last day of the month
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If the month hasn't ended yet, use today (or yesterday for safety)
  if (lastDay > today) {
    return localDateStr(today);
  }

  return localDateStr(lastDay);
}
