import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { radioItems } from './menuHelpers.ts'
import { radioColorOptions } from '../../shared/colorSchemes.ts'
import { modificationData } from '../../shared/modificationData.ts'
import { DEFAULT_MODIFICATION_THRESHOLD } from '../../shared/types.ts'

import type { ColorOption } from '../../shared/colorSchemes.ts'
import type { ArcColorByType, ColorBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { CytosineContext } from '@jbrowse/modifications-utils'

const ColorByTagDialog = lazy(() => import('../dialogs/ColorByTagDialog.tsx'))
const SetModificationThresholdDialog = lazy(
  () => import('../dialogs/SetModificationThresholdDialog.tsx'),
)

interface ColorByModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

export interface ModificationsModel extends ColorByModel {
  modificationsReady: boolean
  regionTooLarge: boolean
  visibleModificationTypes: string[]
  modificationThreshold: number
}

// The modification fields always travel together: an alignments display has all
// of them, a synteny display has none. The predicate lets the menu accept either
// kind of model without lying about the fields being required.
function hasModifications(
  model: ColorByModel & Partial<ModificationsModel>,
): model is ModificationsModel {
  return model.modificationsReady !== undefined
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
  colorOptions?: ColorOption[]
  // Read-connection arc coloring lives here rather than in the Read connections
  // menu — it's a rare setting and colors belong together. Passed whenever an
  // overlay (arcs or read cloud) is active, since both share this coloring.
  arcColor?: {
    current: ArcColorByType
    setColor: (type: ArcColorByType) => void
  }
}

// Derived from the shared COLOR_SCHEMES registry (single source of menu
// placement + shader path), in registry order so the menu is unchanged.
const basicColorOptions = radioColorOptions('basic')
const pairedEndColorOptions = radioColorOptions('pairedEnd')

const arcColorOptions: { value: ArcColorByType; label: string }[] = [
  { value: 'insertSizeAndOrientation', label: 'Insert size and orientation' },
  { value: 'insertSize', label: 'Insert size' },
  { value: 'orientation', label: 'Orientation' },
]

const cytosineContextOptions: { value: CytosineContext; label: string }[] = [
  { value: 'CG', label: 'CpG' },
  { value: 'CHG', label: 'CHG' },
  { value: 'CHH', label: 'CHH' },
  { value: 'all', label: 'All cytosines' },
]

const DIVIDER: MenuItem = { type: 'divider' }

// --- scheme setters: one place that writes each colorBy shape ---------------

// Preserve a non-default probability threshold across mode switches, but omit it
// at the default so default sessions don't carry a redundant field.
function modThresholdField(model: ModificationsModel) {
  return model.modificationThreshold === DEFAULT_MODIFICATION_THRESHOLD
    ? {}
    : { threshold: model.modificationThreshold }
}

function setByType(
  model: ModificationsModel,
  twoColor: boolean,
  onlyKey?: string,
) {
  model.setColorScheme({
    type: 'modifications',
    modifications: {
      ...(twoColor ? { twoColor: true } : {}),
      ...(onlyKey
        ? {
            hiddenModifications: model.visibleModificationTypes.filter(
              k => k !== onlyKey,
            ),
          }
        : {}),
      ...modThresholdField(model),
    },
  })
}

// methylation/bisulfite share the cytosine-context field; both omit the CpG
// default so CpG sessions don't carry it.
function setContextScheme(
  model: ModificationsModel,
  type: 'methylation' | 'bisulfite',
  context: CytosineContext,
) {
  model.setColorScheme({
    type,
    modifications: {
      ...(type === 'methylation' ? modThresholdField(model) : {}),
      ...(context === 'CG' ? {} : { cytosineContext: context }),
    },
  })
}

// --- "Color by methylation": red/blue methylated-vs-unmethylated summary -----

// Shown only when a cytosine methylation type (5mC/5hmC) is present — getMethBins
// summarizes those, so a plain 6mA or RNA-mod track falls through to by-type.
// The context picker is always visible (no activate-first reveal), and the
// probability threshold does not apply (each site shows its most-likely state).
function buildMethylationItem(model: ModificationsModel): MenuItem[] {
  const isMeth = model.colorBy.type === 'methylation'
  const context = model.colorBy.modifications?.cytosineContext ?? 'CG'
  const hasCytosineMeth = model.visibleModificationTypes.some(
    k => k === 'm' || k === 'h',
  )
  return hasCytosineMeth
    ? [
        {
          label: 'Color by methylation',
          subLabel: 'methylated vs. unmethylated (red / blue)',
          helpText:
            'Pick this to see methylation patterns — CpG islands, hypomethylated regions. Colors every cytosine in the chosen context, including ones the basecaller left implicit (so hypomethylation shows as blue), and merges 5mC/5hmC into one call per site. Each site shows its most-likely state (≈50% split), so the probability threshold does not apply here.',
          subMenu: radioItems<CytosineContext>(
            cytosineContextOptions,
            isMeth ? context : undefined,
            next => {
              setContextScheme(model, 'methylation', next)
            },
          ),
        },
      ]
    : []
}

// --- "Color by modification type": raw per-call view, any modification -------

function buildByTypeItem(model: ModificationsModel): MenuItem {
  const { visibleModificationTypes: types, modificationThreshold } = model
  const mods = model.colorBy.modifications
  const hidden = mods?.hiddenModifications ?? []
  const twoColor = !!mods?.twoColor
  const isModType = model.colorBy.type === 'modifications'
  const modName = (k: string) => modificationData[k]?.name ?? k
  // all types shown (none hidden) vs exactly one type shown (rest hidden)
  const allVisible = !hidden.some(k => types.includes(k))
  const onlyKey = (k: string) => types.every(t => t === k || hidden.includes(t))
  // multiple types → per-type radios (filter in one click); single type → the
  // all/only distinction is meaningless, so use a plain mode label.
  const multiType = types.length > 1

  const byTypeHelpText = `Colors each modification call by its type. Only calls at or above the probability threshold (${modificationThreshold}%) are shown.`
  const twoColorHelpText =
    'Shades each called base by probability: at least 50% in the modification color, below 50% in blue. Only positions the caller listed are drawn.'

  const byTypeRadios: MenuItem[] = multiType
    ? [
        {
          label: 'All modification types',
          type: 'radio',
          checked: isModType && !twoColor && allVisible,
          helpText: byTypeHelpText,
          onClick: () => {
            setByType(model, false)
          },
        },
        ...types.map(
          (k): MenuItem => ({
            label: modName(k),
            type: 'radio',
            checked: isModType && !twoColor && onlyKey(k),
            onClick: () => {
              setByType(model, false, k)
            },
          }),
        ),
      ]
    : [
        {
          label: 'By modification type',
          type: 'radio',
          checked: isModType && !twoColor,
          helpText: byTypeHelpText,
          onClick: () => {
            setByType(model, false)
          },
        },
      ]

  const twoColorRadios: MenuItem[] = [
    ...(multiType ? [DIVIDER] : []),
    {
      label: multiType ? 'Two-color (all)' : 'Two-color',
      type: 'radio',
      checked: isModType && twoColor && (!multiType || allVisible),
      helpText: twoColorHelpText,
      onClick: () => {
        setByType(model, true)
      },
    },
    ...(multiType
      ? types.map(
          (k): MenuItem => ({
            label: `Two-color: ${modName(k)}`,
            type: 'radio',
            checked: isModType && twoColor && onlyKey(k),
            onClick: () => {
              setByType(model, true, k)
            },
          }),
        )
      : []),
  ]

  // Threshold gates only the by-type radios above (see extractModifications:
  // `prob >= modThreshold`); two-color ignores it (fixed 50% cutoff) and
  // methylation ignores it (most-likely state). So it lives here, not at the
  // modifications top level where it would imply it affects every mode.
  const thresholdItem: MenuItem = {
    label: `Adjust threshold (${modificationThreshold}%)`,
    helpText:
      'Hides modification calls below this probability. Applies to the by-type modes above only — Two-color uses a fixed 50% cutoff and "Color by methylation" shows every cytosine, neither affected by this.',
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        SetModificationThresholdDialog,
        { model, handleClose },
      ])
    },
  }

  return {
    label: 'Color by modification type',
    subLabel: 'each modification its own color (5mC, 5hmC, 6mA…)',
    helpText:
      'Pick this to inspect the raw per-call data or non-methylation modifications. Colors each call by its modification type; only positions the caller listed are drawn. Two-color instead shades each listed call red/blue by probability.',
    subMenu: [...byTypeRadios, ...twoColorRadios, DIVIDER, thresholdItem],
  }
}

