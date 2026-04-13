# Plan: `packages/wiggle-core` + alignments coverage scaling

When you complete a phase, remove it from this document.

---

## Background

The alignments coverage track (webgl-poc) currently has no scaling config — no
min/max score, no log scale, no autoscale type. On `origin/main`, the
`LinearSNPCoverageDisplay` extended `linearWiggleDisplayModelFactory` and
inherited the full wiggle scaling stack. That inheritance is gone on this branch
since coverage is now embedded in `LinearAlignmentsDisplay`.

The scaling utilities in `plugins/wiggle/src/util.ts` (`getNiceDomain`,
`getScale`, `getOrigin`, `makeScoreNormalizer`) are genuinely reusable.
Extracting them to a shared package avoids duplicating logic and gives
alignments coverage log scale, stddev autoscale, and manual min/max for free.

---

## Phase 1 — Create `packages/wiggle-core`

### 1.1 Package scaffold

- `packages/wiggle-core/package.json` — name `@jbrowse/wiggle-core`
  - deps: `@mui/x-charts-vendor` (d3-scale), `mobx-state-tree`, `@jbrowse/core`
- `packages/wiggle-core/tsconfig.json` — extend root tsconfig
- Add to pnpm workspace and root `tsconfig.json` references

### 1.2 `src/scale.ts`

Move from `plugins/wiggle/src/util.ts`:

- `getNiceDomain({ domain, bounds, scaleType, niced? })` — domain clamping with
  optional nice-rounding (`niced` defaults `true` for wiggle compatibility, pass
  `false` for alignments). This makes nicing opt-in rather than forced.
- `getScale(opts: ScaleOpts)` — D3 scale wrapper for linear/log
- `getOrigin(scaleType)` — 0 for linear, 1 for log
- `makeScoreNormalizer(min, max, isLog)` — maps a value to `[0, 1]` using log₂
  or linear arithmetic. **This is the key function enabling log-scale coverage
  in the GPU renderer without touching any shader.**
- `ScaleOpts` type

### 1.3 `src/domainFromStats.ts`

New shared function extracted from the inner logic of wiggle's
`computeAutoscaleDomain` (the part that runs once stats are in hand):

```ts
export function domainFromStats(
  stats: {
    scoreMin: number
    scoreMax: number
    scoreMean: number
    scoreStdDev: number
  },
  autoscaleType: 'local' | 'localsd' | 'global' | 'globalsd',
  numStdDev: number,
): [number, number]
```

Wiggle's `computeAutoscaleDomain` is refactored to gather its stats then call
this. Alignments calls it too after computing stats from depth arrays.

### 1.4 `src/sharedScaleConfigFields.ts`

A function returning MST config fields shared by both plugins, so both config
schemas can spread the same shape:

```ts
export function sharedScaleConfigFields() {
  return {
    autoscale: {
      type: 'stringEnum',
      values: ['local', 'localsd', 'global', 'globalsd'],
      defaultValue: 'local',
    },
    minScore: { type: 'number', defaultValue: Number.MIN_VALUE },
    maxScore: { type: 'number', defaultValue: Number.MAX_VALUE },
    scaleType: {
      type: 'stringEnum',
      values: ['linear', 'log'],
      defaultValue: 'linear',
    },
    numStdDev: { type: 'number', defaultValue: 3 },
  }
}
```

### 1.5 `src/SetMinMaxDialog.tsx`

Move from `plugins/wiggle/src/shared/SetMinMaxDialog.tsx` unchanged — it is
already generic (takes `setMinScore`/`setMaxScore` actions and `scaleType`).
Wiggle re-exports it from wiggle-core.

### 1.6 Update wiggle to import from wiggle-core

- `plugins/wiggle/src/util.ts` — import `getNiceDomain`, `getScale`,
  `getOrigin`, `makeScoreNormalizer` from `@jbrowse/wiggle-core`; remove local
  definitions
- `plugins/wiggle/src/shared/SharedWiggleConfigSchema.ts` — use
  `sharedScaleConfigFields()`, spread and extend
- `plugins/wiggle/src/shared/SetMinMaxDialog.tsx` — re-export from
  `@jbrowse/wiggle-core`
- Add `@jbrowse/wiggle-core` to wiggle's `package.json` deps

---

## Phase 2 — Coverage stats in `packages/alignments-core`

### 2.1 `computeVisibleCoverageStats`

New function in `coverageDownsampling.ts`. Replaces `computeVisibleMaxDepth` (or
lives alongside it; `computeVisibleMaxDepth` can be a thin wrapper that just
returns `stats.scoreMax`).

```ts
export function computeVisibleCoverageStats<
  B extends { start: number; end: number },
>(
  visibleBlocks: B[],
  getCoverageForBlock: (block: B) => CoverageRegion | undefined,
):
  | {
      scoreMin: number
      scoreMax: number
      scoreMean: number
      scoreStdDev: number
    }
  | undefined
```

Two passes over visible depth values: first for min/max/sum/count, second for
variance → stddev. Returns `undefined` if no coverage data.

### 2.2 `computeGlobalCoverageStats`

Parallel function over all loaded regions (not just visible), used for
`'global'` and `'globalsd'` autoscale:

```ts
export function computeGlobalCoverageStats<D>(
  dataMap: Map<unknown, D>,
  getDepths: (data: D) => Float32Array,
):
  | {
      scoreMin: number
      scoreMax: number
      scoreMean: number
      scoreStdDev: number
    }
  | undefined
```

### 2.3 `computeCoverageTicks` — log scale support

Add `scaleType` parameter. For log scale, generate ticks at powers of 2 within
the domain using D3's log scale `.ticks()`. For linear, keep existing
evenly-spaced logic.

