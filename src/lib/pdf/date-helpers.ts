export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function formatDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function shortDate(date: Date): string {
  const m = MONTHS[date.getMonth()].slice(0, 3);
  return `${m} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
}
