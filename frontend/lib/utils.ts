/**
 * Utility functions for formatting and calculations
 */
import { formatUnits, parseUnits } from "viem";

function fixedFromUnits(value: bigint, decimals: number, fractionDigits = 4): string {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  if (fractionDigits === 0) return whole;
  const trimmedFraction = `${fraction}${"0".repeat(fractionDigits)}`.slice(0, fractionDigits);
  return `${whole}.${trimmedFraction}`;
}

export function formatTokenAmount(value: bigint, decimals: number, fractionDigits = 2): string {
  return fixedFromUnits(value, decimals, fractionDigits);
}

/**
 * Format a DOT amount (10 decimals) to a human-readable string with 4 decimal places
 */
export function formatDOT(planck: bigint): string {
  return fixedFromUnits(planck, 10);
}

/**
 * Format a stDOT amount (18 decimals) to a human-readable string with 4 decimal places
 */
export function formatStDOT(wei: bigint): string {
  return fixedFromUnits(wei, 18);
}

/**
 * Format an exchange rate encoded as planck-per-stDOT with 10 asset decimals.
 */
export function formatExchangeRate(rate: bigint): string {
  return fixedFromUnits(rate, 10, 6);
}

/**
 * Format a basis-points APY value to a percentage string
 * @param bps Basis points (100 bps = 1%)
 */
export function formatAPY(bps: bigint): string {
  return fixedFromUnits(bps, 2, 2) + "%";
}

/**
 * Parse a human-readable DOT amount string to planck units (bigint)
 */
export function parseDOT(dot: string): bigint {
  if (!dot.trim()) return 0n;
  try {
    return parseUnits(dot, 10);
  } catch {
    return 0n;
  }
}

/**
 * Parse a human-readable stDOT amount string to wei (bigint, 18 dec)
 */
export function parseStDOT(stDot: string): bigint {
  if (!stDot.trim()) return 0n;
  try {
    return parseUnits(stDot, 18);
  } catch {
    return 0n;
  }
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

/**
 * Resolve the native gas token symbol for the connected Polkadot Hub network.
 */
export function getNativeTokenSymbol(chainId?: number): string {
  if (chainId === 420420417) return "PAS";
  return "DOT";
}
