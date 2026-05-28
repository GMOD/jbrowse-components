import { type ScoreScaleModel, makeScoreSubMenu } from '@jbrowse/wiggle-core'

interface CoverageModel extends ScoreScaleModel {
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
  numStdDev: number
  showYScalebar: boolean
  setShowYScalebar: (show: boolean) => void
}

// Single "Coverage" submenu: on/off, scale type, autoscale, min/max range
// dialog, and Y-axis labels toggle. The coverage band exposes the canonical
// ScoreScaleModel shape, so this is the shared wiggle-core Score submenu
// relabelled "Coverage" — with the on/off + Y-axis toggles prepended and a
// reduced, dynamic-σ autoscale list. No adapter shim needed.
export function getCoverageMenuItem(model: CoverageModel) {
  const sigma = model.numStdDev
  return makeScoreSubMenu(model, {
    label: 'Coverage',
    autoscaleOptions: [
      ['local', 'Local'],
      ['localsd', `Local ± ${sigma}σ`],
    ],
    leadingItems: [
      {
        label: 'Show coverage',
        type: 'checkbox' as const,
        checked: model.showCoverage,
        onClick: () => {
          model.setShowCoverage(!model.showCoverage)
        },
      },
      {
        label: 'Show Y-axis labels',
        type: 'checkbox' as const,
        checked: model.showYScalebar,
        onClick: () => {
          model.setShowYScalebar(!model.showYScalebar)
        },
      },
    ],
  })
}
