import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

const SetFeatureHeightDialog = lazy(
  () => import('../components/SetFeatureHeightDialog.tsx'),
)
const SetMaxHeightDialog = lazy(
  () => import('../components/SetMaxHeightDialog.tsx'),
)

// Single source of truth for the {featureHeight, noSpacing} pairs that the
// feature-height menu and the LGV/comparative-view setCompactness API both
// drive. Both the menu radios' `checked` state and `setCompactness` derive
// from this — adding a preset means updating one place.
export const COMPACTNESS_PRESETS = {
  normal: { label: 'Normal', featureHeight: 7, noSpacing: false },
  compact: { label: 'Compact', featureHeight: 3, noSpacing: true },
  'super-compact': {
    label: 'Super-compact',
    featureHeight: 1,
    noSpacing: true,
  },
} as const

export type CompactnessLevel = keyof typeof COMPACTNESS_PRESETS

interface FeatureHeightModel {
  featureHeightSetting: number
  noSpacingSetting?: boolean
  setFeatureHeight: (height?: number) => void
  setNoSpacing: (noSpacing?: boolean) => void
}

export function getFeatureHeightMenuItem(model: FeatureHeightModel) {
  return {
    label: 'Set feature height...',
    type: 'subMenu' as const,
    subMenu: [
      ...Object.values(COMPACTNESS_PRESETS).map(preset => ({
        label: preset.label,
        type: 'radio' as const,
        checked:
          model.featureHeightSetting === preset.featureHeight &&
          (model.noSpacingSetting ?? false) === preset.noSpacing,
        onClick: () => {
          model.setFeatureHeight(preset.featureHeight)
          model.setNoSpacing(preset.noSpacing)
        },
      })),
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
        {
          model,
          handleClose,
        },
      ])
    },
  }
}
