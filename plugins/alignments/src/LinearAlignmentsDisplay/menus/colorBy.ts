import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { checkboxItem, radioItems, radioModeMenuItem } from './menuHelpers.ts'
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

type ModColorMode = 'byType' | 'twoColor' | 'methylation' | 'bisulfite'

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
  const isBisType = model.colorBy.type === 'bisulfite'
  // undefined when the display is in some non-modification color scheme, so no
  // mode radio shows as selected until the user enters a modification mode.
  const mode: ModColorMode | undefined = isMethType
    ? 'methylation'
    : isBisType
      ? 'bisulfite'
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

  // Methylation (modBAM MM/ML) and bisulfite (read-vs-reference C->T) share the
  // methylated/unmethylated rendering and the cytosine-context picker.
  const applyContextMode = (
    type: 'methylation' | 'bisulfite',
    context: CytosineContext,
  ) => {
    model.setColorScheme({
      type,
      modifications: {
        ...(type === 'methylation' ? { threshold: modificationThreshold } : {}),
        // omit the default so CpG sessions don't carry a redundant field
        ...(context === 'CG' ? {} : { cytosineContext: context }),
      },
    })
  }

  // Per-mode setColorScheme that preserves the current threshold and (for the
  // modification modes) the hidden-type selection.
  const setMode = (next: ModColorMode) => {
    if (next === 'methylation' || next === 'bisulfite') {
      applyContextMode(next, cytosineContext)
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
        { value: 'methylation', label: 'Methylation (modBAM MM/ML)' },
        { value: 'bisulfite', label: 'Bisulfite / EM-seq' },
      ],
      mode,
      setMode,
    ),
    // Hint when the BAM carries no MM/ML tags — the MM/ML modes do nothing, but
    // bisulfite still works since it reads methylation from the reference.
    ...(visibleModificationTypes.length
      ? []
      : [
          {
            label: 'No MM/ML modifications detected',
            subLabel: 'bisulfite reads methylation from the reference',
            disabled: true,
            onClick: () => {},
          },
        ]),
    // Per-type visibility only applies once coloring by modification type; the
    // methylation mode renders cytosines rather than individual MM/ML types.
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
    // Cytosine context picker — shared by methylation and bisulfite modes. CpG
    // is the mammalian default; CHG/CHH (and all) cover plant methylation. Load
    // the file as separate per-context tracks for the classic 3-context view.
    ...(isMethType || isBisType
      ? [
          radioModeMenuItem<CytosineContext>(
            'Cytosine context',
            [
              { value: 'CG', label: 'CpG' },
              { value: 'CHG', label: 'CHG' },
              { value: 'CHH', label: 'CHH' },
              { value: 'all', label: 'All cytosines' },
            ],
            cytosineContext,
            context =>
              { applyContextMode(isBisType ? 'bisulfite' : 'methylation', context) },
          ),
        ]
      : []),
    // Threshold is an MM/ML probability cutoff; bisulfite calls are binary.
    ...(isBisType
      ? []
      : [
          {
            label: `Adjust threshold (${modificationThreshold}%)`,
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                SetModificationThresholdDialog,
                { model, handleClose },
              ])
            },
          },
        ]),
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
