import type { ManhattanRpcResult } from '../../ManhattanRPC/rpcTypes.ts'
import type { ManhattanHit } from '../findManhattanHit.ts'
import type {
  ManhattanBackend,
  ManhattanRenderState,
} from '../manhattanBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

// Component-facing slice of LinearManhattanDisplayModel. Hand-rolled to avoid
// a circular type between stateModelFactory.ts (lazy-imports the component)
// and the component (which would otherwise import the inferred model type).
export interface ManhattanDisplayModel
  extends WiggleGpuDisplayModel<ManhattanBackend, ManhattanRpcResult> {
  renderBlocks: RenderBlock[]
  regionRefNames: ReadonlyMap<number, string>
  renderState: ManhattanRenderState | undefined
  featureUnderMouse: ManhattanHit | undefined
  setFeatureUnderMouse: (hit: ManhattanHit | undefined) => void
  selectFeature: (hit: ManhattanHit) => void
}
