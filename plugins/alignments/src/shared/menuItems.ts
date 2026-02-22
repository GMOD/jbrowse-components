import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import PaletteIcon from '@mui/icons-material/Palette'

import { modificationData } from './modificationData.ts'

import type { ColorBy } from './types.ts'

const FilterByTagDialog = lazy(
  () => import('./components/FilterByTagDialog.tsx'),
)
const SetModificationThresholdDialog = lazy(
  () => import('./components/SetModificationThresholdDialog.tsx'),
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

export function hasModificationsSupport(
  model: LinearReadDisplayModel,
): model is ModificationsModel {
  return 'modificationsReady' in model && 'visibleModificationTypes' in model
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

export function getModificationsMenuItem(
  model: ModificationsModel,
  options: ModificationsMenuOptions = {},
) {
  return {
    label: 'Modifications',
    type: 'subMenu' as const,
    subMenu: getModificationsSubMenu(model, options),
  }
}

/**
 * Shared color scheme menu items for all LinearRead displays
 */
export function getColorSchemeMenuItem(model: LinearReadDisplayModel) {
  const { type } = model.colorBy || {}
  const baseItems = [
    {
      label: 'Insert size ± 3σ and orientation',
      type: 'radio' as const,
      checked: type === 'insertSizeAndOrientation',
      onClick: () => {
        model.setColorScheme({ type: 'insertSizeAndOrientation' })
      },
    },
    {
      label: 'Insert size ± 3σ',
      type: 'radio' as const,
      checked: type === 'insertSize',
      onClick: () => {
        model.setColorScheme({ type: 'insertSize' })
      },
    },
    {
      label: 'Orientation',
      type: 'radio' as const,
      checked: type === 'orientation',
      onClick: () => {
        model.setColorScheme({ type: 'orientation' })
      },
    },
    {
      label: 'Insert size gradient',
      type: 'radio' as const,
      checked: type === 'gradient',
      onClick: () => {
        model.setColorScheme({ type: 'gradient' })
      },
    },
  ]

  const modificationsItem =
    hasModificationsSupport(model) && model.visibleModificationTypes.length > 0
      ? [getModificationsMenuItem(model)]
      : []

  return {
    label: 'Color scheme',
    icon: PaletteIcon,
    subMenu: [...baseItems, ...modificationsItem],
  }
}

/**
 * Shared filter by menu item for all LinearRead displays
 */
export function getFilterByMenuItem(model: unknown) {
  return {
    label: 'Filter by',
    icon: ClearAllIcon,
    onClick: () => {
      // @ts-expect-error getSession works on model
      getSession(model).queueDialog((handleClose: () => void) => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  }
}

interface EditFiltersModel {
  drawSingletons: boolean
  drawProperPairs: boolean
  setDrawSingletons: (arg: boolean) => void
  setDrawProperPairs: (arg: boolean) => void
}

/**
 * Edit filters submenu for LinearReadCloudDisplay
 */
export function getEditFiltersMenuItem(model: EditFiltersModel) {
  return {
    label: 'Edit filters',
    icon: ClearAllIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Show singletons',
        type: 'checkbox' as const,
        checked: model.drawSingletons,
        onClick: () => {
          model.setDrawSingletons(!model.drawSingletons)
        },
      },
      {
        label: 'Show proper pairs',
        type: 'checkbox' as const,
        checked: model.drawProperPairs,
        onClick: () => {
          model.setDrawProperPairs(!model.drawProperPairs)
        },
      },
      { type: 'divider' as const },
      {
        label: 'Edit filters...',
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

/**
 * Shared mismatch/indel display submenu for pileup and read cloud displays
 */
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
