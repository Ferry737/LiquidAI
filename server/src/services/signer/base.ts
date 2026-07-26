// server/src/services/signer/base.ts
// v1.7: Shared signer guard logic. The deepest-layer mainnet hard-block lives
// here so BOTH providers inherit it and it cannot be bypassed.

import type { Address, Hex, TransactionSerializable } from "viem";
import { isMainnetChainId } from "../../../../shared/chains";
import type { ApprovedAction } from "../policy";
import { readApproval } from "../policy";
import {
  SignerRefusedError,
  type SignerContext,
  type SignerService,
} from "./types";

export interface BaseSignerOptions {
  /** Reads the live feature-flag value. Injectable for tests. */
  mainnetExecutionEnabled: () => boolean;
}

/**
 * AbstractSigner enforces the security invariants common to every provider:
 *   1. The approval's chainId must match the tx/context chainId.
 *   2. If the chain is mainnet, MAINNET_EXECUTION_ENABLED must be true, else
 *      signing is REFUSED (SignerRefusedError). This is the deepest hard-block:
 *      it fires regardless of DB state, per-position opt-in, or API input.
 * Providers implement only the raw signing primitive `rawSign`.
 */
export abstract class AbstractSigner implements SignerService {
  constructor(protected readonly opts: BaseSignerOptions) {}

  abstract getAddress(chainId: number): Promise<Address>;

  protected abstract rawSign(
    tx: TransactionSerializable,
    context: SignerContext
  ): Promise<Hex>;

  async signTransaction(
    tx: TransactionSerializable,
    approval: ApprovedAction,
    context: SignerContext
  ): Promise<Hex> {
    const data = readApproval(approval);

    // (1) Approval, context, and transaction must target the exact same chain.
    const chainId = context.chainId;
    if (
      data.chainId !== chainId ||
      (tx.chainId !== undefined && tx.chainId !== chainId)
    ) {
      throw new SignerRefusedError(
        `approval/transaction chain does not match signing chain ${chainId}`,
        "approval_chain_mismatch"
      );
    }

    // Approvals are short-lived and cannot be replayed indefinitely.
    if (Date.now() - data.approvedAt > 60_000 || data.approvedAt > Date.now() + 5_000) {
      throw new SignerRefusedError("policy approval expired", "approval_expired");
    }

    // (2) Mainnet hard-block — the deepest gate. Even with a valid approval,
    // signing on a mainnet chain is impossible while the flag is off.
    if (isMainnetChainId(chainId) && !this.opts.mainnetExecutionEnabled()) {
      throw new SignerRefusedError(
        `mainnet execution is disabled (MAINNET_EXECUTION_ENABLED=false); refusing to sign for chain ${chainId}`,
        "mainnet_disabled"
      );
    }

    return this.rawSign(tx, context);
  }
}
