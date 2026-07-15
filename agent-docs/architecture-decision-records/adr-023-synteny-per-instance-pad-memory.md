# ADR-023: Per-instance pad memory — no action

## Status

Closed — not a real problem under realistic workloads.

## Context

ADR-018 stores `padTop` / `padBottom` as per-instance Float32 attributes rather
than a per-region uniform table. The tradeoff: ~400 B for a 100-region table vs
`N_instances × 8 B` for per-instance storage. At 1M instances that is ~8 MB
just for padding, growing with all other per-instance cumBp hi/lo data.

The concern was that dense self-PAF (chr1×chr1 chained at high resolution)
could push instance buffers past 30+ MB and cause GPU memory pressure.

## Decision

No action. The scenario that makes this costly is not a realistic workload:

- The < 1 px CIGAR merge threshold caps visible instances at any given zoom to
  well under 1M for any real dataset.
- Modern GPUs have gigabytes of VRAM; 30+ MB would require pathologically dense
  data at a zoom level that would itself be unusable.
- The alternative (per-region uniform table) was already evaluated and rejected
  in ADR-010 and ADR-018 for codegen invasiveness and MAX_REGIONS cap concerns.

If GPU memory pressure ever becomes measurable (visible in `chrome://gpu` for a
real dataset), ADR-018's "Revisit if" clause already documents the fix path: a
per-region uniform table, at which point the codegen array support rejected in
ADR-010 gets a real cost-benefit case.

## Consequences

No code change. The TODO.md entry is removed.
