import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

const SetFeatureHeightDialog = lazy(
  () => import('../components/SetFeatureHeightDialog.tsx'),
)
const SetMaxHeightDialog = lazy(
  () => import('../components/SetMaxHeightDialog.tsx'),
)

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
      {
        label: 'Normal',
        type: 'radio' as const,
        checked:
          model.featureHeightSetting === 7 && model.noSpacingSetting !== true,
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
