import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import HeightIcon from '@mui/icons-material/Height'

import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowHeightDialog = lazy(() => import('./SetRowHeightDialog.tsx'))

/**
 * The row-height contract from agent-docs/reference/ROW_HEIGHT_AND_FIT.md, as
 * the menu and the dialog see it. `rowHeight` is the RAW setting — `0` is the
 * fit-to-display-height sentinel — never the resolved `effectiveRowHeight`,
 * which is what the radios have to compare against and what the dialog has to
 * seed from.
 *
 * `rowProportion` is optional and only maf answers it: its glyphs occupy a
 * fraction of the row band, and each of its presets pairs a height with the
 * proportion that reads best at it.
 */
export interface RowHeightModel extends IStateTreeNode {
  rowHeight: number
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
  rowProportion?: number
  setRowProportion?: (n: number) => void
}

/**
 * A named px height, optionally with the glyph proportion that reads best at
 * it. Presets are a display's own vocabulary (maf's Normal is 15px, the
 * multi-row painting's is 14) so the table is passed in; what is shared is that
 * they are radios in one group with fit and custom, because `rowHeight` is a
 * single coupled axis rather than two independent settings.
 */
export interface RowHeightPreset {
  label: string
  rowHeight: number
  rowProportion?: number
}

/**
 * The "Row height" submenu: "Squeeze to fit view", the display's presets, and
 * "Custom...". One builder for maf, the multi-row feature painting and both
 * multi-sample variant displays, which had three copies of it and three copies
 * of its dialog.
 *
 * The copies had already drifted in the way a shared builder exists to stop:
 * variants offered no presets at all, and its dialog seeded from
 * `effectiveRowHeight` — the exact trap the other two dialogs carry comments
 * warning against — so opening "Custom..." in fit mode and pressing submit
 * fixed the rows at the computed fractional height.
 *
 * A display with no presets gets fit + Custom, which is what variants shows
 * today; passing a table adds the middle radios.
 */
export function rowHeightMenuItem(
  model: RowHeightModel,
  presets: readonly RowHeightPreset[] = [],
): MenuItem {
  const { rowHeight } = model
  const isFit = rowHeight === 0
  const matchesPreset = (preset: RowHeightPreset) =>
    rowHeight === preset.rowHeight
  return {
    label: 'Row height',
    icon: HeightIcon,
    type: 'subMenu',
    subMenu: [
      {
        label: 'Squeeze to fit view',
        type: 'radio',
        checked: isFit,
        onClick: () => {
          model.setFitToHeight()
        },
      },
      ...presets.map(preset => ({
        label: preset.label,
        type: 'radio' as const,
        checked: !isFit && matchesPreset(preset),
        onClick: () => {
          model.setRowHeight(preset.rowHeight)
          if (preset.rowProportion !== undefined) {
            model.setRowProportion?.(preset.rowProportion)
          }
        },
      })),
      {
        label: 'Custom...',
        type: 'radio',
        // the leftover of the group: a hand-entered height is whatever is
        // neither the fit sentinel nor one of the presets
        checked: !isFit && !presets.some(matchesPreset),
        // a dialog opener, so it opts out of the checkbox/radio keep-open
        // default
        keepMenuOpen: false,
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetRowHeightDialog,
            { model, handleClose },
          ])
        },
      },
    ],
  }
}
