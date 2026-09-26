import { lazy } from 'react'

import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { DEFAULT_AUTOSCALE_OPTIONS } from './autoscale.ts'
import { autoscaleGroupMembers, autoscalePeers } from './autoscaleGroup.ts'

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
  scaleTypeChoices: string[]
  manualMinScore: number | undefined
  manualMaxScore: number | undefined
  minScoreBound: number | undefined
  maxScoreBound: number | undefined
  hasManualScoreBounds: boolean
  setScaleType: (v: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
}

// The autoscale half, apart because a display can have a value scale and no
// autoscale mode behind it: its `scales.y` then carries no `autoscale` member
// and this half answers `undefined`.
export interface AutoscaleModel {
  autoscaleType: string | undefined
  setAutoscale: (v?: string) => void
}

// The reference-lines half, apart for the same reason: a display draws its
// scale's `rules` or it does not, and `scoreRulesDrawn` is which.
export interface ScoreRulesModel {
  scoreRulesDrawn: boolean
  scoreRules: ValueScaleRule[]
  setScoreRules: (rules: ValueScaleRule[]) => void
}

const SCALE_TYPE_LABELS: Record<string, string> = {
  linear: 'Linear scale',
  log: 'Log scale',
  symlog: 'Symlog scale (allows zero)',
}

// The radio offers exactly what the display's own `scales.y.type` enum admits,
// read back through `scaleTypeChoices`, since a value outside it is refused.
export function makeScaleTypeSubMenu(self: {
  scaleType: string
  scaleTypeChoices: string[]
  setScaleType: (v: string) => void
}): MenuItem {
  return {
    label: 'Scale type',
    subMenu: radioItems(
      self.scaleTypeChoices.map(value => ({
        value,
        label: SCALE_TYPE_LABELS[value] ?? value,
      })),
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

// Showing the range in the label is how the menu says a fixed bound is in force
// — otherwise an autoscale-type radio still reads as checked while a manual
// bound silently overrides it. So it is the PINNED pair that is shown, with
// `auto` for the end nobody pinned. A display overriding `defaultScoreDomain`
// resolves both ends to numbers with nothing configured: asking the resolved
// pair captioned every GC content track "(0 – 1)", and once one end was really
// set it printed the other end's default beside it, in the one place the user
// looks to find out what they have pinned.
//
// The drawn domain rides along so the dialog can offer "Use current range",
// which freezes the axis where it is drawn: never the resolved `*Bound` pair,
// which on an autoscaled track is `undefined` at both ends and would pin
// nothing. Each display names its own domain (`coverageDomain` on the
// alignments band), so the caller hands it in.
export function makeSetMinMaxScoreItem(
  self: ScoreScaleModel,
  domain?: [number, number],
): MenuItem {
  const { manualMinScore, manualMaxScore } = self
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
// than before them (the alignments band's allele-fraction floor);
// `autoscaleOptions` is overridden by coverage's reduced + dynamic-σ list.
//
// Neither radio is opted out of any more. Both derive from the display's own
// `scales.y`: the scale-type radio appears where the declared enum holds more
// than one type, the autoscale radios where the object has an `autoscale`
// member. A display whose domain consults no mode declares none, so there is no
// longer a way to draw radios that change nothing.
export interface ScoreSubMenuOptions {
  label?: string
  autoscaleOptions?: [string, string][]
  // The domain drawn right now, which the min/max dialog's "Use current range"
  // button copies into the slots; undefined before it resolves.
  domain?: [number, number]
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
  self: ScoreScaleModel &
    Partial<AutoscaleModel> &
    Partial<ScoreRulesModel> &
    Partial<AutoscalePeer>,
  opts: ScoreSubMenuOptions = {},
): MenuItem {
  const {
    label = 'Score',
    autoscaleOptions,
    domain,
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
      ...(self.scaleTypeChoices.length > 1 ? [makeScaleTypeSubMenu(self)] : []),
      ...(self.autoscaleType !== undefined && self.setAutoscale
        ? [
            makeAutoscaleTypeSubMenu(
              {
                autoscaleType: self.autoscaleType,
                setAutoscale: self.setAutoscale,
              },
              autoscaleOptions,
            ),
          ]
        : []),
      makeSetMinMaxScoreItem(self, domain),
      ...(autoscalesInGroups(self) ? [makeAutoscaleGroupItem(self)] : []),
      ...(drawsScoreRules(self) ? [makeSetScoreRulesItem(self)] : []),
      ...trailingItems,
    ],
  }
}
