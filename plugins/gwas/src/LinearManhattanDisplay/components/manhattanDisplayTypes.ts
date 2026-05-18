import type { ManhattanHit } from '../findManhattanHit.ts'
import type {
  ManhattanBackend,
  ManhattanRenderState,
} from '../manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../../ManhattanRPC/rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { GpuLifecycleModel } from '@jbrowse/core/util/useGpuModelLifecycle'
import type { YScaleTicks, WiggleRenderBlock } from '@jbrowse/wiggle-core'

// Component-facing slice of LinearManhattanDisplayModel. Hand-rolled to
// avoid a circular type between stateModelFactory.ts (lazy-imports the
// component) and the component (which would otherwise import the inferred
// model type). Mirrors plugins/wiggle/src/LinearWiggleDisplay/components/
// wiggleDisplayTypes.ts.
export interface ManhattanDisplayModel
  extends GpuLifecycleModel<ManhattanBackend> {
  manhattanData: ReadonlyMap<number, ManhattanRpcResult>
  renderBlocks: WiggleRenderBlock[]
  manhattanRenderState(): ManhattanRenderState | undefined
  height: number
  canvasDrawn: boolean
  error: Error | null
  isReady: boolean
  isLoading: boolean
  statusMessage?: string
  reload: () => void
  ticks?: YScaleTicks
  displayCrossHatches: boolean
  scalebarOverlapLeft: number
  manhattanHit: ManhattanHit | undefined
  setManhattanHit: (hit: ManhattanHit | undefined) => void
  selectFeature: (feature: Feature) => void
}
