import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { checkboxItem, radioItems } from './menuHelpers.ts'
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
  visibleModificationTypes: string[]
  modificationThreshold: number
}

// The three modification fields always travel together: an alignments display
// has all of them, a synteny display has none. The predicate lets the menu
// accept either kind of model without lying about the fields being required.
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
  { label: 'Base quality', type: 'baseQuality' },
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

const arcColorOptions: { label: string; type: ArcColorByType }[] = [
  { label: 'Insert size and orientation', type: 'insertSizeAndOrientation' },
  { label: 'Insert size', type: 'insertSize' },
  { label: 'Orientation', type: 'orientation' },
]

// MM/ML coloring modes. byType/twoColor mirror IGV's "base modification" and
// "base modification 2-color"; methylation is the cytosine-context summary IGV
// gets from a 5mC filter plus its global cytosine-context preference. Bisulfite
// is a separate, reference-based color-by (getBisulfiteSubMenu), not a mode.
type ModColorMode = 'byType' | 'twoColor' | 'methylation'

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
  // undefined when the display is in some non-modification color scheme, so no
  // mode radio shows as selected until the user enters a modification mode.
  const mode: ModColorMode | undefined = isMethType
    ? 'methylation'
    : isModType
      ? twoColor
        ? 'twoColor'
        : 'byType'
      : undefined

  const applyModifications = (opts: {
    twoColor: boolean
    hidden: string[]
  }) => {
    model.setColorScheme({
      type: 'modifications',
      modifications: {
        ...(opts.twoColor ? { twoColor: true } : {}),
        ...(opts.hidden.length ? { hiddenModifications: opts.hidden } : {}),
        threshold: modificationThreshold,
      },
    })
  }

  const applyMethylation = (context: CytosineContext) => {
    model.setColorScheme({
      type: 'methylation',
      modifications: {
        threshold: modificationThreshold,
        // omit the default so CpG sessions don't carry a redundant field
        ...(context === 'CG' ? {} : { cytosineContext: context }),
      },
    })
  }

  const setMode = (next: ModColorMode) => {
    if (next === 'methylation') {
      applyMethylation(cytosineContext)
    } else {
      applyModifications({ twoColor: next === 'twoColor', hidden })
    }
  }

  const toggleType = (key: string) => {
    const nextHidden = hidden.includes(key)
      ? hidden.filter(k => k !== key)
      : [...hidden, key]
    applyModifications({ twoColor, hidden: nextHidden })
  }

  return [
    // helpText (a per-item info dialog) spells out how the modes differ — the
    // distinction (especially two-color vs methylation) is otherwise easy to
    // confuse — and where the probability threshold applies.
    ...radioItems<ModColorMode>(
      [
        {
          value: 'byType',
          label: 'By modification type',
          helpText: `Colors each modification call by its type. Only calls at or above the probability threshold (${modificationThreshold}%) are shown.`,
        },
        {
          value: 'twoColor',
          label: 'Two-color',
          helpText:
            'Colors every called base: at least 50% probability in the modification color, below 50% in blue.',
        },
        {
          value: 'methylation',
          label: 'Methylation',
          helpText:
            'Summarizes methylated vs unmethylated cytosines, restricted to a cytosine context (CpG by default). Picks the single most likely state per cytosine.',
        },
      ],
      mode,
      setMode,
    ),
    // Per-type show/hide applies to the type-colored modes; methylation renders
    // cytosine state rather than individual MM/ML types, so it gets the
    // cytosine-context picker instead.
    ...(isModType && visibleModificationTypes.length
      ? [
          {
            label: 'Show types...',
            type: 'subMenu' as const,
            subMenu: visibleModificationTypes.map(key =>
              checkboxItem(modName(key), !hidden.includes(key), () => {
                toggleType(key)
              }),
            ),
          },
        ]
      : []),
    ...(isMethType
      ? [
          {
            label: 'Cytosine context',
            type: 'subMenu' as const,
            subMenu: radioItems<CytosineContext>(
              cytosineContextOptions,
              cytosineContext,
              applyMethylation,
            ),
          },
        ]
      : []),
    {
      label: `Adjust threshold (${modificationThreshold}%)`,
      onClick: () => {
        getSession(model).queueDialog(handleClose => [
          SetModificationThresholdDialog,
          { model, handleClose },
        ])
      },
    },
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

  const headItems = colorOptions
    ? colorOptions.map(colorRadio)
    : [
        ...basicColorOptions.map(colorRadio),
        ...pairedEndColorOptions.map(colorRadio),
      ]

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

  // MM/ML modes only when the data actually carries modifications (still shown
  // while loading); bisulfite is reference-based so it applies to any alignments
  // display regardless of MM/ML tags.
  const modItem =
    hasModifications(model) &&
    (!model.modificationsReady || model.visibleModificationTypes.length)
      ? [
          {
            label: 'Modifications (MM tag)',
            type: 'subMenu' as const,
            subMenu: getModificationsSubMenu(model),
          },
        ]
      : []

  const bisulfiteItem = hasModifications(model)
    ? [
        {
          label: 'Bisulfite / EM-seq',
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
          subMenu: arcColorOptions.map(({ label, type }) => ({
            label,
            type: 'radio' as const,
            checked: arcColor.current === type,
            onClick: () => {
              arcColor.setColor(type)
            },
          })),
        },
      ]
    : []

  return {
    label: 'Color by...',
    icon: Palette,
    subMenu: [
      ...headItems,
      ...tagItem,
      ...modItem,
      ...bisulfiteItem,
      ...arcColorItem,
    ],
  }
}
