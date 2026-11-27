---
name: reference-trim-leftovers
description: "Small open items the 2026-09-30 pare-down of reference/ cut from their docs, re-checked against main on 2026-11-27: a dead MST node returned as a live Region, no Canvas2D fallback after repeated context losses, all-or-nothing WebGPU pipeline compiles, two bpToPx, a BAM name pair to move upstream."
---

# Reference trim leftovers

The 2026-09-30 pass cut `reference/` to rules and mechanisms, and these were
open work rather than reference. Each still held on 2026-11-27.

- **`renameRegionIfNeeded`** (`packages/core/src/util/renameRegions.ts`)
  returns a dead MST node as is, typed as a live `Region`, where a live one is
  copied out with `getSnapshot` (CORE_UTIL_AUDIT).
- **No Canvas2D fallback after repeated context losses.** Once
  `RecoveryBudget` (`packages/render-core/src/recoveryBudget.ts`) gives up, a
  display waits on the manual Retry button; dropping that display to Canvas2D
  would keep it drawing while GPU capacity is short (ARCHITECTURAL_LIMITS).
- **`resolvePipelines`** (`packages/render-core/src/hal/webgpuHal.ts`) awaits
  every pass with `Promise.all`, so one pass's failed compile rejects the
  display's whole pipeline set.
- **Two exported `bpToPx`**: `packages/core/src/util/bpUtils.ts` and
  `Base1DUtils.ts` take different arguments under one name (CONFIG_PATTERN,
  TRACK_REGISTRATION).
- **`nameLength` and `copyNameInto`** live on `BamSlightlyLazyFeature`
  (`plugins/alignments/src/BamAdapter/`) and belong on `@gmod/bam`'s
  `BamRecord` (BAM_STACK_INTEGRATION).
