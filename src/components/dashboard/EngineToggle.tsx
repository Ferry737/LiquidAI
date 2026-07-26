// src/components/dashboard/EngineToggle.tsx
// v1.3: Prominent Live/Dry Run toggle with cyan glow in dry-run mode.
// Shows a confirmation modal when switching from Dry Run → Live.

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { EngineStateDto } from "@/lib/api";

interface EngineToggleProps {
  engineState: EngineStateDto | null;
  onToggle: (dryRun: boolean) => Promise<void>;
}

export function EngineToggle({ engineState, onToggle }: EngineToggleProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [internalDryRun, setInternalDryRun] = useState<boolean | null>(null);

  // Sync from prop, but keep local state for optimistic updates
  useEffect(() => {
    if (engineState) setInternalDryRun(engineState.dryRun);
  }, [engineState]);

  const dryRun = internalDryRun ?? engineState?.dryRun ?? true;

  const handleToggle = () => {
    if (dryRun) {
      // Switching to LIVE — show confirmation modal
      setShowConfirm(true);
    } else {
      // Switching to DRY RUN — safe, no confirmation needed
      void doToggle(true);
    }
  };

  const doToggle = async (toDryRun: boolean) => {
    setToggling(true);
    setInternalDryRun(toDryRun);
    try {
      await onToggle(toDryRun);
    } catch {
      // Revert on failure
      setInternalDryRun(!toDryRun);
    } finally {
      setToggling(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={cn(
          "group relative inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300",
          dryRun
            ? "border-brand-500/30 bg-brand-500/10 text-brand-500 shadow-card"
            : "border-[#22892F]/30 bg-[#22892F]/10 text-[#22892F] shadow-card",
          "hover:brightness-110 disabled:opacity-40"
        )}
      >
        <span
          className={cn(
            "relative flex h-4 w-7 items-center rounded-full transition-colors duration-300",
            dryRun ? "bg-brand-500/25" : "bg-[#22892F]/25"
          )}
        >
          <span
            className={cn(
              "absolute h-3 w-3 rounded-full transition-all duration-300",
              dryRun
                ? "left-0.5 bg-brand-500 shadow-card"
                : "right-0.5 translate-x-0 bg-[#22892F] shadow-card"
            )}
          />
        </span>
        {dryRun ? "Dry Run" : "Live"}
      </button>

      {/* Confirmation modal for switching to Live */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowConfirm(false)}
        >
          <Card
            hover={false}
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B26A00]/10 text-xl">
                  ⚠️
                </div>
                <h3 className="text-lg font-semibold">
                  Switch to Live Mode?
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">
                The engine will start executing real transactions on Sepolia.
                Make sure your worker wallet has testnet ETH and your strategy
                configs are correct.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => void doToggle(false)}>
                  Go Live
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
