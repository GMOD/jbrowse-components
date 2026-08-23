import type { ScoreRamp } from '../../shared/ScoreLegend.tsx'
import type { WigglePlotGeometry } from '../../shared/wiggleDisplayViews.ts'
import type { WiggleHoveredFeature } from '../../util.ts'
import type { ScoreRuleMark, WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

// What WiggleComponent reads off the display. NOT `WiggleGpuProps` (the
// GPU-encode input contract): the single-wiggle model exposes those only through
// `gpuProps()`, not as flat fields — it has no top-level `sources` at all — so
// inheriting that interface here demanded a field the model doesn't have. The
// component reads exactly the two below. See the contract assertion at the bottom
// of ../model.ts, which is what caught the mismatch.
export interface WiggleDisplayModel extends WiggleGpuDisplayModel {
  // read by DisplayChrome, which publishes it as `data-display-id` — the stable
  // hook the browser tests use to target one track's display
  configuration: { displayId: string }
  domain: [number, number] | undefined
  scaleType: string
  // where the plot canvas sits inside the display's height — the same value
  // `ticks` and the SVG export are laid out against
  plotGeometry: WigglePlotGeometry
  // the resolved mode, never the raw `summaryScoreMode` slot: density draws
  // averages whatever the slot says, and the tooltip has to report what the
  // plot (and the track menu's radio) actually shows
  effectiveSummaryScoreMode: string
  isDensityMode: boolean
  scoreRamp: ScoreRamp | undefined
  // resolved screen positions for the configured reference rules, [] when none
  scoreRuleMarks: ScoreRuleMark[]
  hoveredFeature?: WiggleHoveredFeature
  setHoveredFeature: (feat?: WiggleHoveredFeature) => void
  selectFeature: (feat: WiggleHoveredFeature) => void
}
