import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import Palette from '@mui/icons-material/Palette'

import { modificationData } from '../modificationData.ts'

import type { ColorBy } from '../types.ts'

const ColorByTagDialog = lazy(
  () => import('../components/ColorByTagDialog.tsx'),
)
const SetModificationThresholdDialog = lazy(
  () => import('../components/SetModificationThresholdDialog.tsx'),
)

interface LinearReadDisplayModel {
  colorBy?: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

interface ModificationsModel extends LinearReadDisplayModel {
  modificationsReady: boolean
  visibleModificationTypes: string[]
  modificationThreshold: number
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

interface ModificationsMenuOptions {
  includeMethylation?: boolean
}

function getModificationsSubMenu(
  model: ModificationsModel,
  options: ModificationsMenuOptions = {},
) {
  const { includeMethylation = false } = options
  const {
    modificationThreshold,
    modificationsReady,
    visibleModificationTypes,
  } = model

  if (!modificationsReady) {
    return [
      {
        label: 'Loading modifications...',
        onClick: () => {},
      },
    ]
  } else {
    return visibleModificationTypes.length
      ? [
          {
            label: `All modifications (>= ${modificationThreshold}% prob)`,
            type: 'radio' as const,
            checked:
              model.colorBy?.type === 'modifications' &&
              !model.colorBy.modifications?.isolatedModification &&
              !model.colorBy.modifications?.twoColor,
            onClick: () => {
              model.setColorScheme({
                type: 'modifications',
                modifications: {
                  threshold: modificationThreshold,
                },
              })
            },
          },
          ...model.visibleModificationTypes.map(key => ({
            label: `Show only ${modificationData[key]?.name || key} (>= ${modificationThreshold}% prob)`,
            type: 'radio' as const,
            checked:
              model.colorBy?.type === 'modifications' &&
              model.colorBy.modifications?.isolatedModification === key &&
              !model.colorBy.modifications.twoColor,
            onClick: () => {
              model.setColorScheme({
                type: 'modifications',
                modifications: {
                  isolatedModification: key,
                  threshold: modificationThreshold,
                },
              })
            },
          })),
          { type: 'divider' as const },
          {
            label: 'All modifications (<50% prob colored blue)',
            type: 'radio' as const,
            checked:
              model.colorBy?.type === 'modifications' &&
              !model.colorBy.modifications?.isolatedModification &&
              !!model.colorBy.modifications?.twoColor,
            onClick: () => {
              model.setColorScheme({
                type: 'modifications',
                modifications: {
                  twoColor: true,
                  threshold: modificationThreshold,
                },
              })
            },
          },
          ...model.visibleModificationTypes.map(key => ({
            label: `Show only ${modificationData[key]?.name || key} (<50% prob colored blue)`,
            type: 'radio' as const,
            checked:
              model.colorBy?.type === 'modifications' &&
              model.colorBy.modifications?.isolatedModification === key &&
              !!model.colorBy.modifications.twoColor,
            onClick: () => {
              model.setColorScheme({
                type: 'modifications',
                modifications: {
                  isolatedModification: key,
                  twoColor: true,
                  threshold: modificationThreshold,
                },
              })
            },
          })),
          ...(includeMethylation
            ? [
                { type: 'divider' as const },
                {
                  label: 'All read CpGs',
                  type: 'radio' as const,
                  checked: model.colorBy?.type === 'methylation',
                  onClick: () => {
                    model.setColorScheme({
                      type: 'methylation',
                      modifications: {
                        threshold: modificationThreshold,
                      },
                    })
                  },
                },
              ]
            : []),
          { type: 'divider' as const },
          {
            label: `Adjust threshold (${modificationThreshold}%)`,
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                SetModificationThresholdDialog,
                {
                  model,
                  handleClose,
                },
              ])
            },
          },
        ]
      : [
          {
            label: 'No modifications currently visible',
            disabled: true,
            onClick: () => {},
          },
        ]
  }
}

interface ColorByModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

interface ArcsState {
  colorByType: string
  setColorByType: (
    type: 'insertSizeAndOrientation' | 'insertSize' | 'orientation' | 'samplot',
  ) => void
}

interface ColorByMenuOptions {
  showLinkedReads?: boolean
  includeModifications?: boolean
  includeTagOption?: boolean
  colorOptions?: { label: string; type: string }[]
  arcsState?: ArcsState
}

const defaultColorOptions = [
  { label: 'Normal', type: 'normal' },
  { label: 'Strand', type: 'strand' },
  { label: 'Mapping quality', type: 'mappingQuality' },
  { label: 'Base quality', type: 'baseQuality' },
  { label: 'Insert size', type: 'insertSize' },
  { label: 'Insert size (gradient)', type: 'insertSizeGradient' },
  { label: 'First of pair strand', type: 'firstOfPairStrand' },
  { label: 'Pair orientation', type: 'pairOrientation' },
  { label: 'Insert size and orientation', type: 'insertSizeAndOrientation' },
]

const linkedReadsColorOptions = [
  { label: 'Insert size and orientation', type: 'insertSizeAndOrientation' },
  { label: 'Insert size', type: 'insertSize' },
  { label: 'Pair orientation', type: 'pairOrientation' },
]

export function getColorByMenuItem(
  model: ColorByModel,
  options: ColorByMenuOptions = {},
) {
  const {
    showLinkedReads = false,
    includeModifications = false,
    includeTagOption = false,
    arcsState,
  } = options

  const colorRadio = (label: string, type: string) => ({
    label,
    type: 'radio' as const,
    checked: model.colorBy.type === type,
    onClick: () => {
      model.setColorScheme({ type })
    },
  })

  const modificationsItem =
    includeModifications && isModificationsModel(model)
      ? {
          label: 'Modifications',
          type: 'subMenu' as const,
          subMenu: getModificationsSubMenu(model, {
            includeMethylation: true,
          }),
        }
      : undefined

  const items =
    options.colorOptions ||
    (showLinkedReads ? linkedReadsColorOptions : defaultColorOptions)

  const subMenu = [
    ...items.map(({ label, type }) => colorRadio(label, type)),
    ...(includeTagOption
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
      : []),
    ...(arcsState
      ? [
          {
            label: 'Arc color scheme',
            type: 'subMenu' as const,
            subMenu: (
              [
                ['Insert size and orientation', 'insertSizeAndOrientation'],
                ['Insert size', 'insertSize'],
                ['Orientation', 'orientation'],
              ] as const
            ).map(([label, type]) => ({
              label,
              type: 'radio' as const,
              checked: arcsState.colorByType === type,
              onClick: () => {
                arcsState.setColorByType(type)
              },
            })),
          },
        ]
      : []),
    ...(modificationsItem ? [modificationsItem] : []),
  ]

  return {
    label: 'Color by...',
    icon: Palette,
    subMenu,
  }
}
