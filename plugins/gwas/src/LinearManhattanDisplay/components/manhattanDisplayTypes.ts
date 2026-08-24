import type { ManhattanRpcResult } from '../../ManhattanRPC/rpcTypes.ts'
import type { ManhattanHit } from '../findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
} from '../manhattanRenderingBackendTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { RegionHost } from '@jbrowse/display-kit/regionHost'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ScoreRuleMark, WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

// Component-facing slice of LinearManhattanDisplayModel. Hand-rolled because
// `renderSvg.tsx` intersects this with the wiggle-family SVG contract and
// naming the inferred model there closes a type cycle; the component takes the
// same slice so the two can't disagree about what a manhattan display is.
export interface ManhattanDisplayModel extends WiggleGpuDisplayModel<
  ManhattanRenderingBackend,
  ManhattanRpcResult
> {
  // read by DisplayChrome, which publishes it as `data-display-id` — the stable
  // hook the browser tests use to target one track's display
  configuration: { displayId: string }
  host: RegionHost
  renderBlocks: RenderBlock[]
  regionRefNames: ReadonlyMap<number, string>
  flatbushes: ReadonlyMap<number, Flatbush>
  renderState: ManhattanRenderState
  scatterPointSize: number
  hoveredFeature: ManhattanHit | undefined
  ldColoringActive: boolean
  indexSnpMissing: boolean
  indexSnpOffscreen: boolean
  showLdLegend: boolean
  // the significance threshold as a score rule, [] when unset or off-domain
  scoreRuleMarks: ScoreRuleMark[]
  setHoveredFeature: (hit: ManhattanHit | undefined) => void
  selectFeature: (hit: ManhattanHit) => void
  contextMenuItems: (hit: ManhattanHit) => MenuItem[]
  setShowLdLegend: (val: boolean) => void
}
