import { radioItems } from '@jbrowse/core/ui/menuItems'
import { makeScoreSubMenu } from '@jbrowse/wiggle-core'

import type { ScoreScaleModel } from '@jbrowse/wiggle-core'

interface CoverageModel extends ScoreScaleModel {
  numStdDev: number
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

// Single "Coverage" submenu: scale type, autoscale, min/max range dialog, and
// the band's allele-fraction floor. The coverage band exposes the canonical
// ScoreScaleModel shape, so this is the shared wiggle-core Score submenu
// relabelled "Coverage" with a reduced, dynamic-σ autoscale list — no adapter
// shim needed. The on/off toggle lives in the "Show..." menu (see reads.ts)
// rather than being duplicated here.
//
// Which is why the whole submenu greys out with the band hidden. Every setting
// in it feeds the band's draw and its hit test and nothing else, so with
// `showCoverage` off this is four live controls over a band that isn't there —
// and unlike the sashimi and read-connection menus, which lead with their own
// visibility toggle, there is nothing in here that could turn it back on. The
// gate names that switch instead. Safe to grey because no row inside carries a
// pin: a disabled row's pin is disabled with it (`menuItemAdornment`).
export function getCoverageMenuItem(model: CoverageModel) {
  const sigma = model.numStdDev
  return makeScoreSubMenu(model, {
    label: 'Coverage',
    disabled: !model.showCoverage,
    disabledHelpText:
      'These settings scale the coverage band — turn on "Show coverage" first',
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
          nearestSnpFrequencyOption(model.coverageSnpMinFrequency),
          v => {
            model.setCoverageSnpMinFrequency(Number(v))
          },
        ),
      },
    ],
  })
}
