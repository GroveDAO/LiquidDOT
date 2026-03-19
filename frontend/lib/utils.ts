/**
 * Utility functions for formatting and calculations
 */

/**
 * Format a DOT amount (10 decimals) to a human-readable string with 4 decimal places
 */
export function formatDOT(planck: bigint): string {
  const dot = Number(planck) / 1e10;
  return dot.toFixed(4);
}

/**
 * Format a stDOT amount (18 decimals) to a human-readable string with 4 decimal places
 */
export function formatStDOT(wei: bigint): string {
  const stDot = Number(wei) / 1e18;
  return stDot.toFixed(4);
}

/**
 * Format a basis-points APY value to a percentage string
 * @param bps Basis points (100 bps = 1%)
 */
export function formatAPY(bps: bigint): string {
  const pct = Number(bps) / 100;
  return pct.toFixed(2) + "%";
}

/**
 * Parse a human-readable DOT amount string to planck units (bigint)
 */
export function parseDOT(dot: string): bigint {
  const parsed = parseFloat(dot);
  if (isNaN(parsed) || parsed < 0) return 0n;
  return BigInt(Math.floor(parsed * 1e10));
}

/**
 * Parse a human-readable stDOT amount string to wei (bigint, 18 dec)
 */
export function parseStDOT(stDot: string): bigint {
  const parsed = parseFloat(stDot);
  if (isNaN(parsed) || parsed < 0) return 0n;
  return BigInt(Math.floor(parsed * 1e18));
}

/**
 * Given stDOT balance and exchange rate, compute equivalent DOT value
 * @param stDOTWei stDOT balance in wei (18 dec)
 * @param exchangeRate rate in 1e18 precision (planck per stDOT-wei)
 */
export function stDOTtoDOT(stDOTWei: bigint, exchangeRate: bigint): bigint {
  return (stDOTWei * exchangeRate) / BigInt(1e18);
}

/**
 * Shorten an address for display: 0x1234...abcd
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check whether an address is zero / not yet deployed
 */
export function isZeroAddress(address: string): boolean {
  return address === "0x0000000000000000000000000000000000000000";
}
