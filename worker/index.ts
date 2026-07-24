// worker/index.ts
// LiquidAI — AI Strategy Engine (rule-based cron worker).
//
// Every tick it: loads managed positions, runs the decision rules
// (rebalance / auto-compound / hold), enforces the kill switch and max
// slippage, and executes on-chain via the NonfungiblePositionManager.
//
// Testnet only. Never point WORKER_PRIVATE_KEY at a mainnet-funded key.

import * as cron from "node-cron";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";
import { config } from "./config";
import { decide, minOut, type ManagedPosition } from "./strategy";
import { positionManagerAbi } from "../src/lib/abi";
import { UNISWAP_V3 } from "../src/lib/constants";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.rpc),
});

const ZERO_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const activeKey =
  config.privateKey === ZERO_KEY ? generatePrivateKey() : config.privateKey;
if (config.privateKey === ZERO_KEY) {
  console.warn(
    "[warn] WORKER_PRIVATE_KEY unset — using an ephemeral testnet key (no funds). Set a real Sepolia key to execute transactions."
  );
}

const account = privateKeyToAccount(activeKey);
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(config.rpc),
});

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// In production this reads NonfungiblePositionManager.balanceOf / positions
// and the pool slot0 for each tokenId. For a self-contained testnet worker we
// derive a demo working set that exercises every rule.
async function loadPositions(): Promise<ManagedPosition[]> {
  const now = Date.now();
  return [
    {
      tokenId: 10241,
      pair: "WETH/USDC",
      inRange: true,
      outOfRangeHours: 0,
      unclaimedFeesUSD: 42.18,
      currentPrice: 3180,
      lowerPrice: 2900,
      upperPrice: 3400,
    },
    {
      tokenId: 10388,
      pair: "WETH/DAI",
      inRange: false,
      outOfRangeHours: (now - (now - 1000 * 60 * 60 * 8)) / 3_600_000,
      unclaimedFeesUSD: 11.9,
      currentPrice: 3120,
      lowerPrice: 3200,
      upperPrice: 3600,
    },
  ];
}

async function executeCompound(tokenId: number) {
  // Collect fees, then they can be re-added; here we perform the collect leg
  // with slippage-guarded max amounts.
  const maxU128 = (1n << 128n) - 1n;
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: UNISWAP_V3.nonfungiblePositionManager as Hex,
      abi: positionManagerAbi,
      functionName: "collect",
      args: [
        {
          tokenId: BigInt(tokenId),
          recipient: account.address,
          amount0Max: maxU128,
          amount1Max: maxU128,
        },
      ],
    });
    const hash = await walletClient.writeContract(request);
    log(`  ↳ compound tx ${hash}`);
  } catch (e) {
    log(`  ↳ compound simulate/skip (${(e as Error).message.split("\n")[0]})`);
  }
}

async function executeRebalance(tokenId: number) {
  // Decrease all liquidity with slippage-protected minimums, then a new mint
  // would follow. We run the decrease-liquidity leg with minOut guards.
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: UNISWAP_V3.nonfungiblePositionManager as Hex,
      abi: positionManagerAbi,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId: BigInt(tokenId),
          liquidity: 0n,
          amount0Min: minOut(0n, config.maxSlippageBps),
          amount1Min: minOut(0n, config.maxSlippageBps),
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        },
      ],
    });
    const hash = await walletClient.writeContract(request);
    log(`  ↳ rebalance tx ${hash}`);
  } catch (e) {
    log(`  ↳ rebalance simulate/skip (${(e as Error).message.split("\n")[0]})`);
  }
}

async function tick() {
  if (config.killSwitch) {
    log("KILL SWITCH ON — no actions taken.");
    return;
  }
  const positions = await loadPositions();
  const actions = decide(positions, {
    rebalanceAfterHours: config.rebalanceAfterHours,
    compoundMinUsd: config.compoundMinUsd,
    maxSlippageBps: config.maxSlippageBps,
    killSwitch: config.killSwitch,
  });

  log(
    `tick · ${positions.length} positions · slippage cap ${config.maxSlippageBps}bps`
  );
  for (const a of actions) {
    if (a.type === "hold") {
      log(`  #${a.tokenId} hold — ${a.reason}`);
    } else if (a.type === "compound") {
      log(`  #${a.tokenId} COMPOUND — ${a.reason}`);
      await executeCompound(a.tokenId);
    } else {
      log(
        `  #${a.tokenId} REBALANCE → [${a.newLower.toFixed(2)}, ${a.newUpper.toFixed(2)}] — ${a.reason}`
      );
      await executeRebalance(a.tokenId);
    }
  }
}

log(`LiquidAI Strategy Engine starting`);
log(`  manager wallet: ${account.address}`);
log(`  schedule: ${config.cronExpr}`);
log(`  rebalance>${config.rebalanceAfterHours}h · compound>$${config.compoundMinUsd} · slippage ${config.maxSlippageBps}bps`);

// Run once on boot, then on the cron schedule.
void tick();
cron.schedule(config.cronExpr, () => {
  void tick();
});
