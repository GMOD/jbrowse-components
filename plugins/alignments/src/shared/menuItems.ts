import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import WorkspacesIcon from '@mui/icons-material/Workspaces'

import { modificationData } from './modificationData.ts'

import type { ColorBy } from './types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetFeatureHeightDialog = lazy(
  () => import('./components/SetFeatureHeightDialog.tsx'),
)
const ColorByTagDialog = lazy(() => import('./components/ColorByTagDialog.tsx'))
const FilterByTagDialog = lazy(
  () => import('./components/FilterByTagDialog.tsx'),
)
const SetModificationThresholdDialog = lazy(
  () => import('./components/SetModificationThresholdDialog.tsx'),
)
const SetMaxHeightDialog = lazy(
  () => import('./components/SetMaxHeightDialog.tsx'),
)
const SortByTagDialog = lazy(
  () => import('../LinearAlignmentsDisplay/components/SortByTagDialog.tsx'),
)
const GroupByDialog = lazy(
  () => import('../LinearAlignmentsDisplay/components/GroupByDialog.tsx'),
)

interface LinearReadDisplayModel {
  colorBy?: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

export interface ModificationsModel extends LinearReadDisplayModel {
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

export interface ModificationsMenuOptions {
  includeMethylation?: boolean
}

export function getModificationsSubMenu(
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
                  label: 'All reference CpGs',
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

interface FiltersModel {
  drawSingletons?: boolean
  drawProperPairs?: boolean
  setDrawSingletons?: (arg: boolean) => void
  setDrawProperPairs?: (arg: boolean) => void
}

export function getFiltersMenuItem(
  model: FiltersModel,
  opts?: { showPairFilters?: boolean },
) {
  const showPairFilters = opts?.showPairFilters ?? false
  return {
    label: 'Filters...',
    icon: ClearAllIcon,
    type: 'subMenu' as const,
    subMenu: [
      ...(showPairFilters
        ? [
            {
              label: 'Show singletons',
              type: 'checkbox' as const,
              checked: model.drawSingletons ?? false,
              onClick: () => {
                model.setDrawSingletons?.(!model.drawSingletons)
              },
            },
            {
              label: 'Show proper pairs',
              type: 'checkbox' as const,
              checked: model.drawProperPairs ?? false,
              onClick: () => {
                model.setDrawProperPairs?.(!model.drawProperPairs)
              },
            },
            { type: 'divider' as const },
          ]
        : []),
      {
        label: 'Filter by tag...',
        onClick: () => {
          // @ts-expect-error getSession works on model
          getSession(model).queueDialog((handleClose: () => void) => [
            FilterByTagDialog,
            { model, handleClose },
          ])
        },
      },
    ],
  }
}

interface MismatchDisplayModel {
  hideMismatches?: boolean
  hideSmallIndels?: boolean
  hideLargeIndels?: boolean
  setHideMismatches: (arg: boolean) => void
  setHideSmallIndels: (arg: boolean) => void
  setHideLargeIndels: (arg: boolean) => void
}

interface FeatureHeightModel {
  featureHeightSetting: number
  noSpacing?: boolean
  noSpacingSetting?: boolean
  setFeatureHeight: (height?: number) => void
  setNoSpacing: (noSpacing?: boolean) => void
}

export function getFeatureHeightMenuItem(model: FeatureHeightModel) {
  return {
    label: 'Set feature height...',
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Normal',
        type: 'radio' as const,
        checked: model.featureHeightSetting === 7 && model.noSpacing !== true,
        onClick: () => {
          model.setFeatureHeight(7)
          model.setNoSpacing(false)
        },
      },
      {
        label: 'Compact',
        type: 'radio' as const,
        checked:
          model.featureHeightSetting === 3 && model.noSpacingSetting === true,
        onClick: () => {
          model.setFeatureHeight(3)
          model.setNoSpacing(true)
        },
      },
      {
        label: 'Super-compact',
        type: 'radio' as const,
        checked:
          model.featureHeightSetting === 1 && model.noSpacingSetting === true,
        onClick: () => {
          model.setFeatureHeight(1)
          model.setNoSpacing(true)
        },
      },
      {
        label: 'Custom',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetFeatureHeightDialog,
            {
              model,
              handleClose,
            },
          ])
        },
      },
    ],
  }
}

interface ColorByModel {
  colorBy: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

export interface ColorByMenuOptions {
  showLinkedReads?: boolean
  includeModifications?: boolean
  includeTagOption?: boolean
  colorOptions?: { label: string; type: string }[]
}

const defaultColorOptions = [
  { label: 'Normal', type: 'normal' },
  { label: 'Strand', type: 'strand' },
  { label: 'Mapping quality', type: 'mappingQuality' },
  { label: 'Insert size', type: 'insertSize' },
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
    ...(modificationsItem ? [modificationsItem] : []),
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
  ]

  return {
    label: 'Color by...',
    subMenu,
  }
}

interface ShowMenuModel {
  showSoftClipping: boolean
  mismatchAlpha?: boolean
  showCoverage: boolean
  showArcs: boolean
  showSashimiArcs: boolean
  showMismatches: boolean
  showInterbaseIndicators: boolean
  showOutlineSetting: boolean
  showLinkedReads: boolean
  arcsState: {
    colorByType: string
    setColorByType: (
      type: 'insertSizeAndOrientation' | 'insertSize' | 'orientation',
    ) => void
  }
  toggleSoftClipping: () => void
  toggleMismatchAlpha: () => void
  setShowCoverage: (show: boolean) => void
  setShowArcs: (show: boolean) => void
  setShowSashimiArcs: (show: boolean) => void
  setShowMismatches: (show: boolean) => void
  setShowInterbaseIndicators: (show: boolean) => void
  setShowOutline: (show: boolean) => void
  setShowLinkedReads: (show: boolean) => void
}

