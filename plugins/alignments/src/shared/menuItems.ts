import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'

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