---

## Phase 3 — Alignments model + render pipeline

### 3.1 Config schema

In `plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts`, add a
`coverage` sub-schema or spread `sharedScaleConfigFields()` directly:
`autoscale`, `minScore`, `maxScore`, `scaleType`, `numStdDev`.

### 3.2 Model: state, getters, actions

**New volatile state:**

```ts
visibleCoverageStats: {
  scoreMin: number; scoreMax: number; scoreMean: number; scoreStdDev: number
} | undefined
```

**New getters** (all via `getConfWithOverride`):

- `scaleType` — `'linear' | 'log'`
- `autoscaleType` — `'local' | 'localsd' | 'global' | 'globalsd'`
- `numStdDev`
- `minScoreConfig` — `undefined` when sentinel `Number.MIN_VALUE`
- `maxScoreConfig` — `undefined` when sentinel `Number.MAX_VALUE`
- `coverageDomain: [number, number] | undefined` — calls `domainFromStats` then
  `getNiceDomain({ niced: false })` with bounds from
  `minScoreConfig`/`maxScoreConfig`
- `coverageTicks` — updated to call
  `computeCoverageTicks(domain, height, scaleType)`

**Replace the `visibleMaxDepth` autorun** with a `coverageStats` autorun:

```ts
autorun(
  () => {
    const stats = computeVisibleCoverageStats(
      view.dynamicBlocks.contentBlocks,
      b => self.rpcDataMap.get(b.regionNumber!),
    )
    self.setVisibleCoverageStats(stats)
  },
  { delay: 400, name: 'LinearAlignmentsDisplay:coverageStats' },
)
```

**New actions:** `setMinScore`, `setMaxScore`, `setScaleType`,
`setAutoscaleType`, `setVisibleCoverageStats`

### 3.3 Render state

In `rendererTypes.ts`, replace `coverageMaxDepth: number | undefined` with:

```ts
coverageDomain: [number, number] | undefined
coverageIsLog: boolean
```

In `useAlignmentsBase.ts`:

```ts
coverageDomain: model.coverageDomain,
coverageIsLog: model.scaleType === 'log',
```

### 3.4 GPU renderer — CPU-side normalization

**The key architectural change.** Instead of uploading
`depth / coverageMaxDepth` and correcting cross-region each frame with
`U_DEPTH_SCALE`, normalize on the CPU at upload time using
`makeScoreNormalizer`. The GPU shader needs no changes for log scale.

In `uploadCoverageData()` in `GpuAlignmentsRenderer.ts`:

```ts
const [domainMin, domainMax] = state.coverageDomain ?? [0, region.maxDepth]
const normalize = makeScoreNormalizer(domainMin, domainMax, state.coverageIsLog)
// ...
f32[o + 1] = normalize(data.coverageDepths[i] ?? 0)
```

- Remove `U_DEPTH_SCALE` uniform and its slot (or set to 1 always while cleaning
  up the shader slot index table)
- The cross-region normalization that `region.maxDepth / visibleMaxDepth` was
  providing is now baked into `normalize` via the shared `coverageDomain`
- When `coverageDomain` or `coverageIsLog` changes (user edits config),
  re-upload all region coverage buffers. Add an autorun in the GPU renderer that
  watches `state.coverageDomain` and `state.coverageIsLog`, and calls
  `invalidateCoverageBuffers()` on change.

### 3.5 Canvas 2D renderer

In `Canvas2DAlignmentsRenderer.ts` coverage upload, replace
`/ data.coverageMaxDepth` with
`makeScoreNormalizer(domainMin, domainMax, isLog)`.

In `rendererUtils.ts` draw functions (`drawCoverageBins`, `drawSnpSegments`,
`drawModCovSegments`), values arriving are already `[0,1]`-normalized — no
further change needed.

### 3.6 SVG renderer

In `renderSvg.tsx`, replace `depth / coverageMaxDepth` with
`makeScoreNormalizer(domainMin, domainMax, isLog)(depth)`. Same for SNP and mod
segments.

### 3.7 Track menu items

In the model's coverage menu section:

- **"Set min/max score"** → `SetMinMaxDialog` from `@jbrowse/wiggle-core`
- **"Scale type"** submenu → Linear / Log (calls `setScaleType`)
- **"Autoscale"** submenu → Local / Local ± Std dev (calls `setAutoscaleType`)

---

## Key design decisions

**CPU-side normalization** — The GPU shader stays unchanged for log scale.
`makeScoreNormalizer` on the CPU produces `[0,1]` values regardless of scale
type. Adding log to WGSL/GLSL would require recompiling shaders and is
unnecessary.

**`niced` as opt-in flag** — `getNiceDomain` gains an optional `niced` boolean
(default `true` for wiggle backward-compat). Alignments passes `false` (the
behavior we just shipped). Users can eventually expose a "Snap to nice numbers"
menu toggle.

**`domainFromStats` in wiggle-core** — Both plugins compute the domain the same
way once they have stats. Stats _gathering_ diverges (wiggle: feature score
arrays with mean/stddev; alignments: depth `Float32Array`). Keeping the domain
logic shared means both plugins get the same stddev-clipping behavior.

**`autoscale: 'global'` initially not exposed in alignments menu** — Global
autoscale requires loading all coverage data for all regions, which may not be
fetched. Add in a follow-up once we understand the data-flow cost.

**Re-upload on domain change** — Cleaner than adding log-scale GPU uniforms.
Coverage buffers are small (one float per visible bp at most). The 400ms autorun
delay prevents thrashing while the user drags a min/max slider.
