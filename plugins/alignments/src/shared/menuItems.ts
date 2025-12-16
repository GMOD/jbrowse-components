import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilterListIcon from '@mui/icons-material/ClearAll'
import PaletteIcon from '@mui/icons-material/Palette'

import { modificationData } from './modificationData'

import type { ColorBy } from './types'

const FilterByTagDialog = lazy(() => import('./components/FilterByTagDialog'))
const SetModificationThresholdDialog = lazy(
  () => import('./components/SetModificationThresholdDialog'),
)

interface LinearReadDisplayModel {
  setColorScheme: (colorBy: ColorBy) => void
}

interface LinearReadDisplayModelWithModifications extends LinearReadDisplayModel {
  modificationsReady: boolean
  visibleModificationTypes: string[]
  modificationThreshold: number
  colorBy?: ColorBy
}

function hasModificationsSupport(
  model: LinearReadDisplayModel,
): model is LinearReadDisplayModelWithModifications {
  return 'modificationsReady' in model && 'visibleModificationTypes' in model
}

function getModificationsSubMenu(model: LinearReadDisplayModelWithModifications) {
  if (!model.modificationsReady) {
    return [
      {
        label: 'Loading modifications...',
        onClick: () => {},
      },
    ]
  }

  return [
    {
      label: `All modifications (>= ${model.modificationThreshold}% prob)`,
      onClick: () => {
        model.setColorScheme({
          type: 'modifications',
          modifications: {
            threshold: model.modificationThreshold,
          },
        })
      },
    },
    ...model.visibleModificationTypes.map(key => ({
      label: `Show only ${modificationData[key]?.name || key} (>= ${model.modificationThreshold}% prob)`,
      onClick: () => {
        model.setColorScheme({
          type: 'modifications',
          modifications: {
            isolatedModification: key,
            threshold: model.modificationThreshold,
          },
        })
      },
    })),
    { type: 'divider' as const },
    {
      label: 'All modifications (<50% prob colored blue)',
      onClick: () => {
        model.setColorScheme({
          type: 'modifications',
          modifications: {
            twoColor: true,
            threshold: model.modificationThreshold,
          },
        })
      },
    },
    ...model.visibleModificationTypes.map(key => ({
      label: `Show only ${modificationData[key]?.name || key} (<50% prob colored blue)`,
      onClick: () => {
        model.setColorScheme({
          type: 'modifications',
          modifications: {
            isolatedModification: key,
            twoColor: true,
            threshold: model.modificationThreshold,
          },
        })
      },
    })),
    { type: 'divider' as const },
    {
      label: `Adjust threshold (${model.modificationThreshold}%)`,
      onClick: () => {
        // @ts-expect-error getSession works on model
        getSession(model).queueDialog((handleClose: () => void) => [
          SetModificationThresholdDialog,
          { model, handleClose },
        ])
      },
    },
  ]
}

/**
 * Shared color scheme menu items for all LinearRead displays
 */
export function getColorSchemeMenuItem(model: LinearReadDisplayModel) {
  const baseItems = [
    {
      label: 'Insert size ± 3σ and orientation',
      onClick: () => {
        model.setColorScheme({ type: 'insertSizeAndOrientation' })
      },
    },
    {
      label: 'Insert size ± 3σ',
      onClick: () => {
        model.setColorScheme({ type: 'insertSize' })
      },
    },
    {
      label: 'Orientation',
      onClick: () => {
        model.setColorScheme({ type: 'orientation' })
      },
    },
    {
      label: 'Insert size gradient',
      onClick: () => {
        model.setColorScheme({ type: 'gradient' })
      },
    },
  ]

  const modificationsItem = hasModificationsSupport(model)
    ? [
        {
          label: 'Modifications',
          type: 'subMenu' as const,
          subMenu: getModificationsSubMenu(model),
        },
      ]
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
    icon: FilterListIcon,
    onClick: () => {
      // @ts-expect-error getSession works on model
      getSession(model).queueDialog((handleClose: () => void) => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  }
}
