const ones = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const tens = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

function convertGroup(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? "-" + ones[n % 10] : "");
  return ones[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + convertGroup(n % 100) : "");
}

export function numberToWords(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);

  let result = "";

  if (dollars === 0) {
    result = "zero";
  } else {
    const billions = Math.floor(dollars / 1_000_000_000);
    const millions = Math.floor((dollars % 1_000_000_000) / 1_000_000);
    const thousands = Math.floor((dollars % 1_000_000) / 1_000);
    const remainder = dollars % 1_000;

    const parts: string[] = [];
    if (billions) parts.push(convertGroup(billions) + " billion");
    if (millions) parts.push(convertGroup(millions) + " million");
    if (thousands) parts.push(convertGroup(thousands) + " thousand");
    if (remainder) parts.push(convertGroup(remainder));

    result = parts.join(" ");
  }

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  result += " US dollar" + (dollars !== 1 ? "s" : "");

  if (cents > 0) {
    result += " and " + convertGroup(cents) + " cent" + (cents !== 1 ? "s" : "");
  }

  return result;
}
