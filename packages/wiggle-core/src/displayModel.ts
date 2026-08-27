import type { WiggleDataResult } from './dataTypes.ts'
import type { WiggleRenderingBackend } from './renderingBackendTypes.ts'
import type { YScaleTicks } from './yScaleTicks.ts'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'

// Intersection contract every wiggle-family GPU display model (wiggle,
// multi-wiggle, manhattan) exposes to its React component. RenderingBackend-typed for
// narrowing; TData lets specialized displays (e.g. manhattan) declare their
// rpcDataMap value shape instead of using WiggleDataResult.
export interface WiggleGpuDisplayModel<
  TRenderingBackend = WiggleRenderingBackend,
  TData = WiggleDataResult,
> extends RenderLifecycleModel<TRenderingBackend> {
  rpcDataMap: ReadonlyMap<number, TData>
  // the containing view as `MultiRegionDisplayMixin` types it, so a component
  // reads `model.host.visibleRegions` instead of casting `getContainingView`
  host: RegionHost
  ticks?: YScaleTicks
  canvasDrawn: boolean
  // `painted` is `canvasDrawn` widened by `rendersCanvas` — what `DisplayChrome`
  // publishes as `data-display-drawn`, and what any consumer outside the display
  // should ask. `canvasDrawn` stays because manhattan reads the raw flag
  // directly to gate its LD legend on real pixels.
  painted: boolean
  height: number
  // The CSS width of the display's canvas, and the width its `renderState`
  // carries. Off the model rather than `getContainingView(model).trackWidthPx`
  // in each component: that is the same question answered a second way, out of
  // four plausible view getters, and it is the one MAF drifted on. See
  // `MultiRegionDisplayMixin.canvasWidthPx`, which every display in this family
  // composes.
  canvasWidthPx: number
  // `unknown`, matching FetchMixin's volatile (it preserves whatever was thrown)
  // and DisplayChrome's error bar. Declaring `Error | null` here was a lie the
  // model never satisfied — nothing in this contract's consumers narrows it.
  error: unknown
  displayPhase: DisplayPhase
  statusMessage?: string
  reload: () => void
  regionTooLarge: boolean
  regionTooLargeReason: string
  // The banner's third field, alongside the two above. It was missing here
  // while `TooLargeMessageModel` had it optional, so this contract type-checked
  // against the chrome while under-declaring what the real models expose — every
  // display in this family composes `RegionTooLargeMixin` and has it. Harmless
  // in practice, since none of the three opts the gate in and so none can reach
  // the `tooLarge` phase, but a duck-typed contract that omits a member the
  // model has is how a shared component comes to read `undefined` from one
  // caller and a real value from another.
  zoomCanReleaseGate: boolean
  forceLoad: () => void
  // the resolved "do the hatches draw" getter, never the raw
  // `displayCrossHatches` setting — density mode has no score axis for them to
  // rule and drops the track-menu toggle
  showCrossHatches: boolean
}
