import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { radioItems } from './menuHelpers.ts'
import { modificationData } from '../../shared/modificationData.ts'

import type {
  ArcColorByType,
  ColorBy,
  ColorSchemeType,
} from '../../shared/types.ts'
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
  hasPairedReads: boolean
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

interface ColorOption {
  label: string
  type: ColorSchemeType
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

const basicColorOptions: ColorOption[] = [
  { label: 'Normal', type: 'normal' },
  { label: 'Strand', type: 'strand' },
  { label: 'Mapping quality', type: 'mappingQuality' },
  { label: 'Per-base quality', type: 'perBaseQuality' },
  { label: 'Per-base lettering', type: 'perBaseLetter' },
]

const pairedEndColorOptions: ColorOption[] = [
  { label: 'Insert size', type: 'insertSize' },
  { label: 'Insert size (gradient)', type: 'insertSizeGradient' },
  { label: 'First of pair strand', type: 'firstOfPairStrand' },
  { label: 'Pair orientation', type: 'pairOrientation' },
  { label: 'Insert size and orientation', type: 'insertSizeAndOrientation' },
]

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

function getModificationsSubMenu(model: ModificationsModel) {
  const {
    modificationThreshold,
    modificationsReady,
    visibleModificationTypes,
  } = model

  if (!modificationsReady) {
    return [
      { label: 'Loading modifications...', disabled: true, onClick: () => {} },
    ]
  }

  const modName = (key: string) => modificationData[key]?.name ?? key
  const mods = model.colorBy.modifications
  const hidden = mods?.hiddenModifications ?? []
  const twoColor = !!mods?.twoColor
  const cytosineContext = mods?.cytosineContext ?? 'CG'
  const isModType = model.colorBy.type === 'modifications'
  const isMethType = model.colorBy.type === 'methylation'

  // True when all visible types are shown (none in the hidden list).
  const isAllVisible = !hidden.some(k => visibleModificationTypes.includes(k))
  // True when exactly this key is visible (all others are hidden).
  const isOnlyKey = (key: string) =>
    visibleModificationTypes.every(k => k === key || hidden.includes(k))

  const applyModMode = (isTwoColor: boolean, onlyKey?: string) => {
    model.setColorScheme({
      type: 'modifications',
      modifications: {
        ...(isTwoColor ? { twoColor: true } : {}),
        ...(onlyKey
          ? {
              hiddenModifications: visibleModificationTypes.filter(
                k => k !== onlyKey,
              ),
            }
          : {}),
        threshold: modificationThreshold,
      },
    })
  }

  const applyMethylation = (context: CytosineContext) => {
    model.setColorScheme({
      type: 'methylation',
      modifications: {
        threshold: modificationThreshold,
        ...(context === 'CG' ? {} : { cytosineContext: context }),
      },
    })
  }

  // With multiple types show per-type radios so the user filters in one click;
  // with one type the all/only distinction is meaningless so use mode labels.
  const multiType = visibleModificationTypes.length > 1

  const byTypeHelpText = `Colors each modification call by its type. Only calls at or above the probability threshold (${modificationThreshold}%) are shown.`
  const twoColorHelpText =
    'Colors every called base: at least 50% probability in the modification color, below 50% in blue.'

  const byTypeItems = multiType
    ? [
        {
          label: 'All modification types',
          type: 'radio' as const,
          checked: isModType && !twoColor && isAllVisible,
          helpText: byTypeHelpText,
          onClick: () => {
            applyModMode(false)
          },
        },
        ...visibleModificationTypes.map(key => ({
          label: modName(key),
          type: 'radio' as const,
          checked: isModType && !twoColor && isOnlyKey(key),
          onClick: () => {
            applyModMode(false, key)
          },
        })),
      ]
    : [
        {
          label: 'By modification type',
          type: 'radio' as const,
          checked: isModType && !twoColor,
          helpText: byTypeHelpText,
          onClick: () => {
            applyModMode(false)
          },
        },
      ]

  const twoColorItems = [
    ...(multiType ? [{ type: 'divider' as const }] : []),
    {
      label: multiType ? 'Two-color (all)' : 'Two-color',
      type: 'radio' as const,
      checked: isModType && twoColor && (!multiType || isAllVisible),
      helpText: twoColorHelpText,
      onClick: () => {
        applyModMode(true)
      },
    },
    ...(multiType
      ? visibleModificationTypes.map(key => ({
          label: `Two-color: ${modName(key)}`,
          type: 'radio' as const,
          checked: isModType && twoColor && isOnlyKey(key),
          onClick: () => {
            applyModMode(true, key)
          },
        }))
      : []),
  ]

  const contextLabel =
    cytosineContextOptions.find(o => o.value === cytosineContext)?.label ??
    cytosineContext

  // Methylation lives here (not as a separate top-level entry) because it uses
  // the same MM/ML input data as the modes above — IGV likewise has no separate
  // methylation mode. The cytosine-context submenu only appears once the user
  // has activated methylation, keeping it out of the way for most users.
  const methylationItems = [
    { type: 'divider' as const },
    {
      label: isMethType ? `Methylation (${contextLabel})` : 'Methylation',
      type: 'radio' as const,
      checked: isMethType,
      helpText:
        'Summarizes methylated vs unmethylated cytosines. Picks the single most likely state per position to avoid double-marking on ONT models that report both 5mC and 5hmC.',
      onClick: () => {
        applyMethylation(cytosineContext)
      },
    },
    ...(isMethType
      ? [
          {
            label: `Cytosine context (${contextLabel})`,
            type: 'subMenu' as const,
            subMenu: radioItems<CytosineContext>(
              cytosineContextOptions,
              cytosineContext,
              applyMethylation,
            ),
          },
        ]
      : []),
  ]

  return [
    ...byTypeItems,
    ...twoColorItems,
    ...methylationItems,
    ...(isModType || isMethType
      ? [
          {
            label: `Adjust threshold (${modificationThreshold}%)`,
            helpText:
              'Minimum probability for a modification call to be shown.',
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                SetModificationThresholdDialog,
                { model, handleClose },
              ])
            },
          },
        ]
      : []),
  ]
}

