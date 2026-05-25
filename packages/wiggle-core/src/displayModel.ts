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
