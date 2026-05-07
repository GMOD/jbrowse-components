import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { modificationData } from '../modificationData.ts'

import type { ArcColorByType } from '../../LinearAlignmentsDisplay/model.ts'
import type { ColorBy } from '../types.ts'

const ColorByTagDialog = lazy(
  () => import('../components/ColorByTagDialog.tsx'),
)
const SetModificationThresholdDialog = lazy(
  () => import('../components/SetModificationThresholdDialog.tsx'),
)

interface ColorByModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

interface ModificationsModel extends ColorByModel {
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
  showLinkedReads?: boolean
  includeModifications?: boolean
  includeTagOption?: boolean
  colorOptions?: ColorOption[]
  arcsState?: ArcsState
}

function isModificationsModel(model: unknown): model is ModificationsModel {
  return (
    typeof model === 'object' &&
    model !== null &&
    'modificationsReady' in model &&
    'visibleModificationTypes' in model &&
    'modificationThreshold' in model
  )
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

const linkedReadsColorOptions: ColorOption[] = [
  { label: 'Insert size and orientation', type: 'insertSizeAndOrientation' },
  { label: 'Insert size', type: 'insertSize' },
  { label: 'Pair orientation', type: 'pairOrientation' },
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
    return [{ label: 'Loading modifications...', onClick: () => {} }]
  } else {
    if (!visibleModificationTypes.length) {
      return [
        {
          label: 'No modifications currently visible',
          disabled: true,
          onClick: () => {},
        },
      ]
    } else {
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

      const suffix = (twoColor: boolean) =>
        twoColor
          ? '(<50% prob colored blue)'
          : `(>= ${modificationThreshold}% prob)`
      const modName = (key: string) => modificationData[key]?.name || key

      const modGroup = (twoColor: boolean) => [
        modRadio(`All modifications ${suffix(twoColor)}`, undefined, twoColor),
        ...visibleModificationTypes.map(key =>
          modRadio(
            `Show only ${modName(key)} ${suffix(twoColor)}`,
            key,
            twoColor,
          ),
        ),
      ]

      return [
        ...modGroup(false),
        { type: 'divider' as const },
        ...modGroup(true),
        { type: 'divider' as const },
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
        { type: 'divider' as const },
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
  }
}

export function getColorByMenuItem(
  model: ColorByModel,
  options: ColorByMenuOptions = {},
) {
  const {
    showLinkedReads = false,
    includeModifications = false,
    includeTagOption = false,
    colorOptions,
    arcsState,
  } = options

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
    : showLinkedReads
      ? linkedReadsColorOptions.map(colorRadio)
      : [
          ...basicColorOptions.map(colorRadio),
          {
            label: 'Paired-end',
            type: 'subMenu' as const,
            subMenu: pairedEndColorOptions.map(colorRadio),
          },
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

  const arcsItem = arcsState
    ? [
        {
          label: 'Arc color scheme',
          type: 'subMenu' as const,
          subMenu: arcColorOptions.map(({ label, type }) => ({
            label,
            type: 'radio' as const,
            checked: arcsState.arcColorByType === type,
            onClick: () => {
              arcsState.setColorByType(type)
            },
          })),
        },
      ]
    : []

  const modificationsItem =
    includeModifications && isModificationsModel(model)
      ? [
          {
            label: 'Modifications',
            type: 'subMenu' as const,
            subMenu: getModificationsSubMenu(model),
          },
        ]
      : []

  return {
    label: 'Color by...',
    icon: Palette,
    subMenu: [...headItems, ...tagItem, ...arcsItem, ...modificationsItem],
  }
}
