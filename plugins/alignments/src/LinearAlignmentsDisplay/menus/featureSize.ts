import { lazy } from 'react'

import { makeSlotsValueSessionDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import HeightIcon from '@mui/icons-material/Height'

import type { HeightModeMenuModel } from '@jbrowse/plugin-linear-genome-view'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)

// Single source of truth for the (featureHeight, featureSpacing) pairs the
// feature-height menu drives. Both the menu radios' `checked` state and their
// onClick derive from this — adding a preset means updating one place.
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

// Extends HeightModeMenuModel (heightMode + setHeightMode + PromotableDisplay),
// so passing the model straight to the shared heightModeMenuItems builder
// typechecks without re-listing those members.
interface FeatureHeightModel extends HeightModeMenuModel {
  featureHeight: number
  featureSpacing: number
  fitHeightToDisplay: boolean
  autoHeight: boolean
  setFeatureHeight: (height?: number) => void
  setFeatureSpacing: (spacing?: number) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel,
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
            !model.autoHeight &&
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
      { type: 'divider' as const },
      // The container-sizing strategy (fixed/grow/fit) lives under a nested
      // "Track height" entry with effect-describing labels, mirroring the canvas
      // display so the two present an identical menu. The shared
      // heightModeMenuItems builder makes the radios identical by construction —
      // same labels, checked/onClick wiring, and per-mode session-default pin.
      {
        label: 'Track height',
        subMenu: heightModeMenuItems(model, 'reads'),
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
