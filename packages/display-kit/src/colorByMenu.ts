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
 * One color object's block of a Color by menu: the rows picking what it
 * paints, exactly one ticked. `header` names the block where the menu holds
 * more than one.
 */
export interface ColorByBlock {
  header?: string
  rows: MenuItem[]
}

/**
 * A track's Color by menu, laid out as the alignments display's: each color
 * object's block in turn, then under "Additional coloring" the rows that
 * adjust the coloring without picking what paints.
 */
export function colorByMenuItem({
  blocks,
  additional = [],
}: {
  blocks: ColorByBlock[]
  additional?: MenuItem[]
}): SubMenuItem & { type: 'subMenu'; subMenu: MenuItem[] } {
  return {
    label: 'Color by',
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
 * The fill block's constant color, ticked while it paints, so the block's
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
 * A row a Color by menu offers by name, ticked while it paints: a `field` to
 * paint by, or an `onClick` writing a color object no field names.
 */
export type ColorPreset = { label: string; checked: boolean } & (
  | { field: string }
  | { onClick: () => void }
)

/**
 * A feature display's fill block: Default, a radio per preset field, a field
 * picked in a dialog where the display has one, and Solid color. Picking a
 * preset shows its key.
 */
export function colorFieldRows(
  self: {
    colorByMode: 'default' | 'solid' | 'attribute' | (string & {})
    pickDefaultColor: () => void
    pickSolidColor: () => void
    openColorByAttributeDialog?: () => void
    colorFieldNoun?: string
    colorByField: (field: string) => void
    setShowLegend: (show: boolean) => void
  },
  presets: ColorPreset[],
): MenuItem[] {
  const presetPaints = presets.some(p => p.checked)
  const { openColorByAttributeDialog, colorFieldNoun = 'attribute' } = self
  return [
    {
      label: 'Default',
      type: 'radio',
      checked: self.colorByMode === 'default' && !presetPaints,
      onClick: () => {
        self.pickDefaultColor()
      },
    },
    ...presets.map((preset): MenuItem => ({
      label: preset.label,
      type: 'radio',
      checked: preset.checked,
      onClick:
        'field' in preset
          ? () => {
              self.setShowLegend(true)
              self.colorByField(preset.field)
            }
          : preset.onClick,
    })),
    ...(openColorByAttributeDialog
      ? [
          {
            label: `${capitalizeFirst(colorFieldNoun)}...`,
            type: 'radio' as const,
            checked: self.colorByMode === 'attribute' && !presetPaints,
            keepMenuOpen: false,
            onClick: () => {
              openColorByAttributeDialog()
            },
          },
        ]
      : []),
    solidColorItem(self.colorByMode === 'solid', () => {
      self.pickSolidColor()
    }),
  ]
}

/**
 * A ramp's Color scheme submenu: a radio per named scheme with the painted one
 * ticked, none where the ramp is not a named scheme, then `extraItems`, the
 * rows that adjust that ramp.
 */
export function colorSchemeMenuItem(
  self: {
    colorScheme: ColorSchemeName | undefined
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
