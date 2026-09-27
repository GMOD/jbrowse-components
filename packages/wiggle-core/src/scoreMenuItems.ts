import { lazy } from 'react'

import {
  checkboxItem,
  radioItems,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { autoscaleGroupMembers, autoscalePeers } from './autoscaleGroup.ts'
import { VALUE_SCALE_TYPES } from './valueScaleConfigSchema.ts'

import type { AutoscalePeer } from './autoscaleGroup.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ValueScaleRule } from '@jbrowse/display-ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const AutoscaleGroupDialog = lazy(() => import('./AutoscaleGroupDialog.tsx'))
const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))
const SetScoreRulesDialog = lazy(() => import('./SetScoreRulesDialog.tsx'))

// Canonical "thing that has a value scale" — every display with one (wiggle,
// multi-wiggle, manhattan, alignments coverage, the mark display) exposes this
// exact shape so the shared Score menu, scale submenu, and SetMinMaxDialog
// consume it without per-display adapters. Two pairs, and which one a consumer
// wants is which question it is asking: manualMinScore/manualMaxScore is what
// the config really pins (undefined = nothing pinned), which is what the dialog
// round-trips and what the menu captions itself with;
// minScoreBound/maxScoreBound is where each end of the axis resolved to
// (undefined = autoscale this end), which is what a domain computes from.
// hasManualScoreBounds is the third question, and the only one of the three that
// survives a `defaultScoreDomain` override. All of them come from
// `ScoreAxisMixin`.
export interface ScoreScaleModel extends IStateTreeNode {
  scaleType: string
  domainQuantile: number
  clipQuantile: number
  manualMinScore: number | undefined
  manualMaxScore: number | undefined
  minScoreBound: number | undefined
  maxScoreBound: number | undefined
  hasManualScoreBounds: boolean
  autoscaledDomain: [number, number] | undefined
  setScaleType: (v: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
  setDomainQuantile: (quantile: number) => void
}

// The reference-lines half, apart for the same reason: a display draws its
// scale's `rules` or it does not, and `scoreRulesDrawn` is which.
export interface ScoreRulesModel {
  scoreRulesDrawn: boolean
  scoreRules: ValueScaleRule[]
  setScoreRules: (rules: ValueScaleRule[]) => void
}

const SCALE_TYPE_LABELS: Record<(typeof VALUE_SCALE_TYPES)[number], string> = {
  linear: 'Linear scale',
  log: 'Log scale',
  symlog: 'Symlog scale (allows zero)',
}

export function makeScaleTypeSubMenu(self: {
  scaleType: string
  setScaleType: (v: string) => void
}): MenuItem {
  return {
    label: 'Scale type',
    subMenu: radioItems(
      VALUE_SCALE_TYPES.map(value => ({
        value,
        label: SCALE_TYPE_LABELS[value],
      })),
      self.scaleType,
      v => {
        self.setScaleType(v)
      },
    ),
  }
}

// Quoted by the docs' click paths, so one literal string.
export const CLIP_OUTLIERS_LABEL = 'Clip outliers'

// One checkbox rather than a radio over modes: what a reader decides is whether
// a spike may take the axis, and the quantile it clips at is the config's.
export function makeClipOutliersItem(self: {
  domainQuantile: number
  clipQuantile: number
  setDomainQuantile: (quantile: number) => void
}): MenuItem {
  const clipsAt =
    self.domainQuantile < 1 ? self.domainQuantile : self.clipQuantile
  const percent = Math.round(clipsAt * 100)
  return toggleItem(
    CLIP_OUTLIERS_LABEL,
    self.domainQuantile < 1,
    on => {
      self.setDomainQuantile(on ? self.clipQuantile : 1)
    },
    {
      helpText: `An unpinned end follows the ${percent}th percentile of each sign rather than the extremes, so one spike no longer flattens the rest.`,
    },
  )
}

// The label shows the PINNED pair, `auto` for an end nobody pinned: the
// resolved pair captioned every GC content track "(0 – 1)" off its default
// domain. "Use current range" copies `autoscaledDomain`, undefined while the
// alignments density tier's features per bin stand in for depth.
export function makeSetMinMaxScoreItem(self: ScoreScaleModel): MenuItem {
  const { manualMinScore, manualMaxScore, autoscaledDomain: domain } = self
  return {
    label: self.hasManualScoreBounds
      ? `Set min/max score (${manualMinScore ?? 'auto'} – ${manualMaxScore ?? 'auto'})...`
      : 'Set min/max score...',
    onClick: () => {
      getDialogHost(self).queueDialog(handleClose => [
        SetMinMaxDialog,
        { model: self, domain, handleClose },
      ])
    },
  }
}

export function makeCrossHatchItem(self: {
  grid: boolean
  setGrid: (grid: boolean) => void
}): MenuItem {
  return checkboxItem('Show cross hatches', self.grid, () => {
    self.setGrid(!self.grid)
  })
}

// The single Score submenu every quantitative display builds. Composition is
// capability-driven: `leadingItems` lets wiggle prepend its Resolution/Summary
// submenus, `trailingItems` appends what belongs after the range controls rather
// than before them (the alignments band's allele-fraction floor).
export interface ScoreSubMenuOptions {
  label?: string
  leadingItems?: MenuItem[]
  trailingItems?: MenuItem[]
  // Greys the whole submenu out — for a display whose band can be hidden, where
  // every setting in here scales something that isn't drawn (the alignments
  // coverage band). Taken as a pair so a caller cannot grey the menu out
  // without saying which switch brings it back.
  disabled?: boolean
  disabledHelpText?: string
}

// The count of the other tracks in the group is in the label, as the min/max
// row carries its bounds: an axis that moves when another track pans is
// something the reader has to be able to find the cause of.
export function makeAutoscaleGroupItem(
  self: IStateTreeNode & AutoscalePeer,
): MenuItem {
  const { autoscaleGroup } = self
  const others =
    autoscaleGroup === undefined
      ? 0
      : autoscaleGroupMembers(self, autoscaleGroup).length - 1
  return {
    label:
      others > 0
        ? `Autoscale with other tracks (${others})...`
        : 'Autoscale with other tracks...',
    onClick: () => {
      getDialogHost(self).queueDialog(handleClose => [
        AutoscaleGroupDialog,
        { model: self, handleClose },
      ])
    },
  }
}

// Offered once the view holds another track with a value axis to share.
function autoscalesInGroups<T extends IStateTreeNode>(
  self: T & Partial<AutoscalePeer>,
): self is T & AutoscalePeer {
  return self.setAutoscaleGroup !== undefined && autoscalePeers(self).length > 0
}

function drawsScoreRules<T extends IStateTreeNode>(
  self: T & Partial<ScoreRulesModel>,
): self is T & ScoreRulesModel {
  return (
    self.scoreRulesDrawn === true &&
    self.scoreRules !== undefined &&
    self.setScoreRules !== undefined
  )
}

// The count is in the label, as the min/max row carries its bounds: a dashed
// line across a plot means nothing until the reader knows it was put there.
export function makeSetScoreRulesItem(
  self: IStateTreeNode & ScoreRulesModel,
): MenuItem {
  const count = self.scoreRules.length
  return {
    label: count > 0 ? `Reference lines (${count})...` : 'Reference lines...',
    onClick: () => {
      getDialogHost(self).queueDialog(handleClose => [
        SetScoreRulesDialog,
        { model: self, handleClose },
      ])
    },
  }
}

export function makeScoreSubMenu(
  self: ScoreScaleModel & Partial<ScoreRulesModel> & Partial<AutoscalePeer>,
  opts: ScoreSubMenuOptions = {},
): MenuItem {
  const {
    label = 'Score',
    leadingItems = [],
    trailingItems = [],
    disabled,
    disabledHelpText,
  } = opts
  return {
    label,
    icon: EqualizerIcon,
    disabled,
    disabledHelpText,
    subMenu: [
      ...leadingItems,
      makeScaleTypeSubMenu(self),
      makeClipOutliersItem(self),
      makeSetMinMaxScoreItem(self),
      ...(autoscalesInGroups(self) ? [makeAutoscaleGroupItem(self)] : []),
      ...(drawsScoreRules(self) ? [makeSetScoreRulesItem(self)] : []),
      ...trailingItems,
    ],
  }
}
