import { withSubHeader } from '@jbrowse/core/ui/menuItems'
import PaletteIcon from '@mui/icons-material/Palette'

import type { MenuItem, SubMenuItem } from '@jbrowse/core/ui'

/**
 * One colour object's block of a Color by menu: the rows picking what it
 * paints, exactly one ticked. `header` names the block where the menu holds
 * more than one.
 */
export interface ColorByBlock {
  header?: string
  rows: MenuItem[]
}

/**
 * A track's Color by menu, laid out as the alignments display's: each colour
 * object's block in turn, then under "Additional coloring" the rows that
 * adjust the colouring without picking what paints.
 */
export function colorByMenuItem({
  blocks,
  additional = [],
}: {
  blocks: ColorByBlock[]
  additional?: MenuItem[]
}): SubMenuItem & { type: 'subMenu'; subMenu: MenuItem[] } {
  return {
    label: 'Color by...',
    type: 'subMenu',
    icon: PaletteIcon,
    subMenu: [
      ...blocks.flatMap(({ header, rows }) =>
        header === undefined ? rows : withSubHeader(header, rows),
      ),
      ...withSubHeader('Additional coloring', additional),
    ],
  }
}

/**
 * The fill block's constant colour, ticked while it paints, so the block's
 * tick always names what paints.
 */
export function solidColorItem(checked: boolean, onClick: () => void) {
  return {
    label: 'Solid color...',
    type: 'radio' as const,
    checked,
    keepMenuOpen: false,
    onClick,
  }
}
