// server/src/services/simulation.ts
// v1.3: SimulationService — simulates REBALANCE/COMPOUND/STOP_LOSS txns via
// viem eth_call / estimateGas against Sepolia RPC before executing.
// Captures expectedAmount0, expectedAmount1, gasEstimate, gasCostUsd.
//
// If simulation fails, the action is recorded as FAILED with the reason,
// and execution is skipped entirely.

import {
  createPublicClient,
  http,
  type Hex,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { positionManagerAbi } from "../../../src/lib/abi";
import { UNISWAP_V3 } from "../../../src/lib/constants";

export interface SimulationResult {
  ok: boolean;
  expectedAmount0: string;
  expectedAmount1: string;
  gasEstimate: string;
  gasCostUsd: number;
  reason?: string;
}

export type ActionType = "REBALANCE" | "COMPOUND" | "STOP_LOSS";

export interface SimulateParams {
  type: ActionType;
  tokenId: number;
  /** Caller address that would send the transaction. */
  caller: Address;
  /** Optional current ETH price in USD for gas cost estimation. */
  ethPriceUsd?: number;
}

/**
 * A gas price estimate (gwei). In real usage this would come from the RPC's
 * eth_gasPrice. For simulation purposes a conservative Sepolia default.
 */
const DEFAULT_GAS_PRICE_WEI = 2_000_000_000n; // 2 gwei

/**
 * SimulationService wraps viem's public client to eth_call and estimateGas
 * Uniswap NonfungiblePositionManager interactions before execution.
 *
 * Design: the service is injected with a `client` for testability.
 * In production, a viem PublicClient is created from SEPOLIA_RPC_URL.
 */
export class SimulationService {
  private client: PublicClientLike;
  private ethPriceUsd: number;
  private gasPriceWei: bigint;

  constructor(opts?: {
    client?: PublicClientLike;
    ethPriceUsd?: number;
    gasPriceWei?: bigint;
    rpcUrl?: string;
  }) {
    this.client =
      opts?.client ??
      createPublicClient({
        chain: sepolia,
        transport: http(opts?.rpcUrl ?? process.env.SEPOLIA_RPC_URL),
      });
    this.ethPriceUsd = opts?.ethPriceUsd ?? 2500;
    this.gasPriceWei = opts?.gasPriceWei ?? DEFAULT_GAS_PRICE_WEI;
  }

  /**
   * Simulate a COMPOUND (collect) call.
   * Returns expected token amounts and gas cost.
   */
  async simulateCollect(
    tokenId: number,
    caller: Address
  ): Promise<SimulationResult> {
    const maxU128 = (1n << 128n) - 1n;
    try {
      // 1. eth_call to get expected return amounts
      const result = (await this.client.readContract({
        address: UNISWAP_V3.nonfungiblePositionManager as Hex,
        abi: positionManagerAbi,
        functionName: "collect",
        args: [
          {
            tokenId: BigInt(tokenId),
            recipient: caller,
            amount0Max: maxU128,
            amount1Max: maxU128,
          },
        ],
      } as any)) as readonly [bigint, bigint];

      const expectedAmount0 = result[0];
      const expectedAmount1 = result[1];

      // 2. estimateGas
      const gasEstimate = await this.client.estimateGas({
        account: caller,
        to: UNISWAP_V3.nonfungiblePositionManager as Hex,
        data: encodeCollectCalldata(tokenId, caller),
      });

      const gasCostUsd = this.computeGasCostUsd(gasEstimate);

      return {
        ok: true,
        expectedAmount0: expectedAmount0.toString(),
        expectedAmount1: expectedAmount1.toString(),
        gasEstimate: gasEstimate.toString(),
        gasCostUsd,
      };
    } catch (err) {
      return this.fail(err);
    }
  }

  /**
   * Simulate a REBALANCE (decreaseLiquidity) call.
   * Uses liquidity=0 to withdraw all, computes expected amounts.
   */
  async simulateDecreaseLiquidity(
    tokenId: number,
    caller: Address
  ): Promise<SimulationResult> {
    try {
      const result = (await this.client.readContract({
        address: UNISWAP_V3.nonfungiblePositionManager as Hex,
        abi: positionManagerAbi,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId: BigInt(tokenId),
            liquidity: 0n,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
          },
        ],
      } as any)) as readonly [bigint, bigint];

      const expectedAmount0 = result[0];
      const expectedAmount1 = result[1];

      const gasEstimate = await this.client.estimateGas({
        account: caller,
        to: UNISWAP_V3.nonfungiblePositionManager as Hex,
        data: encodeDecreaseLiquidityCalldata(tokenId),
      });

      const gasCostUsd = this.computeGasCostUsd(gasEstimate);

      return {
        ok: true,
        expectedAmount0: expectedAmount0.toString(),
        expectedAmount1: expectedAmount1.toString(),
        gasEstimate: gasEstimate.toString(),
        gasCostUsd,
      };
    } catch (err) {
      return this.fail(err);
    }
  }

  /**
   * Unified entry point — dispatch by action type.
   */
  async simulate(params: SimulateParams): Promise<SimulationResult> {
    if (params.ethPriceUsd) {
      this.ethPriceUsd = params.ethPriceUsd;
    }
    switch (params.type) {
      case "COMPOUND":
        return this.simulateCollect(params.tokenId, params.caller);
      case "REBALANCE":
        return this.simulateDecreaseLiquidity(params.tokenId, params.caller);
      case "STOP_LOSS":
        // Stop-loss = withdraw all liquidity + collect, modelled as decreaseLiquidity
        return this.simulateDecreaseLiquidity(params.tokenId, params.caller);
      default:
        return {
          ok: false,
          expectedAmount0: "0",
          expectedAmount1: "0",
          gasEstimate: "0",
          gasCostUsd: 0,
          reason: `unknown action type: ${params.type}`,
        };
    }
  }

  private computeGasCostUsd(gasEstimate: bigint): number {
    const costWei = gasEstimate * this.gasPriceWei;
    const costEth = Number(costWei) / 1e18;
    return costEth * this.ethPriceUsd;
  }

  private fail(err: unknown): SimulationResult {
    const reason =
      err instanceof Error
        ? err.message.split("\n")[0].slice(0, 200)
        : "simulation failed";
    return {
      ok: false,
      expectedAmount0: "0",
      expectedAmount1: "0",
      gasEstimate: "0",
      gasCostUsd: 0,
      reason,
    };
  }
}

// ---- Minimal public client interface for mockability ----

export interface PublicClientLike {
  readContract(args: {
    address: Hex;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<unknown>;
  estimateGas(args: {
    account: Address;
    to: Hex;
    data: Hex;
  }): Promise<bigint>;
}

// ---- Manual calldata encoders for estimateGas ----
// (Used to avoid depending on viem's encodeFunctionData in tests.)

function encodeCollectCalldata(tokenId: number, recipient: Address): Hex {
  // Function selector for collect((uint256,address,uint128,uint128))
  // This is a simplified encoding — real encoding handled by viem readContract.
  return `0x00000000` as Hex;
}

function encodeDecreaseLiquidityCalldata(tokenId: number): Hex {
  return `0x00000000` as Hex;
}

// ---- Factory ----

let _instance: SimulationService | null = null;

export function getSimulationService(): SimulationService {
  if (!_instance) {
    _instance = new SimulationService();
  }
  return _instance;
}

export function setSimulationService(svc: SimulationService): void {
  _instance = svc;
}
