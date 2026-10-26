import { toggleItem } from '@jbrowse/core/ui/menuItems'
import {
  identityFadeMenuItem,
  lodMenuItems,
  minIdentityMenuItem,
  minLengthMenuItem,
  opacityMenuItem,
} from '@jbrowse/synteny-core'
import WarningIcon from '@mui/icons-material/WarningAmber'

import { CIGAR_MODE_OPTIONS } from '../cigarModes.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

/**
 * Every setting that decides what the ribbons look like and how much detail
 * feeds them. The header menu answers what the view IS; this one answers what
 * it LOOKS LIKE.
 *
 * Grouped by row shape, not by subject: the checkboxes, then the submenus
 * (choices before values). Subject sections mixed the two shapes in
 * each section, so the eye had to switch between flipping and opening on
 * every other row. The dotplot's settings menu uses the same order.
 *
 * CIGAR indels and Level of detail are absent rather than disabled when the
 * data has nothing to switch between.
 */
export function syntenySettingsMenuItems(
  model: LinearSyntenyViewModel,
): MenuItem[] {
  const { cigarMode, hasCigarData } = model
  return [
    identityFadeMenuItem(model),
    toggleItem('Curved lines', model.interpolate === 'bump', v => {
      model.setInterpolate(v ? 'bump' : 'linear')
    }),
    toggleItem(
      'Location markers',
      model.axisGrid,
      v => {
        model.setAxisGrid(v)
      },
      {
        helpText:
          "Carry the upper row's scalebar ticks down through the ribbons to the coordinates they pair with.",
      },
    ),
    toggleItem(
      'Off-screen mates',
      model.offscreenDrawn,
      v => {
        model.setOffscreenDrawn(v)
      },
      {
        helpText:
          'Mark alignments whose other end is off screen or on a contig the facing panel is not showing. Costs a second query per panel pair on an indexed file.',
      },
    ),
    ...(model.hasLegendKey
      ? [
          toggleItem('Show legend', model.showLegend, v => {
            model.setLegendShow(v)
          }),
        ]
      : []),
    ...(hasCigarData
      ? [
          {
            label: 'CIGAR indels',
            helpText:
              'How insertions and deletions inside an alignment are drawn.',
            subMenu: CIGAR_MODE_OPTIONS.map(({ value, label, ...rest }) => ({
              label,
              ...rest,
              icon: value === 'off' ? WarningIcon : undefined,
              type: 'radio' as const,
              checked: cigarMode === value,
              onClick: () => {
                model.setCigarMode(value)
              },
            })),
          },
        ]
      : []),
    ...lodMenuItems(model),
    opacityMenuItem(model),
    minLengthMenuItem(model),
    minIdentityMenuItem(model),
  ] satisfies MenuItem[]
}
