import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { COMPACTNESS_PRESETS, getSetMaxHeightMenuItem } from './featureSize.ts'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)

interface ReadsModel {
  featureHeightSetting: number
  featureSpacing: number
  setFeatureHeight: (height?: number) => void
  setFeatureSpacing: (spacing?: number) => void

  maxHeight?: number
  setMaxHeight: (arg?: number) => void

  showMismatches: boolean
  setShowMismatches: (show: boolean) => void
  showSoftClipping: boolean
  toggleSoftClipping: () => void
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (show: boolean) => void

  mismatchAlpha: boolean
  toggleMismatchAlpha: () => void

  showOutlineSetting: boolean
  setShowOutline: (v: boolean | undefined) => void

  flipStrandLongReadChains: boolean
  setFlipStrandLongReadChains: (flag: boolean) => void
}

export function getReadsMenuItem(model: ReadsModel) {
  return {
    label: 'Reads',
    icon: VisibilityIcon,
    type: 'subMenu' as const,
    subMenu: [
      ...Object.values(COMPACTNESS_PRESETS).map(preset => ({
        label: preset.label,
        type: 'radio' as const,
        checked:
          model.featureHeightSetting === preset.featureHeight &&
          model.featureSpacing === preset.featureSpacing,
        onClick: () => {
          model.setFeatureHeight(preset.featureHeight)
          model.setFeatureSpacing(preset.featureSpacing)
        },
      })),
      {
        label: 'Custom height...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetFeatureHeightDialog,
            { model, handleClose },
          ])
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
        label: 'Show soft clipping',
        type: 'checkbox' as const,
        checked: model.showSoftClipping,
        onClick: () => {
          model.toggleSoftClipping()
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
        label: 'Fade mismatches by base quality',
        type: 'checkbox' as const,
        checked: model.mismatchAlpha,
        onClick: () => {
          model.toggleMismatchAlpha()
        },
      },
      {
        label: 'Show outlines',
        type: 'checkbox' as const,
        checked: model.showOutlineSetting,
        onClick: () => {
          model.setShowOutline(!model.showOutlineSetting)
        },
      },
      {
        label: 'Color supplementary segments by primary strand',
        type: 'checkbox' as const,
        checked: model.flipStrandLongReadChains,
        onClick: () => {
          model.setFlipStrandLongReadChains(!model.flipStrandLongReadChains)
        },
      },
      getSetMaxHeightMenuItem(model),
    ],
  }
}
