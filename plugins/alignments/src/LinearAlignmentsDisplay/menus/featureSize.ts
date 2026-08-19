import { lazy } from 'react'

import { makePin } from '@jbrowse/core/configuration'
import { promotableRadioItem } from '@jbrowse/core/ui/menuItems'
import { capitalizeFirst, getSession } from '@jbrowse/core/util'
import { heightModeMenuItems } from '@jbrowse/plugin-linear-genome-view'
import HeightIcon from '@mui/icons-material/Height'

import { COMPACTNESS_PRESETS } from './compactnessPresets.ts'

import type { LinearAlignmentsDisplayConfigSchema } from '../configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { HeightMode } from '@jbrowse/plugin-linear-genome-view'

const SetFeatureHeightDialog = lazy(
  () => import('../dialogs/SetFeatureHeightDialog.tsx'),
)
const SetMaxHeightDialog = lazy(
  () => import('../dialogs/SetMaxHeightDialog.tsx'),
)

interface MaxHeightModel {
  maxHeight: number
  setMaxHeight: (height?: number) => void
}

// The pileup row cap: how tall the stack may grow before reads are dropped.
// Sizing, so it belongs to this menu — it used to sit in "Show...", where it was
// the one action among a dozen checkboxes and the only reason that menu needed a
// divider. Still exported because it's the same helper on both displays.
export function getMaxHeightMenuItem(model: MaxHeightModel) {
  return {
    label: 'Set max layout height...',
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        SetMaxHeightDialog,
        { model, handleClose },
      ])
    },
  }
}

const PRESETS = Object.values(COMPACTNESS_PRESETS)

// Rows that need laid-out content to act on, greyed out together.
//
// A helper rather than two fields spread at each site: which rows are
// content-dependent is then a list of `needsContent(...)` calls a reader can
// scan, and the gate can't be half-applied (a `disabled` without its
// `disabledHelpText` is a row that greys out and won't say why). Takes the whole
// gate so an enabled menu passes `undefined` for both by construction.
interface ContentGate {
  disabled?: boolean
  disabledHelpText?: string
}
function needsContent<T extends MenuItem>(item: T, gate: ContentGate): T {
  return {
    ...item,
    disabled: gate.disabled,
    disabledHelpText: gate.disabledHelpText,
  }
}

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
//
// `type` + `configuration` spelled out rather than `extends ResolvableDisplay`:
// that is an intersection alias whose `configuration` is `AnyConfigurationModel`,
// which switches off the slot-name check on the `makePin` below. Same reason,
// and the same spelling, as `ConfigSlotSelf` in this display.
interface FeatureHeightModel extends IStateTreeNode, MaxHeightModel {
  type: string
  configuration: Instance<LinearAlignmentsDisplayConfigSchema>
  configuredFeatureHeight: number
  heightMode: HeightMode
  setFeatureHeight: (height?: number) => void
  setHeightMode: (mode: HeightMode) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel,
  noun: string,
  // Greys out the rows that need something laid out to act on — the size
  // presets and the row cap (see `needsContent`). Deliberately NOT applied to
  // the parent submenu: "Track sizing" below is about how the TRACK absorbs its
  // content, and grow still fits the track to a pileup-less stack
  // (`growTargetHeight` collapses to the coverage bands), so disabling the whole
  // menu took the one control that helps a coverage-only track with it. The
  // canvas display's twin (`featureHeightMenuItems`) disables neither half.
  gate: ContentGate = {},
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
    subMenu: [
      // Size presets: each writes its exact height (preserving grow, dropping fit
      // back to fixed); the pin promotes that height as the session default. The
      // rows stay open (promotableRadioItem's default) so size + mode can both be
      // set in one visit.
      ...PRESETS.map(preset =>
        needsContent(
          promotableRadioItem({
            label: preset.label,
            checked: sizeActive && matchesPreset(preset),
            onClick: () => {
              model.setFeatureHeight(preset.featureHeight)
            },
            pin: makePin(model, 'featureHeight', preset.featureHeight),
          }),
          gate,
        ),
      ),
      // Custom is a peer radio in the size group: checked when the size matches
      // no preset. It opens a dialog, so it closes the menu.
      needsContent(
        {
          label: 'Custom...',
          type: 'radio' as const,
          checked: sizeActive && !PRESETS.some(matchesPreset),
          keepMenuOpen: false,
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
        gate,
      ),
      { type: 'subHeader' as const, label: 'Track sizing' },
      // The fixed/grow/fit modes as an explicit radio group, from the same
      // shared builder the canvas display uses so the two menus are identical by
      // construction. The `fixed` mode is its own row — not folded into the size
      // presets — so this group stays a plain, complete "pick one". Never
      // greyed out: see the note on `gate`.
      ...heightModeMenuItems(model, noun),
      // The row cap is the third sizing axis (how many rows, vs how tall each
      // read and how the track absorbs them), so it closes this menu rather
      // than sitting among the "Show..." checkboxes. Rows-dependent, so it
      // greys out with the size presets.
      needsContent(getMaxHeightMenuItem(model), gate),
    ],
  }
}
