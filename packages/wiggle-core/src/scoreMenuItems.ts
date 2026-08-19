import { lazy } from 'react'

import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { getSession } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { DEFAULT_AUTOSCALE_OPTIONS } from './autoscale.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))

// Canonical "thing that has a score axis" — every wiggle-family display
// (wiggle, multi-wiggle, manhattan, alignments coverage) exposes this exact
// shape so the shared Score menu, autoscale/scale submenus, and SetMinMaxDialog
// consume it without per-display adapters. minScore/maxScore are the raw config
// values (Number.MIN_VALUE/MAX_VALUE sentinels intact) the dialog expects;
// minScoreBound/maxScoreBound are the resolved bounds (undefined = autoscale)
// every implementer already derives (WiggleScoreConfigMixin + alignments).
export interface ScoreScaleModel extends IStateTreeNode {
  scaleType: string
  autoscaleType: string
  minScore: number
  maxScore: number
  minScoreBound: number | undefined
  maxScoreBound: number | undefined
  setScaleType: (v: string) => void
  setAutoscale: (v?: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
}

export function makeScaleTypeSubMenu(self: {
  scaleType: string
  setScaleType: (v: string) => void
}): MenuItem {
  return {
    label: 'Scale type',
    subMenu: radioItems(
      [
        { value: 'linear', label: 'Linear scale' },
        { value: 'log', label: 'Log scale' },
        { value: 'symlog', label: 'Symlog scale (allows zero)' },
      ],
      self.scaleType,
      v => {
        self.setScaleType(v)
      },
    ),
  }
}

export function makeAutoscaleTypeSubMenu(
  self: { autoscaleType: string; setAutoscale: (v?: string) => void },
  options: [string, string][] = DEFAULT_AUTOSCALE_OPTIONS,
): MenuItem {
  return {
    label: 'Autoscale type',
    subMenu: radioItems(
      options.map(([value, label]) => ({ value, label })),
      self.autoscaleType,
      v => {
        self.setAutoscale(v)
      },
    ),
  }
}

// The model resolves the Number.MIN_VALUE / MAX_VALUE "unset, fall back to
// autoscale" sentinel into minScoreBound/maxScoreBound (undefined = autoscale).
// Surfacing them lets the menu show that a manual range is in force — otherwise
// an autoscale-type radio still reads as checked while a fixed bound silently
// overrides it.
function resolveScoreBounds(self: ScoreScaleModel) {
  const min = self.minScoreBound
  const max = self.maxScoreBound
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
  return checkboxItem('Show cross hatches', self.displayCrossHatches, () => {
    self.toggleCrossHatches()
  })
}

// The single Score submenu used by every wiggle-family display. Composition is
// capability-driven: `leadingItems` lets wiggle prepend its Resolution/Summary
// submenus and coverage prepend its on/off + y-axis toggles, `trailingItems`
// appends what belongs after the range controls rather than before them (the
// alignments band's allele-fraction floor); `scaleType` is dropped by manhattan
// (linear-only); `autoscaleOptions` is overridden by coverage's reduced +
// dynamic-σ list.
//
// `autoscale` is the same kind of opt-out as `scaleType`, and exists for the
// same reason: a display whose domain doesn't consult `autoscaleType` must not
// offer radios for it. Manhattan takes plain min/max over the loaded regions and
// applies only the manual bounds, so its Autoscale-type radios wrote the config
// slot and changed nothing on screen — a control that lies is worse than a
// missing one. Opt-out rather than opt-in so a display that grows a domain
// without wiring autoscale keeps the menu it already had.
export function makeScoreSubMenu(
  self: ScoreScaleModel,
  opts: {
    label?: string
    scaleType?: boolean
    autoscale?: boolean
    autoscaleOptions?: [string, string][]
    leadingItems?: MenuItem[]
    trailingItems?: MenuItem[]
  } = {},
): MenuItem {
  const {
    label = 'Score',
    scaleType = true,
    autoscale = true,
    autoscaleOptions,
    leadingItems = [],
    trailingItems = [],
  } = opts
  return {
    label,
    icon: EqualizerIcon,
    subMenu: [
      ...leadingItems,
      ...(scaleType ? [makeScaleTypeSubMenu(self)] : []),
      ...(autoscale ? [makeAutoscaleTypeSubMenu(self, autoscaleOptions)] : []),
      makeSetMinMaxScoreItem(self),
      ...(resolveScoreBounds(self).hasManual
        ? [makeClearMinMaxScoreItem(self)]
        : []),
      ...trailingItems,
    ],
  }
}
