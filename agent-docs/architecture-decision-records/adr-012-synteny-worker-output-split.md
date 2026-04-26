# ADR-012: Synteny worker emits geometry only; main thread owns colors and picking IDs

## Status

Accepted

## Context

`buildSyntenyGeometry` (worker, `plugins/linear-comparative-view/src/LinearSyntenyRPC/buildSyntenyGeometry.ts`)
produces the per-instance GPU buffers consumed by both the WebGL/WebGPU and
Canvas2D synteny renderers. Originally it also emitted two derived fields:

- `colors: Uint32Array` — packed RGBA per instance, computed by
  `computeSyntenyColors({ colorBy: 'default', ... })` at the end of the worker
  pass.
- `featureIds: Float32Array` — `instanceFeatureIdx[i] + 1`, a parallel copy of
  the Uint32 `instanceFeatureIdx` field offset by one (0 reserved for
  "no hit" in the picking framebuffer).

Both are consumed by the GPU/Canvas renderers. But the main thread already
recomputes `colors` from scratch in the `computedColors` getter
(`LinearSyntenyDisplay/model.ts`) whenever `colorBy`, `featureData`, or the
instance descriptors change — and `renderInstanceData` substitutes that into
the geometry before it reaches any renderer:

    return { ...instanceData, colors: computedColors }

So the worker-computed colors are overwritten before they ever reach a draw
call. This pattern exists deliberately so that `colorBy` changes (strand,
query, syri, default) re-upload geometry without an RPC round-trip — the
display reads `renderInstanceData` from `geometryByDisplayKey`, which is a
main-thread getter.

Similarly, `featureIds` duplicates `instanceFeatureIdx`: same length, same
indexing, just with `+1`. It exists because the WebGL2 vertex attribute at
location 5 is declared `float featureId` and the picking shader reads it back
as `uint(fragIn.featureId)` to encode into the RGB888 picking framebuffer. Any
consumer that wants the picking ID can compute `instanceFeatureIdx[i] + 1`
inline.

## Decision

Split the worker output type from the renderer input type, and stop emitting
both derived fields from the worker:

    // Worker output. No `colors`, no `featureIds`.
    export interface SyntenyGeometry { ... }

    // Renderer input. Adds `colors` injected by the main thread.
    export type SyntenyInstanceData = SyntenyGeometry & {
      colors: Uint32Array
    }

`buildSyntenyGeometry` returns `SyntenyGeometry`. `self.instanceData` on the
display model is typed `SyntenyGeometry | undefined`. `renderInstanceData`
returns `SyntenyInstanceData | undefined`, narrowing the type by injecting
`computedColors`. Renderers (`Canvas2DSyntenyRenderer`, `GpuSyntenyRenderer`,
`interleaveInstances`) consume `SyntenyInstanceData` so they statically see
`colors` as required.

Picking IDs are computed at the consumer:

- `instanceInterleave.ts` writes `instanceFeatureIdx[i] + 1` directly into the
  Float32 attribute slot at interleave time.
- `Canvas2DSyntenyRenderer.ts` reads `data.instanceFeatureIdx[i] + 1` for
  hover/click comparison.
- `model.ts` `renderParams` derives `hoveredFeatureId`/`clickedFeatureId` the
  same way.

## Rationale

### Worker color computation was dead work

`computeSyntenyColors` in the worker allocated a `Uint32Array(instanceCount)`
and ran a per-instance loop, then transferred the buffer across the worker
boundary, where it was immediately discarded by `renderInstanceData`'s spread.
This was 100% wasted on every RPC. The fix is structural, not a micro-opt: the
worker has no business computing a `colorBy`-dependent field when `colorBy`
lives on the main thread.

### `featureIds` was a parallel copy of `instanceFeatureIdx`

Both are length-`instanceCount` arrays. `featureIds[i] === instanceFeatureIdx[i] + 1`.
Storing both means: 4 bytes/instance of duplicated data in the worker
buffer-grow path (one more `growF32` call per `ensureCapacity`), 4
bytes/instance transferred over the RPC boundary, and one more typed-array
allocation. Computing `+1` at consumer-side is free.

The Float32-vs-Uint32 question is moot here: the picking framebuffer is
RGB888 (24-bit), so feature IDs above ~16M cannot be picked regardless of
buffer type. Float32's 24-bit mantissa already represents that range
exactly, and the shader attribute stays `float featureId : ATTR5` so no
shader regeneration is needed.

### Type split makes the contract explicit

`SyntenyInstanceData` previously claimed `colors` was always present, while in
practice the worker's `colors` was always overwritten and the only reliable
source was `renderInstanceData`. Splitting `SyntenyGeometry` (raw worker
output) from `SyntenyInstanceData` (post-substitution) makes that flow
type-checked: any code that needs colors must go through `renderInstanceData`,
and `self.instanceData` cannot be passed directly to a renderer.

## Consequences

### Positive

- One Uint32Array allocation + one per-instance color loop + one transfer
  buffer eliminated per RPC call.
- One Float32Array allocation + one `growF32` call per `ensureCapacity` +
  one transfer buffer eliminated per RPC call.
- Worker output is now `colorBy`-independent — re-uploads on `colorBy` change
  are a pure main-thread substitution.
- Type system enforces "colors come from the main thread."

### Negative

- Two types instead of one. Renderer signatures take `SyntenyInstanceData`,
  worker returns `SyntenyGeometry`. Test fixtures must construct
  `SyntenyInstanceData` (with `colors`).
- The picking-ID `+1` offset is now repeated at three call sites
  (`interleaveInstances`, `Canvas2DSyntenyRenderer`, `model.ts` renderParams)
  instead of being baked into a precomputed Float32Array. If we add a fourth
  consumer it should also do the `+1` inline, not extract a helper — the
  semantic is "picking ID = index + 1 (0 means no hit)" and is shader-defined,
  not codebase-wide.

## Alternatives considered

- **Keep `colors` in the worker, skip `computeSyntenyColors` only when
  `colorBy === 'default'`**: doesn't solve the structural issue. The worker
  still has to know about `colorBy`, and the main thread still recomputes for
  any non-default scheme. Cleaner to remove entirely.
- **Switch `featureId` shader attribute from `float` to `uint`**: would let
  the worker buffer be Uint32 instead of Float32 — but the picking framebuffer
  caps the practical range at 24 bits regardless, and the change cascades
  through three shaders (`syntenyTypes.slang`, `syntenyFill.slang`,
  `syntenyEdge.slang`, `syntenyPicking.slang`) plus the `hoveredFeatureId`/
  `clickedFeatureId` uniform types. No capacity gain, large blast radius.
- **Make `colors` optional on `SyntenyInstanceData` and use `data.colors!` at
  every consumer**: shifts the type assertion burden to consumers and reverses
  the safety story (renderers now have to know they're getting post-substitution
  data). The split-type approach makes that invariant a compile-time check.

## References

- `plugins/linear-comparative-view/src/LinearSyntenyRPC/buildSyntenyGeometry.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts`
  (`computedColors`, `renderInstanceData`)
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/instanceInterleave.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/syntenyColors.ts`
  (`computeSyntenyColors`)
- ADR-005 (shader codegen) for why touching `featureId` attribute type is
  expensive.
