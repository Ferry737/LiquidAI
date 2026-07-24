// src/hooks/useStrategy.ts
// React Query hooks for per-position strategy config and action log.

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchActions,
  fetchStrategy,
  updateStrategy,
} from "@/lib/api";
import type { StrategyConfigDto } from "../../shared/types";

export function useStrategy(positionId: string | undefined) {
  return useQuery<StrategyConfigDto>({
    queryKey: ["strategy", positionId],
    queryFn: () => fetchStrategy(positionId!),
    enabled: !!positionId,
    staleTime: 15_000,
  });
}

export function useActions(
  positionId: string | undefined,
  page = 1
) {
  return useQuery({
    queryKey: ["actions", positionId, page],
    queryFn: () => fetchActions(positionId!, page),
    enabled: !!positionId,
    staleTime: 10_000,
  });
}

export function useUpdateStrategy(positionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<StrategyConfigDto, "positionId" | "updatedAt">>) =>
      updateStrategy(positionId!, patch),
    onMutate: async (patch) => {
      const key = ["strategy", positionId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StrategyConfigDto>(key);
      if (prev) {
        const optimistic: StrategyConfigDto = { ...prev, ...patch };
        qc.setQueryData<StrategyConfigDto>(key, optimistic);
      }
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["strategy", positionId], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["strategy", positionId] });
    },
  });
}
