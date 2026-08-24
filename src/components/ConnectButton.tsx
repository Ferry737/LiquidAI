// src/components/ConnectButton.tsx
"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/Button";
import { shortAddr } from "@/lib/utils";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button variant="ghost" onClick={() => disconnect()}>
        <span className="h-2 w-2 rounded-full bg-[#1F8A4C] shadow-card" />
        {shortAddr(address)}
      </Button>
    );
  }

  const connector = connectors[0];
  return (
    <Button
      onClick={() => connector && connect({ connector })}
      disabled={isPending || !connector}
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
