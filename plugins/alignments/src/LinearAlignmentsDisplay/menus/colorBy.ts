import { lazy } from 'react'

import { checkboxItem, promotableRadioItem, radioItems } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { radioColorOptions } from '../../shared/colorSchemes.ts'
import { bisulfiteItem } from './bisulfiteMenu.ts'
import { modificationsMenu } from './modificationsMenu.ts'

import type { ColorOption } from '../../shared/colorSchemes.ts'
import type { ArcColorByType, ColorBy } from '../../shared/types.ts'
import type { ModificationsMenuModel } from './modificationsMenu.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
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
  // rather than in the "Show..." visibility menu.
  supplementaryColoring?: {
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
  displayTypeDefault?: (colorBy: ColorBy) => DisplayTypeDefaultControl
}

// Derived from the shared COLOR_SCHEMES registry (single source of menu
// placement + shader path), in registry order so the menu is unchanged.
const basicColorOptions = radioColorOptions('basic')
const pairedEndColorOptions = radioColorOptions('pairedEnd')

const arcColorOptions: {
  value: ArcColorByType
  label: string
  subLabel?: string
  helpText?: string
}[] = [
  {
    value: 'insertSizeAndOrientation',
    label: 'Insert size and orientation',
    subLabel: 'short=pink, then orientation, then long',
    helpText:
      'Combined SV view. A short insert always paints pink regardless of orientation — at a short insert the useful signal is just "something is here", so orientation is not worth distinguishing. Otherwise an abnormal pair orientation wins (inversion, tandem duplication), and a large insert with normal orientation paints as a long insert (the classic deletion signature). Insert-size thresholds are robust to the long tail of large inserts (median ± 3·1.4826·MAD) so the short-insert signal is not washed out by a few very large outliers.',
  },
  {
    value: 'insertSize',
    label: 'Insert size',
    subLabel: 'short=pink, long=red',
    helpText:
      'Colors only by template length: short inserts pink, long inserts red, normal grey — orientation ignored. Thresholds use a robust median ± 3·1.4826·MAD spread so a tight insert-size distribution with a few very large outliers still flags genuinely short inserts.',
  },
  {
    value: 'orientation',
    label: 'Orientation',
    subLabel: 'color by pair orientation only',
    helpText:
      'Colors only by pair orientation (LR/RL/RR/LL), ignoring insert size. Useful when you only care about inversion/duplication signatures.',
  },
]

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
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem {
  return promotableRadioItem({
    label,
    checked: model.colorBy.type === type,
    onClick: () => {
      model.setColorScheme({ type })
    },
    displayTypeDefault: displayTypeDefault?.({ type }),
  })
}

// Names the tag in the label once one is picked ("Tag (HP)...") — the radio is
// the only scheme whose choice has a parameter, and it was previously invisible
// without reopening the dialog. Carries the same session-default pin as the
// plain radios, pinning the tag actually in use.
function tagItem(
  model: AnyColorByModel,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
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
    displayTypeDefault: active
      ? displayTypeDefault?.({ type: 'tag', tag: colorBy.tag })
      : undefined,
  })
}

// Plain scheme radios in a submenu — nothing here reads a modification field, so
// it takes the bare model. Threading the `modModel` probe through it instead
// silently dropped the whole section for a caller that opted in but carries no
// modification state.
function pairedEndItem(
  model: AnyColorByModel,
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem {
  return {
    label: 'Paired end',
    subMenu: pairedEndColorOptions.map(o =>
      colorRadio(model, o, displayTypeDefault),
    ),
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
  displayTypeDefault: ColorByMenuOptions['displayTypeDefault'],
): MenuItem[] {
  const detecting = !model.modificationsReady && !model.regionTooLarge
  const active = model.colorBy.type === 'modifications'
  const detected =
    model.modificationsReady && model.detectedModificationTypes.length > 0
  return [
    ...(active || detected
      ? [modificationsMenu(model, displayTypeDefault)]
      : []),
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
    subMenu: radioItems(arcColorOptions, arcColor.current, arcColor.setColor),
  }
}

function supplementaryItem(
  supp: NonNullable<ColorByMenuOptions['supplementaryColoring']>,
): MenuItem {
  return {
    label: 'Supplementary / split reads',
    subMenu: [
      checkboxItem(
        'Color supplementary alignments by primary strand',
        supp.flipStrandLongReadChains,
        () => {
          supp.setFlipStrandLongReadChains(!supp.flipStrandLongReadChains)
        },
      ),
      checkboxItem(
        'Color supplementary chains orange',
        supp.colorSupplementaryChains,
        () => {
          supp.setColorSupplementaryChains(!supp.colorSupplementaryChains)
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
    displayTypeDefault: pin,
  } = options
  const mods = includeModifications ? modModel(model) : undefined
  return {
    label: 'Color by...',
    type: 'subMenu' as const,
    icon: Palette,
    subMenu: [
      ...colorOptions.map(o => colorRadio(model, o, pin)),
      ...(includeTagOption ? [tagItem(model, pin)] : []),
      ...(includePairedEnd ? [pairedEndItem(model, pin)] : []),
      ...(mods ? modificationsItems(mods, pin) : []),
      ...(arcColor ? [arcColorItem(arcColor)] : []),
      ...(supplementaryColoring
        ? [supplementaryItem(supplementaryColoring)]
        : []),
    ] satisfies MenuItem[],
  }
}
