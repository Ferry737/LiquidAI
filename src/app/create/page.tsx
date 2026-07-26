// src/app/create/page.tsx
import { CreatePosition } from "@/components/create/CreatePosition";

export default function CreatePage({
  searchParams,
}: {
  searchParams: { pool?: string; fee?: string };
}) {
  return (
    <CreatePosition
      initialPair={searchParams.pool}
      initialFee={searchParams.fee ? Number(searchParams.fee) : undefined}
    />
  );
}
