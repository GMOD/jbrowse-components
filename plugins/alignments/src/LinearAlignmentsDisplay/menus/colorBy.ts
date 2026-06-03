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

type ModColorMode = 'byType' | 'twoColor' | 'methylation'

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

  if (!visibleModificationTypes.length) {
    return [
      {
        label: 'No modifications currently visible',
        disabled: true,
        onClick: () => {},
      },
    ]
  }

  const modName = (key: string) => modificationData[key]?.name ?? key
  const mods = model.colorBy.modifications
  const hidden = mods?.hiddenModifications ?? []
  const twoColor = !!mods?.twoColor
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

  // Per-mode setColorScheme that preserves the current threshold and (for the
  // modification modes) the hidden-type selection.
  const setMode = (next: ModColorMode) => {
    if (next === 'methylation') {
      model.setColorScheme({
        type: 'methylation',
        modifications: { threshold: modificationThreshold },
      })
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
    ...radioItems<ModColorMode>(
      [
        { value: 'byType', label: 'Color by modification type' },
        { value: 'twoColor', label: 'Two-color (low-confidence blue)' },
        { value: 'methylation', label: 'Methylation (all CpGs)' },
      ],
      mode,
      setMode,
    ),
    // Per-type visibility only applies once coloring by modification type; the
    // methylation mode renders CpGs rather than individual MM/ML types.
    ...(isModType
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

  const modItem = hasModifications(model)
    ? [
        {
          label: 'Modifications...',
          type: 'subMenu' as const,
          subMenu: getModificationsSubMenu(model),
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
    subMenu: [...headItems, ...tagItem, ...modItem, ...arcColorItem],
  }
}