// MM/ML coloring: the methylation summary (when present) plus the per-call view.
function buildModificationsItem(model: ModificationsModel): MenuItem {
  return {
    label: 'Base modifications (MM tag)',
    subMenu: model.modificationsReady
      ? [...buildMethylationItem(model), buildByTypeItem(model)]
      : [{ label: 'Loading modifications...', disabled: true, onClick() {} }],
  }
}

// Bisulfite / EM-seq is reference-based (read-vs-reference C→T), so it needs no
// MM/ML tags and applies to any alignments display — but it's only meaningful
// for bisulfite libraries, so it's tucked under "Advanced".
function buildAdvancedItem(model: ModificationsModel): MenuItem {
  const isBis = model.colorBy.type === 'bisulfite'
  const context = model.colorBy.modifications?.cytosineContext ?? 'CG'
  return {
    label: 'Advanced',
    subMenu: [
      {
        label: 'Bisulfite / EM-seq (no MM/ML tags)',
        helpText:
          'Reference-based methylation read from C→T conversion; needs no MM/ML tags. Methylated red, unmethylated blue, by cytosine context.',
        subMenu: radioItems<CytosineContext>(
          cytosineContextOptions,
          isBis ? context : undefined,
          next => {
            setContextScheme(model, 'bisulfite', next)
          },
        ),
      },
    ],
  }
}

