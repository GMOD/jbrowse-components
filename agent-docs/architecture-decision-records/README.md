# Architecture decision records

One decision per file — why something is the way it is, and what alternatives
were rejected. Read the relevant ADR before "simplifying" a design that looks
accidental; several record deliberate choices that a fresh eye would try to undo.

Statuses: **Accepted** (in force), **Rejected** (considered, not done — the ADR
records why *not*), **Superseded** (replaced; see the note), **Closed** (no
action needed under current workloads), **Proposed** (not yet decided).

| ADR | Status | Decision |
| --- | --- | --- |
| [001](adr-001-rpc-data-map-pattern.md) | Accepted | Keep `new Map()` reassignment pattern for volatile RPC data |
| [002](adr-002-variant-batch-rpc-and-inputkey-upload.md) | Accepted | Variant display uses batch RPC and inputKey-gated uploads |
| [003](adr-003-settings-invalidation-pattern.md) | Accepted | Settings-invalidation autorun pattern for withFetchLifecycle displays |
| [004](adr-004-inputkey-upload-gate.md) | Rejected | Keep reference-identity upload gate; don't adopt inputKey pattern universally |
| [005](adr-005-shader-codegen-slang.md) | Accepted | Author shaders in Slang, cross-compile to WGSL/GLSL + generate TS layout |
| [006](adr-006-preserve-stale-rpc-data-across-refetch.md) | Accepted | Preserve stale `rpcDataMap` through a refetch |
| [007](adr-007-global-data-display-mixin.md) | Accepted | `GlobalDataDisplayMixin` — fetch lifecycle for monolithic-dataset GPU displays |
| [008](adr-008-wiggle-strict-bpperpx-equality.md) | Accepted | Strict-equality `bpPerPx` cache check for wiggle |
| [009](adr-009-canvas-drawn-reliability.md) | Accepted | `canvasDrawn` reliability — backend-owned return and reset on invalidation |
| [010](adr-010-synteny-dotplot-pixel-offsets.md) | Superseded | Synteny/dotplot pre-projected pixel offsets — superseded by ADR-018 for synteny |
| [011](adr-011-canvas-flatbush-immutable-offsets.md) | Rejected | Canvas flatbushItem/subfeatureInfo stay mutable; reject parallel offset arrays |
| [012](adr-012-synteny-worker-output-split.md) | Accepted | Synteny worker emits geometry only; main thread owns colors and picking IDs (picking part superseded by ADR-019) |
| [016](adr-016-bicolorpivot-stays-in-worker.md) | Accepted | `bicolorPivot` split stays in the worker, not `gpuProps` |
| [017](adr-017-wiggle-per-key-autoruns.md) | Accepted | Per-region streamed wiggle upload uses per-key autoruns |
| [018](adr-018-synteny-cumbp-hpmath-storage.md) | Accepted | Synteny corner storage moves to cumulative-bp hi/lo Float32 (supersedes ADR-010) |
| [019](adr-019-synteny-cpu-picking.md) | Accepted | Synteny picking moves from GPU framebuffer readback to CPU (supersedes ADR-012 picking) |
| [020](adr-020-wiggle-line-plot-encoding.md) | Accepted | Wiggle line-plot single-polyline encoding |
| [021](adr-021-getfeaturearrays-stays-duck-typed.md) | Accepted | Wiggle adapter fast path stays duck-typed; bicolor split lives at the executor |
| [022](adr-022-no-batched-wiggle-rpc.md) | Accepted | No batched wiggle RPC; per-region parallel dispatch is the right shape |
| [023](adr-023-synteny-per-instance-pad-memory.md) | Closed | Per-instance pad memory — no action |
| [024](adr-024-per-backend-snapshots-real-gpu.md) | Accepted | Browser-test snapshots are per-backend, rendered on a real GPU, run locally |
| [025](adr-025-gpu-canvas-stays-mounted-not-xor-error.md) | Superseded | GPU canvas stays mounted across error/retry — superseded by the DisplayChrome unification |
| [026](adr-026-displaychrome-layering-stays.md) | Accepted | DisplayChrome's layering stays — the split maps to concern boundaries |
| [027](adr-027-wheel-input-semantics.md) | Accepted | Wheel-input semantics stay per-handler — a unified resolver is relocation, not simplification |
| [028](adr-028-tooltip-clientpoint-vs-pointer-tracking.md) | Accepted | Hover tooltips pass a controlled `clientPoint`; floating-ui pointer-tracking is opt-in |
| [029](adr-029-managed-embedded-components.md) | Proposed | Managed embedded React components (uncontrolled, init-driven) |
| [030](adr-030-render-core-package-static-import-only.md) | Accepted | Extract `@jbrowse/render-core`; GPU rendering API is static-import-only |
| [031](adr-031-track-config-hydration-cache-on-pluginmanager.md) | Accepted | Frozen-track hydration cache lives on `PluginManager`, not a module-level singleton |
| [032](adr-032-track-config-nodes-are-throwaway-views.md) | Accepted | Hydrated track-config MST nodes are throwaway views, not authoritative state |
| [033](adr-033-synteny-lod-prune-at-data-draw-crisp-at-shader.md) | Accepted | Synteny/dotplot LOD — prune at the data layer, draw survivors crisp at the shader |
| [034](adr-034-dotplot-diagonalize-stays-single-axis.md) | Accepted | Dotplot/synteny auto-diagonalize stays single-axis; both-axis seriation rejected |
| [035](adr-035-pileup-maxheight-bounds-pixels-not-gpu-memory.md) | Closed | `maxHeight` bounds pixels, not GPU instance count — no action |
