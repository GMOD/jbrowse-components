import { radioItems } from '@jbrowse/core/ui/menuItems'

import { getHeightModeOptions } from './heightMode.ts'

import type { HeightMode } from './heightMode.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The minimal display surface the overflow radio group drives: the resolved
// mode (for the radio's `checked`) and the setter (for `onClick`).
export interface HeightModeMenuModel {
  heightMode: HeightMode
  setHeightMode: (mode: HeightMode) => void
}

// The overflow radio group (scroll/grow/fit) for a display whose size presets
// and overflow policy are independent, as the feature display's are: its fit
// starts from the chosen preset and gives up labels before boxes. The caller
// renders these under a "When features overflow" subheader inside its size
// menu. Alignments' fit replaces the read height, so it is a Read height radio
// there instead.
export function heightModeMenuItems(model: HeightModeMenuModel): MenuItem[] {
  // The rows keep the menu open, like every other radio that only writes a
  // setting (`radioItems` states nothing, so `CascadingMenu` decides by type).
  // These render directly below the size presets, which already stay open, so
  // dismissing here made one submenu behave two ways.
  return radioItems(getHeightModeOptions(), model.heightMode, mode => {
    model.setHeightMode(mode)
  })
}
