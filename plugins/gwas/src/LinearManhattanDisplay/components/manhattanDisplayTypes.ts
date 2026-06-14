import type { ManhattanRpcResult } from '../../ManhattanRPC/rpcTypes.ts'
import type { ManhattanHit } from '../findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
} from '../manhattanRenderingBackendTypes.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

// Component-facing slice of LinearManhattanDisplayModel. Hand-rolled to avoid
// a circular type between stateModelFactory.ts (lazy-imports the component)
// and the component (which would otherwise import the inferred model type).
export interface ManhattanDisplayModel extends WiggleGpuDisplayModel<
  ManhattanRenderingBackend,
  ManhattanRpcResult
> {
  renderBlocks: RenderBlock[]
  regionRefNames: ReadonlyMap<number, string>
  flatbushes: ReadonlyMap<number, Flatbush>
  renderState: ManhattanRenderState | undefined
  featureUnderMouse: ManhattanHit | undefined
  colorBy: 'normal' | 'ld'
  hasLdData: boolean
  indexSnpMissing: boolean
  showLdLegend: boolean
  setFeatureUnderMouse: (hit: ManhattanHit | undefined) => void
  selectFeature: (hit: ManhattanHit) => void
  colorByLdToHit: (hit: ManhattanHit) => void
  setShowLdLegend: (val: boolean) => void
}
