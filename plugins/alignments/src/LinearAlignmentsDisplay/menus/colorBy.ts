import { lazy } from 'react'

import {
  promotableRadioItem,
  radioItems,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { ARC_COLOR_OPTIONS } from '../../shared/arcColorOptions.ts'
import { radioColorOptions } from '../../shared/colorSchemes.ts'
import { bisulfiteItem } from './bisulfiteMenu.ts'
import { modificationsMenu } from './modificationsMenu.ts'

import type { ColorOption } from '../../shared/colorSchemes.ts'
import type { ArcColorByType, ColorBy } from '../../shared/types.ts'
import type { ModificationsMenuModel } from './modificationsMenu.ts'
import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

const ColorByTagDialog = lazy(() => import('../dialogs/ColorByTagDialog.tsx'))

interface ColorByModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

// The MM/ML submenu's own surface plus the two readiness flags that decide
// whether it is built at all — read here, in `modificationsItems`, and nowhere
// below.
export interface ModificationsModel extends ModificationsMenuModel {
  modificationsReady: boolean
  regionTooLarge: boolean
}

// A model that may or may not carry the modification fields.
type AnyColorByModel = ColorByModel & Partial<ModificationsModel>

// The modification fields always travel together, so one probe narrows the whole
// group. Only a type guard for callers whose model genuinely lacks them —
// whether a section is *offered* is the caller's explicit opt-in below, never
// inferred from the model's shape. LGVSyntenyDisplay composes the alignments
// state model, so it carries every field a probe could test; sniffing gave it
// the paired-end and bisulfite sections even though a PAF block has no pairs and
// no reads to bisulfite-convert.
function modModel(model: AnyColorByModel): ModificationsModel | undefined {
  return model.modificationsReady === undefined
    ? undefined
    : (model as ModificationsModel)
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
  // Insert size / pair orientation / first-of-pair — meaningful only where reads
  // come in pairs.
  includePairedEnd?: boolean
  // The MM/ML modification submenu plus reference-based bisulfite.
  includeModifications?: boolean
  colorOptions?: ColorOption[]
  // Read-connection arc coloring lives here rather than in the Read connections
  // menu — it's a rare setting and colors belong together. Omitted (like every
  // other section here) when no overlay (arcs or read cloud) is active, since
  // both share this coloring — the caller passes `undefined` in that case.
  arcColor?: {
    current: ArcColorByType
    setColor: (type: ArcColorByType) => void
  }
  // Supplementary/split-read coloring modifiers. These color how chained
  // supplementary alignments are drawn, so they belong with the color scheme
  // rather than in the "Show..." visibility menu. Both are read only by
  // `readColorCategory`'s chain branches, hence `isChainMode`: without a chain
  // there is nothing chained to recolor and each row would be a live tickbox
  // that does nothing.
  supplementaryColoring?: {
    isChainMode: boolean
    flipStrandLongReadChains: boolean
    setFlipStrandLongReadChains: (flag: boolean) => void
    colorSupplementaryChains: boolean
    setColorSupplementaryChains: (flag: boolean) => void
  }
  // Per-value session-default pins — supplied only for displays whose colorBy
  // slot is promotable (alignments; synteny omits it). Given a colorBy value,
  // returns the pin control for making that exact scheme the session-wide
  // default, so each scheme radio carries its own pin (like every other
  // promotable setting) instead of a standalone mouthful checkbox.
  pin?: (colorBy: ColorBy) => Pin
}

// Derived from the shared COLOR_SCHEMES registry (single source of menu
// placement + shader path), in registry order so the menu is unchanged.
const basicColorOptions = radioColorOptions('basic')
const pairedEndColorOptions = radioColorOptions('pairedEnd')

// --- menu sections ----------------------------------------------------------
//
// Each builder returns its item(s) and nothing else — whether a section is
// OFFERED is decided once, visibly, in the `subMenu` list at the bottom. The
// builders used to take the caller's `include` flag and the pin factory as
// extra parameters, which spread one caller decision across six signatures and
// hid the opt-in list the file's comments keep describing.

// A plain radio that selects a whole color scheme (no extra config). When the
// display is promotable, each row also carries its own pin (endAdornment) that
// makes that exact scheme the session-wide default for this display type.
function colorRadio(
  model: AnyColorByModel,
  { label, type }: ColorOption,
  pin: ColorByMenuOptions['pin'],
): MenuItem {
  return promotableRadioItem({
    label,
    checked: model.colorBy.type === type,
    onClick: () => {
      model.setColorScheme({ type })
    },
    pin: pin?.({ type }),
  })
}

// Names the tag in the label once one is picked ("Tag (HP)...") — the radio is
// the only scheme whose choice has a parameter, and it was previously invisible
// without reopening the dialog. Carries the same session-default pin as the
// plain radios, pinning the tag actually in use.
function tagItem(
  model: AnyColorByModel,
  pin: ColorByMenuOptions['pin'],
): MenuItem {
  const { colorBy } = model
  const active = colorBy.type === 'tag' && colorBy.tag !== undefined
  return promotableRadioItem({
    label: active ? `Tag (${colorBy.tag})...` : 'Tag...',
    checked: colorBy.type === 'tag',
    // the only promotable row whose click opens a dialog rather than writing a
    // value, so it dismisses the menu instead of the builder's default of
    // staying open
    keepMenuOpen: false,
    onClick: () => {
      getSession(model).queueDialog((onClose: () => void) => [
        ColorByTagDialog,
        { model, handleClose: onClose },
      ])
    },
    pin: active ? pin?.({ type: 'tag', tag: colorBy.tag }) : undefined,
  })
}

// Plain scheme radios in a submenu — nothing here reads a modification field, so
// it takes the bare model. Threading the `modModel` probe through it instead
// silently dropped the whole section for a caller that opted in but carries no
// modification state.
function pairedEndItem(
  model: AnyColorByModel,
  pin: ColorByMenuOptions['pin'],
): MenuItem {
  return {
    label: 'Paired end',
    subMenu: pairedEndColorOptions.map(o => colorRadio(model, o, pin)),
  }
}

// The MM/ML "Modifications" submenu shows while types are still loading (unless
// the region is too large to ever detect them) or once any type has loaded; a
// ready display with zero detected types falls through to bisulfite only.
// Bisulfite is reference-based, so it applies to any alignments display
// regardless of MM/ML tags.
//
// It also shows whenever it is the ACTIVE scheme, whatever detection returned.
// Detection is per-fetch volatile state, so a track colored by modifications —
// from a saved session, a config, or a session-wide default — that lands on a
// region whose reads carry no MM/ML calls otherwise dropped the only row that
// could read as checked, leaving every radio in Color by... blank and no way
// back to the modification settings without first navigating elsewhere.
function modificationsItems(
  model: ModificationsModel,
  pin: ColorByMenuOptions['pin'],
): MenuItem[] {
  const detecting = !model.modificationsReady && !model.regionTooLarge
  const active = model.colorBy.type === 'modifications'
  const detected =
    model.modificationsReady && model.detectedModificationTypes.length > 0
  return [
    ...(active || detected ? [modificationsMenu(model, pin)] : []),
    ...(detecting
      ? [{ label: 'Loading modifications...', disabled: true, onClick() {} }]
      : []),
    bisulfiteItem(model),
  ]
}

function arcColorItem(
  arcColor: NonNullable<ColorByMenuOptions['arcColor']>,
): MenuItem {
  return {
    label: 'Arc color',
    type: 'subMenu',
    helpText:
      'How paired-end arcs and the read cloud overlay are colored by insert size and/or pair orientation, to surface structural-variant signal (deletions, inversions, duplications, insertions).',
    subMenu: radioItems(ARC_COLOR_OPTIONS, arcColor.current, arcColor.setColor),
  }
}

// Both rows recolor a chain that carries a supplementary segment, and orange
// wins where they overlap (see readColorCategory's ladder). Each subLabel says
// which reads it reaches and what the result looks like, because "supplementary"
// alone doesn't distinguish them and the difference is the whole choice. Greyed
// out rather than hidden while chain mode is off, matching the read-connection
// band options: the settings stay discoverable, and the tooltip names the one
// switch that makes them live.
function supplementaryItem(
  supp: NonNullable<ColorByMenuOptions['supplementaryColoring']>,
): MenuItem {
  return {
    label: 'Supplementary / split reads',
    disabled: !supp.isChainMode,
    disabledHelpText:
      'Enable "Read connections ▸ View as pairs / link supplementary alignments" first',
    subMenu: [
      toggleItem(
        'Color supplementary alignments by consensus strand',
        supp.flipStrandLongReadChains,
        supp.setFlipStrandLongReadChains,
        {
          subLabel:
            'long (unpaired) reads: segments agreeing with the orientation most reads on screen share stay red and the ones inverted at a junction go blue, so an inversion reads as a color flip',
        },
      ),
      toggleItem(
        'Color supplementary chains orange',
        supp.colorSupplementaryChains,
        supp.setColorSupplementaryChains,
        {
          subLabel:
            'one flat color for the whole chain, paired and long reads alike — marks the split without classifying it, so it replaces both the strand flip and the inversion/deletion hues',
        },
      ),
    ],
  }
}

export function getColorByMenuItem(
  model: AnyColorByModel,
  options: ColorByMenuOptions = {},
) {
  const {
    colorOptions = basicColorOptions,
    includeTagOption,
    includePairedEnd,
    includeModifications,
    arcColor,
    supplementaryColoring,
    pin,
  } = options
  const mods = includeModifications ? modModel(model) : undefined
  // Everything above the header picks the read fill scheme — the radios and the
  // Paired end / Modifications / Bisulfite submenus alike. Everything below
  // refines coloring without selecting a scheme: the arcs and read cloud have
  // their own axis, and the supplementary modifiers ride whatever scheme is
  // chosen. The two kinds are indistinguishable otherwise — both render as a
  // submenu arrow — so one header carries the whole distinction. Absent when
  // neither refinement is offered, so a curated menu (synteny) stays a plain
  // radio list.
  const refinements = [
    ...(arcColor ? [arcColorItem(arcColor)] : []),
    ...(supplementaryColoring
      ? [supplementaryItem(supplementaryColoring)]
      : []),
  ]
  return {
    label: 'Color by...',
    type: 'subMenu' as const,
    icon: Palette,
    subMenu: [
      ...colorOptions.map(o => colorRadio(model, o, pin)),
      ...(includeTagOption ? [tagItem(model, pin)] : []),
      ...(includePairedEnd ? [pairedEndItem(model, pin)] : []),
      ...(mods ? modificationsItems(mods, pin) : []),
      ...(refinements.length
        ? [
            { type: 'subHeader' as const, label: 'Additional coloring' },
            ...refinements,
          ]
        : []),
    ] satisfies MenuItem[],
  }
}
