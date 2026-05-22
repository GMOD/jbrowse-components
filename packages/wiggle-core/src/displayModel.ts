import type { WiggleBackend } from './backendTypes.ts'
import type { WiggleDataResult } from './dataTypes.ts'
import type { YScaleTicks } from './index.ts'
import type { GpuLifecycleModel } from '@jbrowse/core/util/useGpuBackend'

// Intersection contract every wiggle-style GPU display model exposes to its
// React component. Backend-typed for narrowing.
export interface WiggleGpuDisplayModel<
  TBackend extends WiggleBackend = WiggleBackend,
> extends GpuLifecycleModel<TBackend> {
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  ticks?: YScaleTicks
  canvasDrawn: boolean
  height: number
  error: Error | null
  isLoading: boolean
  isReady: boolean
  statusMessage?: string
  reload: () => void
}
