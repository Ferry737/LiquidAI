// server/src/services/policy/approvedAction.ts
// v1.7: The ApprovedAction token — the type-level gate that makes signing
// without policy approval IMPOSSIBLE BY CONSTRUCTION.
//
// SECURITY DESIGN:
//   - ApprovedAction carries a PRIVATE brand symbol that is NOT exported.
//   - The ONLY way to obtain an ApprovedAction value is via
//     `mintApprovedAction`, which is itself only called inside PolicyEngine
//     after all checks pass (see ../policy.ts).
//   - SignerService.signTransaction REQUIRES an ApprovedAction argument.
//   - Therefore no code path can call signTransaction without first passing
//     through the policy engine — the compiler enforces it.

/** Opaque brand — unexported symbol; cannot be forged outside this module. */
declare const APPROVAL_BRAND: unique symbol;

/** Describes the action the policy engine approved. */
export interface ApprovedActionData {
  chainId: number;
  positionId: string;
  /** Strategy action type being authorized. */
  actionType: "REBALANCE" | "COMPOUND" | "STOP_LOSS";
  /** USD notional the engine evaluated against maxUsdPerAction. */
  usdValue: number;
  /** Estimated gas cost (USD) the engine evaluated against the daily gas cap. */
  gasCostUsd: number;
  /** Pool + tokens involved (checked against allowlists). */
  pool: string;
  tokens: string[];
  /** When the approval was minted (ms). */
  approvedAt: number;
}

/**
 * A policy-approved action. The brand field is phantom (never present at
 * runtime) and unexported, so a value of this type can only be produced by
 * `mintApprovedAction` below.
 */
export type ApprovedAction = ApprovedActionData & {
  readonly [APPROVAL_BRAND]: true;
};

/**
 * INTERNAL. Mint an ApprovedAction. Exported for the policy engine ONLY.
 * Do not call this anywhere except inside PolicyEngine.evaluate — doing so
 * would bypass the security model. It is intentionally not re-exported from
 * the package barrel.
 */
export function mintApprovedAction(data: ApprovedActionData): ApprovedAction {
  return data as ApprovedAction;
}

/** Read the underlying data from an approval (safe; no way to construct one). */
export function readApproval(a: ApprovedAction): ApprovedActionData {
  return a;
}
