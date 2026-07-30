import { lazy } from 'react'

import { makeDisplayTypeDefaultControl } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import HeightIcon from '@mui/icons-material/Height'

import { COMPACTNESS_PRESETS } from './compactnessPresets.ts'
import { capitalizeFirst } from './menuHelpers.ts'

import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { HeightMode } from '@jbrowse/plugin-linear-genome-view'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)

// The preset vocabulary lives in a UI-free leaf module so non-UI readers (the
// website's figure recipes) can name a featureHeight by its menu label without
// importing React. Re-exported here, where it has always been imported from.
export {
  COMPACTNESS_PRESETS,
  NORMAL_PITCH,
  featureSpacingForHeight,
} from './compactnessPresets.ts'

// One menu, two independent radio groups: the pixel-size presets (+ Custom) and
// the fixed/grow/fit track-sizing modes. They're orthogonal axes — the size is
// what each read is drawn at (used in fixed and grow), the mode is how the track
// absorbs overflow — so picking a size never changes the mode and vice versa.
// Each group reads as a plain "pick one". `configuredFeatureHeight` drives the
// size group; `heightMode` the mode group.
interface FeatureHeightModel extends ResolvableDisplay {
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
    label: `${capitalizeFirst(noun)} height`,
    icon: HeightIcon,
    type: 'subMenu' as const,
    disabled: opts?.disabled,
    disabledHelpText: opts?.disabledHelpText,
    subMenu: [
      // Size presets: each writes its exact height (preserving grow, dropping fit
      // back to fixed); the pin promotes that height as the session default. The
      // rows stay open (promotableRadioItem's default) so size + mode can both be
      // set in one visit.
      ...Object.values(COMPACTNESS_PRESETS).map(preset =>
        promotableRadioItem({
          label: preset.label,
          checked: sizeActive && matchesPreset(preset),
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
      // The fixed/grow/fit modes as an explicit radio group, from the same
      // shared builder the canvas display uses so the two menus are identical by
      // construction. The `fixed` mode is its own row — not folded into the size
      // presets — so this group stays a plain, complete "pick one".
      ...heightModeMenuItems(model, noun),
    ],
  }
}
