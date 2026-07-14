import { lazy } from 'react'

import { makeSlotsValueDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import HeightIcon from '@mui/icons-material/Height'

import type { PromotableDisplay } from '@jbrowse/core/configuration'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)

// Single source of truth for the read-height presets the feature-height menu
// drives — one height each (spacing is derived from it). Both the radios'
// `checked` state and their onClick derive from this, so adding a preset means
// updating one place.
//
// 'Normal' (7) is the resolved base of the featureHeight sentinel slot (its
// promotedBase), so a fresh display with no overrides reads as Normal-checked.
// Clicking any preset — Normal included — writes its exact height, which
// customizes the track (the slot is sentinel maybeNumber, so 7 is a real
// customizable value, not the inherit signal). That's what lets Normal win over
// a Compact session default; a plain-number slot would strip 7 to the default
// and re-inherit Compact. Mirrors how the sibling heightMode radio writes
// 'fixed' (its promotedBase) explicitly. See promotableDefaults.ts.
export const COMPACTNESS_PRESETS = {
  normal: { label: 'Normal', featureHeight: 7 },
  compact: { label: 'Compact', featureHeight: 3 },
  'super-compact': { label: 'Super-compact', featureHeight: 1 },
} as const

// This menu is only the per-read SIZE axis (the height/spacing presets); the
// container-sizing axis is the sibling "Track sizing" entry built by the shared
// getTrackSizingMenuItem. PromotableDisplay carries the pin plumbing
// makeSlotsValueDisplayTypeDefaultControl needs.
interface FeatureHeightModel extends PromotableDisplay {
  featureHeight: number
  configuredFeatureHeight: number
  fitHeightToDisplay: boolean
  autoHeight: boolean
  setFeatureHeight: (height?: number) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel,
  opts?: { disabled?: boolean; disabledHelpText?: string },
) {
  // A fixed per-feature height is active (vs the grow/fit container modes) only
  // when neither auto-sizing flag is set; the preset radios and the Custom radio
  // are all meaningless otherwise, so they check against this.
  const fixedHeight = !model.fitHeightToDisplay && !model.autoHeight
  const matchesPreset = (preset: { featureHeight: number }) =>
    model.featureHeight === preset.featureHeight
  return {
    label: 'Read height',
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
          checked: fixedHeight && matchesPreset(preset),
          onClick: () => {
            model.setFeatureHeight(preset.featureHeight)
          },
          displayTypeDefault: makeSlotsValueDisplayTypeDefaultControl(model, [
            { slot: 'featureHeight', value: preset.featureHeight },
            { slot: 'heightMode', value: 'fixed' },
          ]),
        }),
      ),
      // Custom sits with the presets as a peer radio: it writes a raw
      // featureHeight, and is checked when a fixed height is active but matches
      // none of the presets — otherwise a custom value would leave the whole
      // group unchecked with no cue.
      {
        label: 'Custom...',
        type: 'radio' as const,
        checked:
          fixedHeight &&
          !Object.values(COMPACTNESS_PRESETS).some(matchesPreset),
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
