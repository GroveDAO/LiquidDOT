import { DEPLOYED_ADDRESSES } from "./contracts";

export const DEFAULT_DEPLOYMENT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? 420420417
);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function hasActiveDeployment(chainId?: number): boolean {
  if (chainId === undefined) return false;
  const deployment = DEPLOYED_ADDRESSES[chainId];
  if (!deployment) return false;

  return Boolean(deployment.vault && deployment.vault !== ZERO_ADDRESS);
}

export function resolveDeploymentChainId(chainId?: number): number {
  if (hasActiveDeployment(chainId)) {
    return chainId;
  }

  if (hasActiveDeployment(DEFAULT_DEPLOYMENT_CHAIN_ID)) {
    return DEFAULT_DEPLOYMENT_CHAIN_ID;
  }

  const firstActiveChain = Object.keys(DEPLOYED_ADDRESSES)
    .map(Number)
    .find((candidate) => hasActiveDeployment(candidate));
  if (firstActiveChain !== undefined) {
    return firstActiveChain;
  }

  return DEFAULT_DEPLOYMENT_CHAIN_ID;
}

export function getDeploymentAddresses(chainId?: number) {
  return DEPLOYED_ADDRESSES[resolveDeploymentChainId(chainId)];
}

export function isSupportedWalletChain(chainId?: number): boolean {
  return hasActiveDeployment(chainId);
}