// Bisulfite / EM-seq is reference-based (read-vs-reference C->T), so it needs no
// MM/ML tags and is its own color-by. Each cytosine-context item activates the
// bisulfite scheme with that context, like IGV's bisulfite context menu.
function getBisulfiteSubMenu(model: ModificationsModel) {
  const isBisType = model.colorBy.type === 'bisulfite'
  const context = model.colorBy.modifications?.cytosineContext ?? 'CG'
  return radioItems<CytosineContext>(
    cytosineContextOptions,
    isBisType ? context : undefined,
    next => {
      model.setColorScheme({
        type: 'bisulfite',
        // omit the default so CpG sessions don't carry a redundant field
        modifications: next === 'CG' ? {} : { cytosineContext: next },
      })
    },
  )
}

export function getColorByMenuItem(
  model: ColorByModel & Partial<ModificationsModel>,
  options: ColorByMenuOptions = {},
) {
  const { includeTagOption = false, colorOptions, arcColor } = options

  const colorRadio = ({ label, type }: ColorOption) => ({
    label,
    type: 'radio' as const,
    checked: model.colorBy.type === type,
    onClick: () => {
      model.setColorScheme({ type })
    },
  })

  const headItems = (colorOptions ?? basicColorOptions).map(colorRadio)

  const tagItem = includeTagOption
    ? [
        {
          label: 'Color by tag...',
          type: 'radio' as const,
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

  // Paired-end options are only useful when paired reads are present. Hide the
  // submenu until the first fetch confirms they exist. Also show if a paired-end
  // color mode is already active (e.g. from a saved session before data loads).
  const isPairedColorActive = pairedEndColorOptions.some(
    o => model.colorBy.type === o.type,
  )
  const pairedEndItem =
    hasModifications(model) && (model.hasPairedReads || isPairedColorActive)
      ? [
          {
            label: 'Paired end',
            type: 'subMenu' as const,
            subMenu: pairedEndColorOptions.map(colorRadio),
          },
        ]
      : []

  // MM/ML modes only when the data actually carries modifications (still shown
  // while loading); bisulfite is reference-based so it applies to any alignments
  // display regardless of MM/ML tags. When regionTooLarge and no types have
  // ever been loaded, skip the submenu entirely — nothing useful to show.
  const modItem =
    hasModifications(model) &&
    ((!model.modificationsReady && !model.regionTooLarge) ||
      model.visibleModificationTypes.length > 0)
      ? [
          {
            label: 'Base modifications (MM tag)',
            type: 'subMenu' as const,
            subMenu: getModificationsSubMenu(model),
          },
        ]
      : []

  const bisulfiteItem = hasModifications(model)
    ? [
        {
          label: 'Bisulfite / EM-seq (C→T)',
          type: 'subMenu' as const,
          subMenu: getBisulfiteSubMenu(model),
        },
      ]
    : []

  const arcColorItem = arcColor
    ? [
        {
          label: 'Arc color',
          type: 'subMenu' as const,
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
      ...modItem,
      ...bisulfiteItem,
      ...arcColorItem,
    ],
  }
}
