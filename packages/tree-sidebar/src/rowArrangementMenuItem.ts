import PaletteIcon from '@mui/icons-material/Palette'

import type { MenuItem } from '@jbrowse/core/ui'

/**
 * "Edit colors/arrangement...", the row that opens a display's `SetColorDialog`
 * wrapper — the drag-reorder, relabel and recolor grid every tree-sidebar
 * consumer shares.
 *
 * The four copies had drifted on all three of the things this row is: maf
 * called it "Edit row arrangement..." (from when its dialog reserved out the
 * color column, which it no longer does), the icon was `PaletteIcon` twice,
 * `TuneIcon` once and absent once, and only two of them said why the row was
 * disabled while the rows were still loading.
 *
 * `ready` is "has the row list arrived": the dialog over an empty list can only
 * report the same thing after the user clicks, so the row disables and says so.
 * The dialog itself stays per display — each wraps `SetColorDialog` with its own
 * title and columns — so the opener is passed in.
 */
export function rowArrangementMenuItem({
  ready,
  onOpen,
}: {
  ready: boolean
  onOpen: () => void
}): MenuItem {
  return {
    label: 'Edit colors/arrangement...',
    icon: PaletteIcon,
    disabled: !ready,
    disabledHelpText: 'Loading rows...',
    onClick: onOpen,
  }
}
