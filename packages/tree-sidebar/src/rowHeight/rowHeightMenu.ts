import { lazy } from 'react'

import { getDialogHost } from '@jbrowse/core/util'
import { FIT_ROWS } from '@jbrowse/core/util/resolveRowHeight'
import HeightIcon from '@mui/icons-material/Height'

import type { MenuItem } from '@jbrowse/core/ui'
import type { RowStep } from '@jbrowse/core/util/resolveRowHeight'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowHeightDialog = lazy(() => import('./SetRowHeightDialog.tsx'))

/**
 * The row-height contract from agent-docs/reference/ROW_HEIGHT_AND_FIT.md, as
 * the menu and the dialog see it. `rowStep` is the setting, a px height or
 * `"fit"`, never the resolved `effectiveRowHeight`: the radios compare
 * against it and the dialog seeds from it.
 *
 * `rowProportion` is optional: a display whose glyphs fill a fraction of the
 * row band answers it, and `undefined` or absent asks the dialog for none.
 */
export interface RowHeightModel extends IStateTreeNode {
  rowStep: RowStep
  setRowHeight: (px: number) => void
  setFitToHeight: () => void
  rowProportion?: number
  setRowProportion?: (n: number) => void
}

/**
 * A named px height, optionally with the glyph proportion that reads best at
 * it. Presets are a display's own vocabulary (the multi-row painting's Normal
 * is 14px) so the table is passed in; what is shared is that
 * they are radios in one group with fit and custom, because `rows.step` is a
 * single coupled axis rather than two independent settings.
 */
export interface RowHeightPreset {
  label: string
  rowHeight: number
  rowProportion?: number
}

/**
 * The "Row height" submenu: "Fit to track height", the display's presets, and
 * "Custom...". One builder for the multi-row feature painting and the
 * variant display's two layouts, which with MAF's (since removed) had three
 * copies of it and three copies of its dialog.
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
  const { rowStep } = model
  const isFit = rowStep === FIT_ROWS
  const matchesPreset = (preset: RowHeightPreset) =>
    rowStep === preset.rowHeight
  return {
    label: 'Row height',
    icon: HeightIcon,
    type: 'subMenu',
    subMenu: [
      {
        label: 'Fit to track height',
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
        // neither fit nor one of the presets
        checked: !isFit && !presets.some(matchesPreset),
        // a dialog opener, so it opts out of the checkbox/radio keep-open
        // default
        keepMenuOpen: false,
        onClick: () => {
          getDialogHost(model).queueDialog(handleClose => [
            SetRowHeightDialog,
            { model, handleClose },
          ])
        },
      },
    ],
  }
}
