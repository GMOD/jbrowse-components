import { type ScoreScaleModel, makeScoreSubMenu } from '@jbrowse/wiggle-core'

interface CoverageModel extends ScoreScaleModel {
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
  numStdDev: number
}

// Single "Coverage" submenu: on/off, scale type, autoscale, and min/max range
// dialog. The coverage band exposes the canonical ScoreScaleModel shape, so
// this is the shared wiggle-core Score submenu relabelled "Coverage" — with the
// on/off toggle prepended and a reduced, dynamic-σ autoscale list. No adapter
// shim needed.
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
    ],
  })
}
