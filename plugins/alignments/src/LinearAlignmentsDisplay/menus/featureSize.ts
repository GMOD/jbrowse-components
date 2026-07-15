import { lazy } from 'react'

import { makeDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getHeightModeOptions } from '@jbrowse/plugin-linear-genome-view'
import HeightIcon from '@mui/icons-material/Height'

import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { HeightMode } from '@jbrowse/plugin-linear-genome-view'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)

// Single source of truth for the fixed read-height presets — one height each
// (spacing is derived from it). Both the radios' `checked` state and their
// onClick derive from this, so adding a preset means updating one place.
//
// 'Normal' (7) is the resolved base of the featureHeight sentinel slot (its
// promotedBase), so a fresh display with no overrides reads as Normal-checked.
// Clicking any preset — Normal included — writes its exact height, which
// customizes the track (the slot is sentinel maybeNumber, so 7 is a real
// customizable value, not the inherit signal). That's what lets Normal win over
// a Compact session default; a plain-number slot would strip 7 to the default
// and re-inherit Compact. See promotableDefaults.ts.
export const COMPACTNESS_PRESETS = {
  normal: { label: 'Normal', featureHeight: 7 },
  compact: { label: 'Compact', featureHeight: 3 },
  'super-compact': { label: 'Super-compact', featureHeight: 1 },
} as const

// The one rule turning a read size into its inter-read gap: a 1px gap once
// there's room for a >2px body, else flush. Spacing is derived, never stored, so
// this is the single source both the `featureSpacing` getter (fixed body / fit
// pitch) and the fit cap (`normal pitch = body + gap`) key off — encoding it once
// keeps the presets and the fit squeeze from disagreeing.
export function featureSpacingForHeight(height: number) {
  return height > 3 ? 1 : 0
}

// The pitch a Normal read occupies (body + its derived gap). The fit squeeze
// caps here so choosing "fit" only ever shrinks reads below Normal, never
// balloons a handful past it.
export const NORMAL_PITCH =
  COMPACTNESS_PRESETS.normal.featureHeight +
  featureSpacingForHeight(COMPACTNESS_PRESETS.normal.featureHeight)

// One menu, two independent radio groups: the pixel-size presets (+ Custom) and
// the fixed/grow/fit track-sizing modes. They're orthogonal axes — the size is
// what each read is drawn at (used in fixed and grow), the mode is how the track
// absorbs overflow — so picking a size never changes the mode and vice versa.
// Each group reads as a plain "pick one". `configuredFeatureHeight` drives the
// size group; `heightMode` the mode group.
interface FeatureHeightModel extends PromotableDisplay {
  configuredFeatureHeight: number
  heightMode: HeightMode
  setFeatureHeight: (height?: number) => void
  setHeightMode: (mode: HeightMode) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel,
  noun: string,
  opts?: { disabled?: boolean; disabledHelpText?: string },
) {
  const mode = model.heightMode
  // fit derives the size, so no size reads as selected while fitting; picking one
  // drops back to fixed (setFeatureHeight) and then lights up.
  const sizeActive = mode !== 'fit'
  const height = model.configuredFeatureHeight
  const matchesPreset = (preset: { featureHeight: number }) =>
    height === preset.featureHeight
  return {
    label: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} height`,
    icon: HeightIcon,
    type: 'subMenu' as const,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: [
      // Size presets: each writes its exact height (preserving grow, dropping fit
      // back to fixed); the pin promotes that height as the session default.
      // keepMenuOpen so size + mode can be set in one open menu.
      ...Object.values(COMPACTNESS_PRESETS).map(preset =>
        promotableRadioItem({
          label: preset.label,
          checked: sizeActive && matchesPreset(preset),
          keepMenuOpen: true,
          onClick: () => {
            model.setFeatureHeight(preset.featureHeight)
          },
          displayTypeDefault: makeDisplayTypeDefaultControl(
            model,
            'featureHeight',
            preset.featureHeight,
          ),
        }),
      ),
      // Custom is a peer radio in the size group: checked when the size matches
      // no preset. It opens a dialog, so it closes the menu.
      {
        label: 'Custom...',
        type: 'radio' as const,
        checked:
          sizeActive && !Object.values(COMPACTNESS_PRESETS).some(matchesPreset),
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
      { type: 'subHeader' as const, label: 'Track sizing' },
      // The fixed/grow/fit modes as an explicit radio group, mirroring the
      // sidebar TrackHeightIndicator (labels from the shared getHeightModeOptions
      // so they can't drift). 'Fixed read height' is its own row — not folded
      // into the size presets — so this group stays a plain, complete "pick one".
      ...getHeightModeOptions(noun).map(option =>
        promotableRadioItem({
          label: option.label,
          checked: mode === option.value,
          keepMenuOpen: true,
          onClick: () => {
            model.setHeightMode(option.value)
          },
          displayTypeDefault: makeDisplayTypeDefaultControl(
            model,
            'heightMode',
            option.value,
          ),
        }),
      ),
    ],
  }
}
