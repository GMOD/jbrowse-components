import type { ScoreRamp } from '../../shared/ScoreLegend.tsx'
import type { WiggleFeatureUnderMouse } from '../../util.ts'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

// What WiggleComponent reads off the display. NOT `WiggleGpuProps` (the
// GPU-encode input contract): the single-wiggle model exposes those only through
// `gpuProps()`, not as flat fields — it has no top-level `sources` at all — so
// inheriting that interface here demanded a field the model doesn't have. The
// component reads exactly the two below. See the contract assertion at the bottom
// of ../model.ts, which is what caught the mismatch.
export interface WiggleDisplayModel extends WiggleGpuDisplayModel {
  // read by the registered wrapper's DisplayContainer, which emits the generic
  // `display-${displayId}-done` testid the browser tests wait on
  configuration: { displayId: string }
  domain: [number, number] | undefined
  scaleType: string
  // the resolved mode, never the raw `summaryScoreMode` slot: density draws
  // averages whatever the slot says, and the tooltip has to report what the
  // plot (and the track menu's radio) actually shows
  effectiveSummaryScoreMode: string
  isDensityMode: boolean
  scoreRamp: ScoreRamp | undefined
  featureUnderMouse?: WiggleFeatureUnderMouse
  setFeatureUnderMouse: (feat?: WiggleFeatureUnderMouse) => void
  selectFeature: (feat: WiggleFeatureUnderMouse) => void
}