export function getColorByMenuItem(
  model: ColorByModel & Partial<ModificationsModel>,
  options: ColorByMenuOptions = {},
) {
  const { includeTagOption = false, colorOptions, arcColor } = options

  const colorRadio = ({ label, type }: ColorOption): MenuItem => ({
    label,
    type: 'radio',
    checked: model.colorBy.type === type,
    onClick: () => {
      model.setColorScheme({ type })
    },
  })

  const headItems = (colorOptions ?? basicColorOptions).map(colorRadio)

  const tagItem: MenuItem[] = includeTagOption
    ? [
        {
          label: 'Color by tag...',
          type: 'radio',
          checked: model.colorBy.type === 'tag',
          onClick: () => {
            getSession(model).queueDialog((onClose: () => void) => [
              ColorByTagDialog,
              { model, handleClose: onClose },
            ])
          },
        },
      ]
    : []

  const pairedEndItem: MenuItem[] = hasModifications(model)
    ? [
        {
          label: 'Paired end',
          subMenu: pairedEndColorOptions.map(colorRadio),
        },
      ]
    : []

  // MM/ML modes only when the data actually carries modifications (still shown
  // while loading). When regionTooLarge and no types have ever loaded, skip the
  // submenu — nothing useful to show. Bisulfite (Advanced) is reference-based so
  // it applies to any alignments display regardless of MM/ML tags.
  const showMods =
    hasModifications(model) &&
    ((!model.modificationsReady && !model.regionTooLarge) ||
      model.visibleModificationTypes.length > 0)

  const modItems: MenuItem[] = hasModifications(model)
    ? [
        ...(showMods ? [buildModificationsItem(model)] : []),
        buildAdvancedItem(model),
      ]
    : []

  const arcColorItem: MenuItem[] = arcColor
    ? [
        {
          label: 'Arc color',
          subMenu: radioItems(
            arcColorOptions,
            arcColor.current,
            arcColor.setColor,
          ),
        },
      ]
    : []

  return {
    label: 'Color by...',
    type: 'subMenu' as const,
    icon: Palette,
    subMenu: [
      ...headItems,
      ...tagItem,
      ...pairedEndItem,
      ...modItems,
      ...arcColorItem,
    ],
  }
}
