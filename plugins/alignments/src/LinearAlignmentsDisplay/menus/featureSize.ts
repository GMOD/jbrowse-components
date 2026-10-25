import { lazy } from 'react'

import { radioItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { capitalizeFirst, getDialogHost } from '@jbrowse/core/util'
import HeightIcon from '@mui/icons-material/Height'

import {
  COMPACTNESS_PRESETS,
  FIT_TO_TRACK_LABEL,
} from './compactnessPresets.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { HeightMode } from '@jbrowse/display-kit/heightMode'

const PixelHeightDialog = lazy(() => import('../dialogs/PixelHeightDialog.tsx'))

interface MaxHeightModel {
  pileupMaxLayoutHeight: number
  setPileupMaxLayoutHeight: (height?: number) => void
}

// The pileup row cap: how tall the stack may grow before reads are dropped.
function getMaxHeightMenuItem(model: MaxHeightModel) {
  return {
    label: 'Set max layout height...',
    onClick: () => {
      getDialogHost(model).queueDialog(handleClose => [
        PixelHeightDialog,
        {
          title: 'Set max layout height',
          description:
            'Maximum pixel height of the pileup layout. Reads that pile up beyond this are not stacked; the coverage histogram still reflects the true depth. Raise it for very deep targeted-sequencing data.',
          label: 'Max layout height (px)',
          initialValue: model.pileupMaxLayoutHeight,
          onSubmit: (height: number) => {
            model.setPileupMaxLayoutHeight(height)
          },
          handleClose,
        },
      ])
    },
  }
}

const PRESETS = Object.values(COMPACTNESS_PRESETS)

// Greys out a menu that needs laid-out content to act on, saying why.
interface ContentGate {
  disabled?: boolean
  disabledHelpText?: string
}

// The preset vocabulary lives in a UI-free leaf module so non-UI readers (the
// website's figure recipes) can name a featureHeight by its menu label without
// importing React. Re-exported here, where it has always been imported from.
export {
  COMPACTNESS_PRESETS,
  FIT_TO_TRACK_LABEL,
  NORMAL_PITCH,
  featureSpacingForHeight,
} from './compactnessPresets.ts'

// One radio group of sizes: the pixel-size presets and Custom. The tick is the
// configured size, which a fit to the track height overrides while it lasts;
// picking a size drops back to fixed (`setReadHeight`). The height modes
// (fixed, autogrow, fit) and the row cap sit in "Advanced", from
// `getTrackSizingItems`.
interface FeatureHeightModel {
  configuredReadHeight: number
  heightMode: HeightMode
  setReadHeight: (height?: number) => void
  setHeightMode: (mode: HeightMode) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel,
  noun: string,
  gate: ContentGate = {},
) {
  const height = model.configuredReadHeight
  const matchesPreset = (preset: { height: number }) => height === preset.height
  return {
    label: `${capitalizeFirst(noun)} height`,
    icon: HeightIcon,
    type: 'subMenu' as const,
    ...gate,
    subMenu: [
      ...PRESETS.map(preset =>
        radioItem(preset.label, matchesPreset(preset), () => {
          model.setReadHeight(preset.height)
        }),
      ),
      {
        label: 'Custom...',
        type: 'radio' as const,
        checked: !PRESETS.some(matchesPreset),
        keepMenuOpen: false,
        onClick: () => {
          // Seeded from the configured (fixed-mode) size, not the resolved
          // `featureHeight`, which in fit mode is the fractional fit pitch.
          getDialogHost(model).queueDialog(handleClose => [
            PixelHeightDialog,
            {
              title: `Custom ${noun} height`,
              description: `Adjust the ${noun} height. The spacing between ${noun}s is derived from it — a 1px gap once ${noun}s are tall enough, otherwise flush. Setting the height to 1 makes the display very compact.`,
              label: `${capitalizeFirst(noun)} height (px)`,
              initialValue: model.configuredReadHeight,
              onSubmit: (height: number) => {
                model.setReadHeight(height)
              },
              handleClose,
            },
          ])
        },
      },
    ],
  }
}

export const TRACK_HEIGHT_LABEL = 'Track height'

const TRACK_HEIGHT_OPTIONS: { value: HeightMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'grow', label: 'Autogrow' },
  { value: 'fit', label: FIT_TO_TRACK_LABEL },
]

/**
 * The track-sizing rows for "Advanced": the height mode as one radio group,
 * and the row cap.
 * Autogrow is offered without content, since grow still fits the track to a
 * pileup-less stack (`growTargetHeight` collapses to the coverage bands); the
 * row cap only while there are rows.
 */
export function getTrackSizingItems(
  model: FeatureHeightModel & MaxHeightModel,
  gate: ContentGate = {},
): MenuItem[] {
  return [
    {
      label: TRACK_HEIGHT_LABEL,
      type: 'subMenu' as const,
      subMenu: radioItems(TRACK_HEIGHT_OPTIONS, model.heightMode, mode => {
        model.setHeightMode(mode)
      }),
    },
    ...(gate.disabled ? [] : [getMaxHeightMenuItem(model)]),
  ]
}
