import { lazy } from 'react'

import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { DEFAULT_AUTOSCALE_OPTIONS } from './autoscale.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))

// Canonical "thing that has a score axis" — every wiggle-family display
// (wiggle, multi-wiggle, manhattan, alignments coverage) exposes this exact
// shape so the shared Score menu, autoscale/scale submenus, and SetMinMaxDialog
// consume it without per-display adapters. Two pairs, and which one a consumer
// wants is which question it is asking: manualMinScore/manualMaxScore is what
// the config really pins (undefined = nothing pinned), which is what the dialog
// round-trips and what the menu captions itself with;
// minScoreBound/maxScoreBound is where each end of the axis resolved to
// (undefined = autoscale this end), which is what a domain computes from. The
// raw sentinels are nobody's business out here. hasManualScoreBounds is the
// third question, and the only one of the three that survives a
// `defaultScoreDomain` override. All of them come from `ScoreScaleMixin`.
export interface ScoreScaleModel extends IStateTreeNode {
  scaleType: string
  autoscaleType: string
  manualMinScore: number | undefined
  manualMaxScore: number | undefined
  minScoreBound: number | undefined
  maxScoreBound: number | undefined
  hasManualScoreBounds: boolean
  setScaleType: (v: string) => void
  setAutoscale: (v?: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
}

// All three scales, so a display offering this menu at all must hold all three
// in its own `scaleType` enum. `scoreAxisConfigSchemaFields` deliberately does
// not — symlog is widened in by whoever implements it — so a display that spreads
// the shared axis fields unchanged has to opt out with `scaleType: false` the way
// manhattan does, or the radio writes a value its enumeration rejects.
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

// Showing the range in the label is how the menu says a fixed bound is in force
// — otherwise an autoscale-type radio still reads as checked while a manual
// bound silently overrides it. So it is the PINNED pair that is shown, with
// `auto` for the end nobody pinned. A display overriding `defaultScoreDomain`
// resolves both ends to numbers with nothing configured: asking the resolved
// pair captioned every GC content track "(0 – 1)", and once one end was really
// set it printed the other end's default beside it, in the one place the user
// looks to find out what they have pinned.
export function makeSetMinMaxScoreItem(self: ScoreScaleModel): MenuItem {
  const { manualMinScore, manualMaxScore } = self
  return {
    label: self.hasManualScoreBounds
      ? `Set min/max score (${manualMinScore ?? 'auto'} – ${manualMaxScore ?? 'auto'})...`
      : 'Set min/max score...',
    onClick: () => {
      getDialogHost(self).queueDialog(handleClose => [
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
// submenus, `trailingItems` appends what belongs after the range controls rather
// than before them (the alignments band's allele-fraction floor); `scaleType` is
// dropped by manhattan (linear-only); `autoscaleOptions` is overridden by
// coverage's reduced + dynamic-σ list.
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
    // Greys the whole submenu out — for a display whose band can be hidden, where
    // every setting in here scales something that isn't drawn (the alignments
    // coverage band). Taken as a pair so a caller cannot grey the menu out
    // without saying which switch brings it back.
    disabled?: boolean
    disabledHelpText?: string
  } = {},
): MenuItem {
  const {
    label = 'Score',
    scaleType = true,
    autoscale = true,
    autoscaleOptions,
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
      ...(scaleType ? [makeScaleTypeSubMenu(self)] : []),
      ...(autoscale ? [makeAutoscaleTypeSubMenu(self, autoscaleOptions)] : []),
      makeSetMinMaxScoreItem(self),
      ...(self.hasManualScoreBounds ? [makeClearMinMaxScoreItem(self)] : []),
      ...trailingItems,
    ],
  }
}
