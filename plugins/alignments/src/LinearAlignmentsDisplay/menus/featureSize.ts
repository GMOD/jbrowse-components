import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import HeightIcon from '@mui/icons-material/Height'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)
const SetMaxHeightDialog = lazy(
  () => import('../dialogs/SetMaxHeightDialog.tsx'),
)

// Single source of truth for the (featureHeight, featureSpacing) pairs that
// the feature-height menu and the LGV/comparative-view setCompactness API
// both drive. Both the menu radios' `checked` state and `setCompactness`
// derive from this — adding a preset means updating one place.
//
// 'Normal' matches the config-schema defaults (featureHeight=7, featureSpacing=1)
// so a fresh display with no overrides reads as Normal-checked and clicking
// Normal is a no-op.
export const COMPACTNESS_PRESETS = {
  normal: { label: 'Normal', featureHeight: 7, featureSpacing: 1 },
  compact: { label: 'Compact', featureHeight: 3, featureSpacing: 0 },
  'super-compact': {
    label: 'Super-compact',
    featureHeight: 1,
    featureSpacing: 0,
  },
} as const

export type CompactnessLevel = keyof typeof COMPACTNESS_PRESETS

interface FeatureHeightModel {
  featureHeight: number
  featureSpacing: number
  maxHeight: number
  isCompactnessDefault: boolean
  setFeatureHeight: (height?: number) => void
  setFeatureSpacing: (spacing?: number) => void
  setMaxHeight: (height?: number) => void
  toggleCompactnessDefault: () => void
}

export function getFeatureHeightMenuItem(model: FeatureHeightModel) {
  return {
    label: 'Set feature height...',
    icon: HeightIcon,
    type: 'subMenu' as const,
    subMenu: [
      ...Object.values(COMPACTNESS_PRESETS).map(preset => ({
        label: preset.label,
        type: 'radio' as const,
        checked:
          model.featureHeight === preset.featureHeight &&
          model.featureSpacing === preset.featureSpacing,
        onClick: () => {
          model.setFeatureHeight(preset.featureHeight)
          model.setFeatureSpacing(preset.featureSpacing)
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
      {
        label: 'Use current height by default on all alignments tracks',
        type: 'checkbox' as const,
        checked: model.isCompactnessDefault,
        onClick: () => {
          model.toggleCompactnessDefault()
        },
      },
      {
        label: 'Set max layout height...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetMaxHeightDialog,
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
