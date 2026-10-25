import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import {
  COVERAGE_AXIS_LABEL,
  makeScoreAxisMenuItem,
} from '@jbrowse/wiggle-core'

import type { MenuItem } from '@jbrowse/core/ui'
import type { ScoreScaleModel } from '@jbrowse/wiggle-core'

export interface CoverageMenuModel extends ScoreScaleModel {
  id: string
  showCoverage: boolean
  showCoverageAlleles: boolean
  setShowCoverageAlleles: (show: boolean) => void
  coverageMinAlleleFraction: number
  setCoverageMinAlleleFraction: (fraction: number) => void
}

// Fractions rather than a free-entry dialog: the useful settings are an order
// of magnitude apart, and 0.2 is what IGV's coverage track defaults to. A
// dialog would ask for a number nobody has a fourth digit of.
const ALLELE_FRACTION_OPTIONS = [
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
function nearestAlleleFractionOption(fraction: number) {
  return ALLELE_FRACTION_OPTIONS.reduce((best, option) =>
    Math.abs(Number(option.value) - fraction) <
    Math.abs(Number(best.value) - fraction)
      ? option
      : best,
  ).value
}

const OFF = 'off'

// Two rows for the band: its axis, in the shared drawer widget, and whether
// and above what fraction its bars color the alleles, which is about what the
// bars are colored with rather than the scale. One radio group answers both
// allele questions, since a floor means nothing with the alleles off. The
// band's on/off and interbase toggles live in each display's "Show..." menu.
//
// Both grey out with the band hidden: every setting here feeds the band's
// draw and its hit test and nothing else, and neither row could turn it back
// on, so each names that switch instead. At depth 500 every sequencing error
// paints a sliver, so without a floor the band carries a permanent rainbow.
const BAND_HIDDEN_HELP =
  'These settings scale the coverage band — turn on "Show... → Coverage" first'

export function getCoverageMenuItems(model: CoverageMenuModel): MenuItem[] {
  const disabled = !model.showCoverage
  return [
    makeScoreAxisMenuItem(model, {
      label: COVERAGE_AXIS_LABEL,
      disabled,
      disabledHelpText: BAND_HIDDEN_HELP,
    }),
    {
      label: 'Color alleles in coverage',
      disabled,
      disabledHelpText: BAND_HIDDEN_HELP,
      subMenu: radioItems(
        [{ value: OFF, label: 'Off' }, ...ALLELE_FRACTION_OPTIONS],
        model.showCoverageAlleles
          ? nearestAlleleFractionOption(model.coverageMinAlleleFraction)
          : OFF,
        v => {
          if (v === OFF) {
            model.setShowCoverageAlleles(false)
          } else {
            model.setShowCoverageAlleles(true)
            model.setCoverageMinAlleleFraction(Number(v))
          }
        },
      ),
    },
  ]
}

/**
 * The coverage band's "Insertion and clip markers" row. Every interbase mark
 * draws inside the band and its hit test reads the band's height, so with the
 * band hidden the row greys out and names that switch.
 */
export function interbaseIndicatorsMenuItem(model: {
  showCoverage: boolean
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void
}): MenuItem {
  return toggleItem(
    'Insertion and clip markers',
    model.showInterbaseIndicators,
    show => {
      model.setShowInterbaseIndicators(show)
    },
    {
      disabled: !model.showCoverage,
      disabledHelpText:
        'Interbase marks are drawn in the coverage band — turn on "Show... → Coverage" first',
    },
  )
}

/**
 * @deprecated the "Color alleles in coverage" radios in `getCoverageMenuItems`
 * carry the on/off as their first row.
 *
 * The coverage band's "Coverage alleles" row, `coverage.alleles.show`: off, the
 * depth bars draw plain grey. Greyed with the band hidden, as the interbase
 * row is.
 */
export function coverageAllelesMenuItem(model: {
  showCoverage: boolean
  showCoverageAlleles: boolean
  setShowCoverageAlleles: (show: boolean) => void
}): MenuItem {
  return toggleItem(
    'Coverage alleles',
    model.showCoverageAlleles,
    show => {
      model.setShowCoverageAlleles(show)
    },
    {
      disabled: !model.showCoverage,
      disabledHelpText:
        'Alleles are colored in the coverage band — turn on "Show... → Coverage" first',
    },
  )
}
