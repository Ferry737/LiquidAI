// server/src/services/mainnetOptIn.ts
// v1.7: Per-position mainnet opt-in logic. Verifies the EIP-191 acknowledgment
// signature and enforces the three requirements. The verify function is pure
// (viem local ecrecover) and unit-testable with fixed vectors.

import { verifyMessage, type Address } from "viem";
import {
  buildMainnetAckMessage,
  MAINNET_ACK_MAX_AGE_MS,
  MAINNET_MIN_DRY_RUNS,
} from "../../../shared/policy";

export interface AckVerifyInput {
  positionId: string;
  owner: string;
  chainId: number;
  message: string;
  signature: string;
  timestamp: number;
  /** Now (ms) — injectable for deterministic tests. */
  now?: number;
}

export type AckVerifyResult =
  | { ok: true }
  | {
      ok: false;
      code: "STALE" | "MESSAGE_MISMATCH" | "BAD_SIGNATURE";
      reason: string;
    };

/**
 * Verify an EIP-191 mainnet acknowledgment:
 *   - timestamp is fresh (<= MAINNET_ACK_MAX_AGE_MS old, not in the future)
 *   - the message exactly equals the canonical ack string for these params
 *   - the signature recovers to the position owner
 */
export async function verifyMainnetAck(
  input: AckVerifyInput
): Promise<AckVerifyResult> {
  const now = input.now ?? Date.now();

  // 1. Freshness.
  const age = now - input.timestamp;
  if (age > MAINNET_ACK_MAX_AGE_MS || age < -60_000) {
    return {
      ok: false,
      code: "STALE",
      reason: `acknowledgment timestamp is stale (age ${Math.round(age / 1000)}s)`,
    };
  }

  // 2. Canonical message match — the client cannot smuggle a different message.
  const expected = buildMainnetAckMessage({
    positionId: input.positionId,
    owner: input.owner,
    chainId: input.chainId,
    timestamp: input.timestamp,
  });
  if (input.message !== expected) {
    return {
      ok: false,
      code: "MESSAGE_MISMATCH",
      reason: "acknowledgment message does not match the canonical format",
    };
  }

  // 3. Signature recovers to the owner (viem does local ecrecover for EOAs).
  let valid = false;
  try {
    valid = await verifyMessage({
      address: input.owner as Address,
      message: input.message,
      signature: input.signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    return {
      ok: false,
      code: "BAD_SIGNATURE",
      reason: "acknowledgment signature does not match the position owner",
    };
  }

  return { ok: true };
}

export interface ChecklistInput {
  ownerVerified: boolean;
  dryRunCount: number;
  acknowledged: boolean;
  featureEnabled: boolean;
}

/** All three requirements satisfied AND the feature flag on. */
export function checklistSatisfied(input: ChecklistInput): boolean {
  return (
    input.ownerVerified &&
    input.dryRunCount >= MAINNET_MIN_DRY_RUNS &&
    input.acknowledged &&
    input.featureEnabled
  );
}
