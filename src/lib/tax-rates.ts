/**
 * Tax rate mapping by bank country.
 * When bank_country is set on a profile, tax_rate should auto-update to match.
 */

export const BANK_COUNTRY_TAX_RATES: Record<string, number> = {
  BY: 14,        // Belarus → AMC → 14%
  US: 11.5,      // USA → Zepter → 11.5%
  AE: 0,         // UAE → 0%
  GE: 1,         // Georgia → 1%
};

export const BANK_COUNTRY_LABELS: Record<string, string> = {
  BY: "Belarus",
  US: "United States",
  AE: "UAE",
  GE: "Georgia",
};

export const BANK_COUNTRIES = Object.keys(BANK_COUNTRY_TAX_RATES);

/**
 * Get the tax rate for a given bank country code.
 * Returns undefined if the country is not in the mapping.
 */
export function getTaxRateForCountry(countryCode: string): number | undefined {
  return BANK_COUNTRY_TAX_RATES[countryCode.toUpperCase()];
}
