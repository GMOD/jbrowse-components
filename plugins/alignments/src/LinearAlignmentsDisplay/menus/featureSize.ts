import { lazy } from 'react'

import { makeSlotsValueSessionDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import HeightIcon from '@mui/icons-material/Height'

import type { PromotableDisplay } from '@jbrowse/core/configuration'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
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
  fitHeightToDisplay: boolean
  setFeatureHeight: (height?: number) => void
  setFeatureSpacing: (spacing?: number) => void
  setFitHeightToDisplay: (fit: boolean) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel & PromotableDisplay,
  opts?: { disabled?: boolean; disabledHelpText?: string },
) {
  return {
    label: 'Set feature height...',
    icon: HeightIcon,
    type: 'subMenu' as const,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: [
      // Each preset row carries its own pin (endAdornment): the value radio
      // selects the height, the pin promotes that exact preset as the
      // session-wide default for this display type — the same discoverable
      // per-row control every other promotable setting uses, replacing the
      // former standalone "Use X as the default" checkbox.
      ...Object.values(COMPACTNESS_PRESETS).map(preset =>
        promotableRadioItem({
          label: preset.label,
          checked:
            !model.fitHeightToDisplay &&
            model.featureHeight === preset.featureHeight &&
            model.featureSpacing === preset.featureSpacing,
          onClick: () => {
            model.setFeatureHeight(preset.featureHeight)
            model.setFeatureSpacing(preset.featureSpacing)
          },
          sessionDefault: makeSlotsValueSessionDefaultControl(model, [
            { slot: 'featureHeight', value: preset.featureHeight },
            { slot: 'featureSpacing', value: preset.featureSpacing },
            { slot: 'heightMode', value: 'fixed' },
          ]),
        }),
      ),
      promotableRadioItem({
        label: 'Fit to display height',
        checked: model.fitHeightToDisplay,
        onClick: () => {
          model.setFitHeightToDisplay(true)
        },
        sessionDefault: makeSlotsValueSessionDefaultControl(model, [
          { slot: 'heightMode', value: 'fit' },
        ]),
      }),
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
