import { radioItems } from '@jbrowse/core/ui/menuItems'
import { makeScoreSubMenu } from '@jbrowse/wiggle-core'

import type { ScoreScaleModel } from '@jbrowse/wiggle-core'

interface CoverageModel extends ScoreScaleModel {
  numStdDev: number
  coverageSnpMinFrequency: number
  setCoverageSnpMinFrequency: (fraction: number) => void
}

// Fractions rather than a free-entry dialog: the useful settings are an order
// of magnitude apart, and 0.2 is what IGV's coverage track defaults to. A
// dialog would ask for a number nobody has a fourth digit of.
const SNP_FREQUENCY_OPTIONS = [
  { value: '0', label: 'All mismatches' },
  { value: '0.01', label: 'Above 1%' },
  { value: '0.05', label: 'Above 5%' },
  { value: '0.1', label: 'Above 10%' },
  { value: '0.2', label: 'Above 20%' },
]

// Single "Coverage" submenu: scale type, autoscale, min/max range dialog, and
// the band's allele-fraction floor. The coverage band exposes the canonical
// ScoreScaleModel shape, so this is the shared wiggle-core Score submenu
// relabelled "Coverage" with a reduced, dynamic-σ autoscale list — no adapter
// shim needed. The on/off toggle lives in the "Show..." menu (see reads.ts)
// rather than being duplicated here.
export function getCoverageMenuItem(model: CoverageModel) {
  const sigma = model.numStdDev
  return makeScoreSubMenu(model, {
    label: 'Coverage',
    autoscaleOptions: [
      ['local', 'Local'],
      ['localsd', `Local ± ${sigma}σ`],
    ],
    // After the range controls, not before: this is about what the bars are
    // coloured with, and reads as a footnote to the scale rather than a peer of
    // it. At depth 500 every sequencing error paints a sliver, so without a
    // floor the band carries a permanent rainbow — the pileup fades those
    // through `featureFrequencyThreshold` and the band applied nothing.
    trailingItems: [
      {
        label: 'Color SNPs above...',
        subMenu: radioItems(
          SNP_FREQUENCY_OPTIONS,
          String(model.coverageSnpMinFrequency),
          v => {
            model.setCoverageSnpMinFrequency(Number(v))
          },
        ),
      },
    ],
  })
}
