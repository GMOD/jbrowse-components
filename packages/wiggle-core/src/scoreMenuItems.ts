import { lazy } from 'react'

import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { DEFAULT_AUTOSCALE_OPTIONS } from './autoscale.ts'

import type { MenuItem, NormalMenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetMinMaxDialog = lazy(() => import('./SetMinMaxDialog.tsx'))

// Canonical "thing that has a score axis" — every display with one (wiggle,
// multi-wiggle, manhattan, alignments coverage, the mark display) exposes this
// exact shape so the shared Score menu, scale submenu, and SetMinMaxDialog
// consume it without per-display adapters. Two pairs, and which one a consumer
// wants is which question it is asking: manualMinScore/manualMaxScore is what
// the config really pins (undefined = nothing pinned), which is what the dialog
// round-trips and what the menu captions itself with;
// minScoreBound/maxScoreBound is where each end of the axis resolved to
// (undefined = autoscale this end), which is what a domain computes from. The
// raw sentinels are nobody's business out here. hasManualScoreBounds is the
// third question, and the only one of the three that survives a
// `defaultScoreDomain` override. All of them come from `ScoreAxisMixin`.
export interface ScoreScaleModel extends IStateTreeNode {
  scaleType: string
  manualMinScore: number | undefined
  manualMaxScore: number | undefined
  minScoreBound: number | undefined
  maxScoreBound: number | undefined
  hasManualScoreBounds: boolean
  setScaleType: (v: string) => void
  setMinScore: (n?: number) => void
  setMaxScore: (n?: number) => void
}

// The autoscale half, apart because a display can have a score axis and no
// autoscale mode behind it: the mark display's domain is the extremes of what
// is drawn and consults no mode, so it composes the axis without the slot that
// would feed radios that change nothing.
export interface AutoscaleModel {
  autoscaleType: string
  setAutoscale: (v?: string) => void
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
  self: AutoscaleModel,
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

// Freezes the axis where it is drawn, so a pan or a zoom no longer moves it:
// the drawn domain, never the resolved `*Bound` pair, which on an autoscaled
// track is `undefined` at both ends and would pin nothing. The caller hands
// the domain in, since each display names its own (`coverageDomain` on the
// alignments band), and `makeScoreSubMenu` offers the row only while it is
// known.
export function makePinCurrentRangeItem(
  self: ScoreScaleModel,
  domain: [number, number],
): NormalMenuItem {
  return {
    label: 'Pin current min/max',
    onClick: () => {
      self.setMinScore(domain[0])
      self.setMaxScore(domain[1])
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
export interface ScoreSubMenuOptions {
  label?: string
  scaleType?: boolean
  autoscale?: boolean
  autoscaleOptions?: [string, string][]
  // The domain drawn right now, which "Pin current min/max" copies into the
  // slots; undefined before it resolves, and the row waits with it.
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

export function makeScoreSubMenu(
  self: ScoreScaleModel & AutoscaleModel,
  opts?: ScoreSubMenuOptions & { autoscale?: true },
): MenuItem
export function makeScoreSubMenu(
  self: ScoreScaleModel,
  opts: ScoreSubMenuOptions & { autoscale: false },
): MenuItem
export function makeScoreSubMenu(
  self: ScoreScaleModel & Partial<AutoscaleModel>,
  opts: ScoreSubMenuOptions = {},
): MenuItem {
  const {
    label = 'Score',
    scaleType = true,
    autoscale = true,
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
      ...(scaleType ? [makeScaleTypeSubMenu(self)] : []),
      ...(autoscale && self.autoscaleType !== undefined && self.setAutoscale
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
      makeSetMinMaxScoreItem(self),
      ...(domain ? [makePinCurrentRangeItem(self, domain)] : []),
      ...(self.hasManualScoreBounds ? [makeClearMinMaxScoreItem(self)] : []),
      ...trailingItems,
    ],
  }
}
