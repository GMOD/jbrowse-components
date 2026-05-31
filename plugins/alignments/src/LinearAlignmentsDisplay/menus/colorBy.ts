import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { modificationData } from '../../shared/modificationData.ts'

import type { ColorBy } from '../../shared/types.ts'

const ColorByTagDialog = lazy(
  () => import('../dialogs/ColorByTagDialog.tsx'),
)
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

interface ArcsState {
  arcColorByType: ArcColorByType
  setColorByType: (type: ArcColorByType) => void
}

interface ColorOption {
  label: string
  type: string
}

interface ColorByMenuOptions {
  includeTagOption?: boolean
  colorOptions?: ColorOption[]
  arcsState?: ArcsState
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
  { label: 'Arc: Insert size and orientation', type: 'insertSizeAndOrientation' },
  { label: 'Arc: Insert size', type: 'insertSize' },
  { label: 'Arc: Orientation', type: 'orientation' },
]

function getModificationsSubMenu(model: ModificationsModel) {
  const { modificationThreshold, modificationsReady, visibleModificationTypes } =
    model

  if (!modificationsReady) {
    return [{ label: 'Loading modifications...', disabled: true, onClick: () => {} }]
  }

  if (!visibleModificationTypes.length) {
    return [{ label: 'No modifications currently visible', disabled: true, onClick: () => {} }]
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
      model.colorBy.modifications?.isolatedModification === isolatedModification &&
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
  model: ColorByModel,
  options: ColorByMenuOptions = {},
) {
  const { includeTagOption = false, colorOptions, arcsState } = options

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
    : [...basicColorOptions.map(colorRadio), ...pairedEndColorOptions.map(colorRadio)]

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

  const arcItems = arcsState
    ? arcColorOptions.map(({ label, type }) => ({
        label,
        type: 'radio' as const,
        checked: arcsState.arcColorByType === type,
        onClick: () => {
          arcsState.setColorByType(type)
        },
      }))
    : []

  return {
    label: 'Color by...',
    icon: Palette,
    subMenu: [...headItems, ...tagItem, ...arcItems],
  }
}

export function getModificationsMenuItem(model: ModificationsModel) {
  return {
    label: 'Modifications...',
    type: 'subMenu' as const,
    subMenu: getModificationsSubMenu(model),
  }
}
