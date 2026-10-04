import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import EqualizerIcon from '@mui/icons-material/Equalizer'

import { SCORE_AXIS_WIDGET } from './ScoreAxisWidget/constants.ts'

import type { NormalMenuItem } from '@jbrowse/core/ui'
import type { ValueScaleRule } from '@jbrowse/display-ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// Canonical "thing that has a value scale" — every display with one (wiggle,
// multi-wiggle, manhattan, alignments coverage, the mark display) exposes this
// exact shape, so the Y axis row and its drawer widget consume it without
// per-display adapters. Two pairs, and which one a consumer wants is which
// question it is asking: manualMinScore/manualMaxScore is what the config
// really pins (undefined = nothing pinned), which is what the widget's fields
// show and what the row captions itself with; minScoreBound/maxScoreBound is
// where each end of the axis resolved to (undefined = autoscale this end),
// which is what a domain computes from. hasManualScoreBounds is the third
// question, and the only one of the three that survives a `defaultScoreDomain`
// override. All of them come from `ScoreAxisMixin`.
export interface ScoreScaleModel extends IStateTreeNode {
  scaleType: string
  scaleZero: boolean
  domainQuantile: number
  clipQuantile: number
  manualMinScore: number | undefined
  manualMaxScore: number | undefined
  minScoreBound: number | undefined
  maxScoreBound: number | undefined
  hasManualScoreBounds: boolean
  autoscaleRange: [number, number] | undefined
  autoscaledDomain: [number, number] | undefined
  setScaleType: (v: string) => void
  setScaleZero: (zero: boolean) => void
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

// Quoted by the docs' click paths, so literal strings.
export const Y_AXIS_LABEL = 'Y axis'
export const COVERAGE_AXIS_LABEL = 'Coverage axis'
export const SCORE_RANGE_LABEL = 'Score range'

export interface ScoreAxisMenuItemOptions {
  label?: string
  // Greys the row out — for a display whose band can be hidden, where the
  // axis scales something that isn't drawn (the alignments coverage band).
  // Taken as a pair so a caller cannot grey the row out without saying which
  // switch brings it back.
  disabled?: boolean
  disabledHelpText?: string
}

// The caption carries only what the plot cannot show: a pinned end, `auto`
// for the other, and a scale that isn't linear. The resolved pair would
// caption every GC content track "(0 – 1)" off its default domain.
function caption(self: ScoreScaleModel) {
  const parts = [
    ...(self.hasManualScoreBounds
      ? [`${self.manualMinScore ?? 'auto'} – ${self.manualMaxScore ?? 'auto'}`]
      : []),
    ...(self.scaleType === 'linear' ? [] : [self.scaleType]),
  ]
  return parts.length ? ` (${parts.join(', ')})` : ''
}

/**
 * The one track-menu row for a value scale. It opens the drawer widget that
 * edits `scales.y` live — scale type, range, 0, outlier clipping, the axis a
 * group shares, grid and reference lines — so the track redraws beside it.
 */
export function makeScoreAxisMenuItem(
  self: ScoreScaleModel & { id: string },
  opts: ScoreAxisMenuItemOptions = {},
): NormalMenuItem {
  const { label = Y_AXIS_LABEL, disabled, disabledHelpText } = opts
  return {
    label: `${label}${caption(self)}...`,
    icon: EqualizerIcon,
    disabled,
    disabledHelpText,
    onClick: () => {
      const session = getSession(self)
      if (isSessionModelWithWidgets(session)) {
        session.openWidget(SCORE_AXIS_WIDGET, 'scoreAxis', {
          display: self.id,
          label,
        })
      }
    },
  }
}