export function getShowMenuItem(model: ShowMenuModel) {
  return {
    label: 'Show...',
    icon: VisibilityIcon,
    subMenu: [
      {
        label: 'Show soft clipping',
        type: 'checkbox' as const,
        checked: model.showSoftClipping,
        onClick: () => {
          model.toggleSoftClipping()
        },
      },
      {
        label: 'Show mismatches faded by quality',
        type: 'checkbox' as const,
        checked: !!model.mismatchAlpha,
        onClick: () => {
          model.toggleMismatchAlpha()
        },
      },
      {
        label: 'Show coverage',
        type: 'checkbox' as const,
        checked: model.showCoverage,
        onClick: () => {
          model.setShowCoverage(!model.showCoverage)
        },
      },
      {
        label: 'Show arcs',
        type: 'checkbox' as const,
        checked: model.showArcs,
        onClick: () => {
          model.setShowArcs(!model.showArcs)
        },
      },
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
          checked: model.arcsState.colorByType === type,
          onClick: () => {
            model.arcsState.setColorByType(type)
          },
        })),
      },
      {
        label: 'Show sashimi arcs',
        type: 'checkbox' as const,
        checked: model.showSashimiArcs,
        onClick: () => {
          model.setShowSashimiArcs(!model.showSashimiArcs)
        },
      },
      {
        label: 'Show mismatches',
        type: 'checkbox' as const,
        checked: model.showMismatches,
        onClick: () => {
          model.setShowMismatches(!model.showMismatches)
        },
      },
      {
        label: 'Show interbase indicators',
        type: 'checkbox' as const,
        checked: model.showInterbaseIndicators,
        onClick: () => {
          model.setShowInterbaseIndicators(!model.showInterbaseIndicators)
        },
      },
      {
        label: 'Show outline on reads',
        type: 'checkbox' as const,
        checked: model.showOutlineSetting,
        onClick: () => {
          model.setShowOutline(!model.showOutlineSetting)
        },
      },
      {
        label: 'Link paired/supplementary reads',
        type: 'checkbox' as const,
        checked: model.showLinkedReads,
        onClick: () => {
          model.setShowLinkedReads(!model.showLinkedReads)
        },
      },
    ],
  }
}

interface MaxHeightModel {
  maxHeight?: number
  setMaxHeight: (arg?: number) => void
}

export function getSetMaxHeightMenuItem(model: MaxHeightModel) {
  return {
    label: 'Set max track height...',
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        SetMaxHeightDialog,
        { model, handleClose },
      ])
    },
  }
}

interface SortByModel {
  setSortedBy: (type: string) => void
  clearSelected: () => void
}

export function getSortByMenuItem(model: SortByModel) {
  return {
    label: 'Sort by...',
    icon: SwapVertIcon,
    subMenu: [
      {
        label: 'Start location',
        onClick: () => {
          model.setSortedBy('position')
        },
      },
      {
        label: 'Read strand',
        onClick: () => {
          model.setSortedBy('strand')
        },
      },
      {
        label: 'Base pair',
        onClick: () => {
          model.setSortedBy('basePair')
        },
      },
      {
        label: 'Sort by tag...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SortByTagDialog,
            { model, handleClose },
          ])
        },
      },
      {
        label: 'Clear sort',
        onClick: () => {
          model.clearSelected()
        },
      },
    ],
  }
}

export function getGroupByMenuItem(model: IAnyStateTreeNode) {
  return {
    label: 'Group by...',
    icon: WorkspacesIcon,
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        GroupByDialog,
        { model, handleClose },
      ])
    },
  }
}

export function getMismatchDisplayMenuItem(model: MismatchDisplayModel) {
  return {
    label: 'Mismatch/indel display',
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Show all mismatches',
        type: 'radio' as const,
        checked:
          !model.hideMismatches &&
          !model.hideSmallIndels &&
          !model.hideLargeIndels,
        onClick: () => {
          model.setHideMismatches(false)
          model.setHideSmallIndels(false)
          model.setHideLargeIndels(false)
        },
      },
      {
        label: 'Show mismatches and large indels+clipping',
        type: 'radio' as const,
        checked:
          !model.hideMismatches &&
          model.hideSmallIndels &&
          !model.hideLargeIndels,
        onClick: () => {
          model.setHideMismatches(false)
          model.setHideSmallIndels(true)
          model.setHideLargeIndels(false)
        },
      },
      {
        label: 'Show just large indels',
        type: 'radio' as const,
        checked:
          model.hideMismatches &&
          model.hideSmallIndels &&
          !model.hideLargeIndels,
        onClick: () => {
          model.setHideMismatches(true)
          model.setHideSmallIndels(true)
          model.setHideLargeIndels(false)
        },
      },
      {
        label: 'Show none',
        type: 'radio' as const,
        checked:
          model.hideMismatches &&
          model.hideSmallIndels &&
          model.hideLargeIndels,
        onClick: () => {
          model.setHideMismatches(true)
          model.setHideSmallIndels(true)
          model.setHideLargeIndels(true)
        },
      },
    ],
  }
}
