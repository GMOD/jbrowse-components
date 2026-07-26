import type { WiggleDataResult } from './dataTypes.ts'
import type { YScaleTicks } from './index.ts'
import type { WiggleRenderingBackend } from './renderingBackendTypes.ts'
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
  ticks?: YScaleTicks
  canvasDrawn: boolean
  height: number
  // `unknown`, matching FetchMixin's volatile (it preserves whatever was thrown)
  // and DisplayChrome's error bar. Declaring `Error | null` here was a lie the
  // model never satisfied — nothing in this contract's consumers narrows it.
  error: unknown
  isLoading: boolean
  displayPhase: DisplayPhase
  statusMessage?: string
  reload: () => void
  regionTooLarge: boolean
  regionTooLargeReason: string
  forceLoad: () => void
  displayCrossHatches: boolean
}
