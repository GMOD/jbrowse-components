import type { WiggleDataResult } from './dataTypes.ts'
import type { YScaleTicks } from './index.ts'
import type { WiggleRenderingBackend } from './renderingBackendTypes.ts'
import type { RegionByteEstimate } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

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
  error: Error | null
  isLoading: boolean
  displayPhase: DisplayPhase
  statusMessage?: string
  reload: () => void
  regionTooLarge: boolean
  regionTooLargeReason: string
  byteEstimate?: RegionByteEstimate
  raiseForceLoadLimits: (s?: RegionByteEstimate) => void
  forceLoad: () => void
  displayCrossHatches: boolean
  scalebarOverlapLeft: number
}
