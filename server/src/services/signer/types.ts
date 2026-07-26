// server/src/services/signer/types.ts
// v1.7: SignerService abstraction. Two providers (KMS, Keystore). The signer
// NEVER holds a raw private key in env — the key material lives in AWS KMS
// (never leaves KMS) or in an encrypted keystore file decrypted only in memory.
//
// SECURITY GATE: signTransaction REQUIRES an ApprovedAction (see
// ../policy/approvedAction.ts). Because ApprovedAction can only be minted by
// PolicyEngine, it is impossible to sign a transaction without policy approval.
// Additionally, signing on a mainnet chain is refused unless
// MAINNET_EXECUTION_ENABLED is true — enforced at the deepest layer here.

import type { Address, Hex, TransactionSerializable } from "viem";
import type { ApprovedAction } from "../policy";

export interface SignerContext {
  chainId: number;
  /** For logging/audit correlation. */
  reqId?: string;
}

export interface SignerService {
  /** The address this signer controls (per chain — same EOA across EVM chains). */
  getAddress(chainId: number): Promise<Address>;
  /**
   * Sign a transaction. REQUIRES a policy-approved action token. Refuses (throws)
   * when the target chain is mainnet and MAINNET_EXECUTION_ENABLED is false.
   */
  signTransaction(
    tx: TransactionSerializable,
    approval: ApprovedAction,
    context: SignerContext
  ): Promise<Hex>;
}

/** Thrown when signing is refused at the signer layer (deepest hard-block). */
export class SignerRefusedError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "mainnet_disabled"
      | "approval_chain_mismatch"
      | "approval_expired"
      | "not_configured"
  ) {
    super(message);
    this.name = "SignerRefusedError";
  }
}
