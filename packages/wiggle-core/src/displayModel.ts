import { when } from 'mobx'

import type { WiggleBackend } from './backendTypes.ts'
import type { WiggleDataResult } from './dataTypes.ts'
import type { YScaleTicks } from './index.ts'
import type { GpuLifecycleModel } from '@jbrowse/core/util/useGpuBackend'

// Intersection contract every wiggle-family GPU display model (wiggle,
// multi-wiggle, manhattan) exposes to its React component. Backend-typed for
// narrowing; TData lets specialized displays (e.g. manhattan) declare their
// rpcDataMap value shape instead of using WiggleDataResult.
export interface WiggleGpuDisplayModel<
  TBackend = WiggleBackend,
  TData = WiggleDataResult,
> extends GpuLifecycleModel<TBackend> {
  rpcDataMap: ReadonlyMap<number, TData>
  ticks?: YScaleTicks
  canvasDrawn: boolean
  height: number
  error: Error | null
  isLoading: boolean
  isReady: boolean
  statusMessage?: string
  reload: () => void
  displayCrossHatches: boolean
  scalebarOverlapLeft: number
}

// SVG export and any other off-screen renderer must wait until the display has
// reached a terminal state — either some data arrived, the fetch errored, or
// the region was rejected as too large. Returning early any other time would
// emit an empty SVG node that doesn't reflect what the user sees on-screen.
// Loose typing: MST models expose `error` as `unknown` and may add more keys,
// so we only require the predicates we read.
export function waitForRenderableState(model: {
  rpcDataMap: { size: number }
  error: unknown
  regionTooLarge: boolean
}) {
  return when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )
}
