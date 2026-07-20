import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))

// Canonical "thing that has a score axis" — every wiggle-family display
// (wiggle, multi-wiggle, manhattan, alignments coverage) exposes this exact
// shape so the shared Score menu, autoscale/scale submenus, and SetMinMaxDialog
// consume it without per-display adapters. minScore/maxScore are the raw config
// values (Number.MIN_VALUE/MAX_VALUE sentinels intact) the dialog expects.
export interface ScoreScaleModel extends IAnyStateTreeNode {
  scaleType: string
  autoscaleType: string
  minScore: number
  maxScore: number
  setScaleType: (v: string) => void
  setAutoscale: (v?: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
}

// Default autoscale modes shared by wiggle / multi-wiggle. The alignments
// coverage band exposes only a subset and a dynamic σ value, so it passes
// its own option list.
export const DEFAULT_AUTOSCALE_OPTIONS: [string, string][] = [
  ['local', 'Local'],
  ['localpercentile', 'Local (99th percentile)'],
  ['localsd', 'Local ± 3σ'],
]

export function makeScaleTypeSubMenu(self: {
  scaleType: string
  setScaleType: (v: string) => void
}): MenuItem {
  return {
    label: 'Scale type',
    subMenu: [
      {
        label: 'Linear scale',
        type: 'radio' as const,
        checked: self.scaleType === 'linear',
        onClick: () => {
          self.setScaleType('linear')
        },
      },
      {
        label: 'Log scale',
        type: 'radio' as const,
        checked: self.scaleType === 'log',
        onClick: () => {
          self.setScaleType('log')
        },
      },
    ],
  }
}

export function makeAutoscaleTypeSubMenu(
  self: { autoscaleType: string; setAutoscale: (v?: string) => void },
  options: [string, string][] = DEFAULT_AUTOSCALE_OPTIONS,
): MenuItem {
  return {
    label: 'Autoscale type',
    subMenu: options.map(([val, label]) => ({
      label,
      type: 'radio' as const,
      checked: self.autoscaleType === val,
      onClick: () => {
        self.setAutoscale(val)
      },
    })),
  }
}

// minScore/maxScore carry Number.MIN_VALUE / MAX_VALUE as the "unset, fall back
// to autoscale" sentinel (see WiggleScoreConfigMixin minScoreBound/maxScoreBound).
// Surfacing the resolved bounds lets the menu show that a manual range is in
// force — otherwise an autoscale-type radio still reads as checked while a fixed
// bound silently overrides it.
function resolveScoreBounds(self: ScoreScaleModel) {
  const min = self.minScore === Number.MIN_VALUE ? undefined : self.minScore
  const max = self.maxScore === Number.MAX_VALUE ? undefined : self.maxScore
  return { min, max, hasManual: min !== undefined || max !== undefined }
}

export function makeSetMinMaxScoreItem(self: ScoreScaleModel): MenuItem {
  const { min, max, hasManual } = resolveScoreBounds(self)
  return {
    label: hasManual
      ? `Set min/max score (${min ?? 'auto'} – ${max ?? 'auto'})...`
      : 'Set min/max score...',
    onClick: () => {
      getSession(self).queueDialog(handleClose => [
        SetMinMaxDialog,
        { model: self, handleClose },
      ])
    },
  }
}

// Only offered when a manual bound is set; resets both to the sentinel (same
// path the dialog takes when its fields are cleared) so autoscale resumes.
function makeClearMinMaxScoreItem(self: ScoreScaleModel): MenuItem {
  return {
    label: 'Clear manual min/max',
    onClick: () => {
      self.setMinScore(undefined)
      self.setMaxScore(undefined)
    },
  }
}

export function makeCrossHatchItem(self: {
  displayCrossHatches: boolean
  toggleCrossHatches: () => void
}): MenuItem {
  return {
    label: 'Show cross hatches',
    type: 'checkbox' as const,
    checked: self.displayCrossHatches,
    onClick: () => {
      self.toggleCrossHatches()
    },
  }
}

// The single Score submenu used by every wiggle-family display. Composition is
// capability-driven: `leadingItems` lets wiggle prepend its Resolution/Summary
// submenus and coverage prepend its on/off + y-axis toggles; `scaleType` is
// dropped by manhattan (linear-only); `autoscaleOptions` is overridden by
// coverage's reduced + dynamic-σ list.
export function makeScoreSubMenu(
  self: ScoreScaleModel,
  opts: {
    label?: string
    scaleType?: boolean
    autoscaleOptions?: [string, string][]
    leadingItems?: MenuItem[]
  } = {},
): MenuItem {
  const {
    label = 'Score',
    scaleType = true,
    autoscaleOptions,
    leadingItems = [],
  } = opts
  return {
    label,
    icon: EqualizerIcon,
    subMenu: [
      ...leadingItems,
      ...(scaleType ? [makeScaleTypeSubMenu(self)] : []),
      makeAutoscaleTypeSubMenu(self, autoscaleOptions),
      makeSetMinMaxScoreItem(self),
      ...(resolveScoreBounds(self).hasManual
        ? [makeClearMinMaxScoreItem(self)]
        : []),
    ],
  }
}
