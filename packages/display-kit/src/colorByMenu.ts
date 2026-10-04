import { makeRadioSubMenu, withSubHeader } from '@jbrowse/core/ui/menuItems'
import { capitalizeFirst } from '@jbrowse/core/util'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import PaletteIcon from '@mui/icons-material/Palette'

import type { MenuItem, SubMenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

const COLOR_SCHEME_OPTIONS = COLOR_SCHEMES.map(
  scheme => [scheme, capitalizeFirst(scheme)] as const,
)

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

/**
 * A ramp's Color scheme submenu: a radio per named scheme with the painted one
 * ticked, then `extraItems`, the rows that adjust that ramp.
 */
export function colorSchemeMenuItem(
  self: {
    colorScheme: ColorSchemeName
    setColorScheme: (scheme: ColorSchemeName) => void
  },
  extraItems?: MenuItem[],
): MenuItem {
  return makeRadioSubMenu({
    label: 'Color scheme',
    icon: PaletteIcon,
    value: self.colorScheme,
    onChange: scheme => {
      self.setColorScheme(scheme)
    },
    options: COLOR_SCHEME_OPTIONS,
    extraItems,
  })
}
