import { radioItems } from '@jbrowse/core/ui/menuItems'
import {
  COVERAGE_AXIS_LABEL,
  makeScoreAxisMenuItem,
} from '@jbrowse/wiggle-core'

import type { MenuItem } from '@jbrowse/core/ui'
import type { ScoreScaleModel } from '@jbrowse/wiggle-core'

interface CoverageModel extends ScoreScaleModel {
  id: string
  showCoverage: boolean
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

// Which row reads as selected for a fraction that is none of the five. The slot
// is a plain number a config can declare, so 0.15 used to tick nothing and the
// group reported "no floor set" over a floor that was in effect. Nearest wins,
// ties to the lower since the list is ascending; the click still writes the
// row's own exact value, so opening the menu never silently rounds the setting.
function nearestSnpFrequencyOption(fraction: number) {
  return SNP_FREQUENCY_OPTIONS.reduce((best, option) =>
    Math.abs(Number(option.value) - fraction) <
    Math.abs(Number(best.value) - fraction)
      ? option
      : best,
  ).value
}

// Two rows for the band: its axis, in the shared drawer widget, and its
// allele-fraction floor, which is about what the bars are coloured with
// rather than the scale. The on/off toggle lives in the "Show..." menu (see
// reads.ts).
//
// Both grey out with the band hidden: every setting here feeds the band's
// draw and its hit test and nothing else, and neither row could turn it back
// on, so each names that switch instead. At depth 500 every sequencing error
// paints a sliver, so without a floor the band carries a permanent rainbow.
const BAND_HIDDEN_HELP =
  'These settings scale the coverage band — turn on "Show coverage" first'

export function getCoverageMenuItems(model: CoverageModel): MenuItem[] {
  const disabled = !model.showCoverage
  return [
    makeScoreAxisMenuItem(model, {
      label: COVERAGE_AXIS_LABEL,
      disabled,
      disabledHelpText: BAND_HIDDEN_HELP,
    }),
    {
      label: 'Color SNPs above...',
      disabled,
      disabledHelpText: BAND_HIDDEN_HELP,
      subMenu: radioItems(
        SNP_FREQUENCY_OPTIONS,
        nearestSnpFrequencyOption(model.coverageSnpMinFrequency),
        v => {
          model.setCoverageSnpMinFrequency(Number(v))
        },
      ),
    },
  ]
}
