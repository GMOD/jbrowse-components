import { makeScoreSubMenu } from '@jbrowse/wiggle-core'

import type { ScoreScaleModel } from '@jbrowse/wiggle-core'

interface CoverageModel extends ScoreScaleModel {
  numStdDev: number
}

// Single "Coverage" submenu: scale type, autoscale, and min/max range dialog.
// The coverage band exposes the canonical ScoreScaleModel shape, so this is the
// shared wiggle-core Score submenu relabelled "Coverage" with a reduced,
// dynamic-σ autoscale list — no adapter shim needed. The on/off toggle lives in
// the "Show..." menu (see reads.ts) rather than being duplicated here.
export function getCoverageMenuItem(model: CoverageModel) {
  const sigma = model.numStdDev
  return makeScoreSubMenu(model, {
    label: 'Coverage',
    autoscaleOptions: [
      ['local', 'Local'],
      ['localsd', `Local ± ${sigma}σ`],
    ],
  })
}
