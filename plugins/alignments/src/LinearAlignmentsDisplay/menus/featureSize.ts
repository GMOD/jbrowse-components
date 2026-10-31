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
    label: 'Max layout height...',
    onClick: () => {
      getDialogHost(model).queueDialog(handleClose => [
        PixelHeightDialog,
        {
          title: 'Max layout height',
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

// One radio group: the pixel-size presets, Custom, and fitting the reads to
// the track. Picking a size drops back to fixed (`setMarkHeight`).
interface FeatureHeightModel {
  markHeight: number
  heightMode: HeightMode
  setMarkHeight: (height?: number) => void
  setHeightMode: (mode: HeightMode) => void
}

export function getFeatureHeightMenuItem(
  model: FeatureHeightModel,
  noun: string,
  gate: ContentGate = {},
) {
  const fit = model.heightMode === 'fit'
  const height = model.markHeight
  const matchesPreset = (preset: { height: number }) => height === preset.height
  return {
    label: `${capitalizeFirst(noun)} height`,
    icon: HeightIcon,
    type: 'subMenu' as const,
    ...gate,
    subMenu: [
      ...PRESETS.map(preset =>
        radioItem(preset.label, !fit && matchesPreset(preset), () => {
          model.setMarkHeight(preset.height)
        }),
      ),
      {
        label: 'Custom...',
        type: 'radio' as const,
        checked: !fit && !PRESETS.some(matchesPreset),
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
              initialValue: model.markHeight,
              onSubmit: (height: number) => {
                model.setMarkHeight(height)
              },
              handleClose,
            },
          ])
        },
      },
      radioItem(FIT_TO_TRACK_LABEL, fit, () => {
        model.setHeightMode('fit')
      }),
    ],
  }
}

export const TRACK_HEIGHT_LABEL = 'Track height'

const TRACK_HEIGHT_OPTIONS: { value: HeightMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'grow', label: 'Autogrow' },
]

/**
 * The track-sizing rows for "Advanced": fixed or autogrow, and the row cap. A
 * fit keeps the track's height, so it ticks Fixed.
 * Autogrow is offered without content, since grow still fits the track to a
 * pileup-less stack (`growTargetHeight` collapses to the coverage bands); the
 * row cap only while there are rows.
 */
export function getTrackSizingItems(
  model: FeatureHeightModel & MaxHeightModel,
  gate: ContentGate = {},
): MenuItem[] {
  const current = model.heightMode === 'grow' ? 'grow' : 'fixed'
  return [
    {
      label: TRACK_HEIGHT_LABEL,
      type: 'subMenu' as const,
      // the ticked row writes nothing: under fit it is Fixed, and writing that
      // would end the fit
      subMenu: radioItems(TRACK_HEIGHT_OPTIONS, current, mode => {
        if (mode !== current) {
          model.setHeightMode(mode)
        }
      }),
    },
    ...(gate.disabled ? [] : [getMaxHeightMenuItem(model)]),
  ]
}
