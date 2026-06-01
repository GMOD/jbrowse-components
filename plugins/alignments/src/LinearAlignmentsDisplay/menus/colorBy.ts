import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { modificationData } from '../../shared/modificationData.ts'

import type { ArcColorByType, ColorBy } from '../../shared/types.ts'

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
  type: string
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
  colorOptions?: ColorOption[]
  // Read-connection arc coloring lives here rather than in the Read connections
  // menu — it's a rare setting and colors belong together. Passed only when arc
  // mode is active, so it stays hidden otherwise.
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
  const probSuffix = `(>=${modificationThreshold}% prob)`
  const twoColorSuffix = '(<50% prob colored blue)'

  const modRadio = (
    label: string,
    isolatedModification: string | undefined,
    twoColor: boolean,
  ) => ({
    label,
    type: 'radio' as const,
    checked:
      model.colorBy.type === 'modifications' &&
      model.colorBy.modifications?.isolatedModification ===
        isolatedModification &&
      !!model.colorBy.modifications?.twoColor === twoColor,
    onClick: () => {
      model.setColorScheme({
        type: 'modifications',
        modifications: {
          ...(isolatedModification ? { isolatedModification } : {}),
          ...(twoColor ? { twoColor: true } : {}),
          threshold: modificationThreshold,
        },
      })
    },
  })

  return [
    modRadio(`All modifications ${probSuffix}`, undefined, false),
    ...visibleModificationTypes.map(key =>
      modRadio(`Show only ${modName(key)} ${probSuffix}`, key, false),
    ),
    modRadio(`All modifications ${twoColorSuffix}`, undefined, true),
    ...visibleModificationTypes.map(key =>
      modRadio(`Show only ${modName(key)} ${twoColorSuffix}`, key, true),
    ),
    {
      label: 'All read CpGs',
      type: 'radio' as const,
      checked: model.colorBy.type === 'methylation',
      onClick: () => {
        model.setColorScheme({
          type: 'methylation',
          modifications: { threshold: modificationThreshold },
        })
      },
    },
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
