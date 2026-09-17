import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import {
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
  lodMenuItems,
} from '@jbrowse/synteny-core'
import WarningIcon from '@mui/icons-material/WarningAmber'

import { CIGAR_MODE_OPTIONS } from '../cigarModes.ts'
import { DEFAULT_ALPHA, DEFAULT_MIN_ALIGNMENT_LENGTH } from '../consts.ts'

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
    toggleItem(
      'Identity fade',
      model.opacityByIdentity,
      v => {
        model.setOpacityByIdentity(v)
      },
      {
        helpText:
          'Fade each ribbon by its sequence identity, whatever the color mode.',
      },
    ),
    toggleItem('Curved lines', model.drawCurves, v => {
      model.setDrawCurves(v)
    }),
    toggleItem(
      'Location markers',
      model.drawLocationMarkers,
      v => {
        model.setDrawLocationMarkers(v)
      },
      {
        helpText:
          "Carry the upper row's scalebar ticks down through the ribbons to the coordinates they pair with.",
      },
    ),
    toggleItem(
      'Off-screen mates',
      model.showOffscreenMates,
      v => {
        model.setShowOffscreenMates(v)
      },
      {
        helpText:
          'Mark alignments whose other end is off screen or on a contig the facing panel is not showing. Costs a second query per panel pair on an indexed file.',
      },
    ),
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
    makeSizeSubMenu({
      label: 'opacity',
      title: 'Opacity',
      help: 'Lower lets overlapping ribbons show through each other.',
      min: 0,
      max: 1,
      step: 0.01,
      scale: 'cubic',
      format: n => n.toFixed(3),
      getValue: () => model.alpha,
      isDefault: model.alpha === DEFAULT_ALPHA,
      onChange: v => {
        model.setAlpha(v)
      },
      onReset: () => {
        model.setAlpha(DEFAULT_ALPHA)
      },
    }),
    makeSizeSubMenu({
      label: 'min length',
      title: 'Min length',
      help: MIN_LENGTH_HELP,
      min: DEFAULT_MIN_ALIGNMENT_LENGTH,
      max: MAX_MIN_LENGTH_BP,
      step: 1,
      scale: 'log',
      format: n => `${toLocale(n)}bp`,
      commitOnRelease: true,
      getValue: () => model.minAlignmentLength,
      isDefault: model.minAlignmentLength === DEFAULT_MIN_ALIGNMENT_LENGTH,
      onChange: bp => {
        model.setMinAlignmentLength(bp)
      },
      onReset: () => {
        model.setMinAlignmentLength(DEFAULT_MIN_ALIGNMENT_LENGTH)
      },
    }),
  ] satisfies MenuItem[]
}
