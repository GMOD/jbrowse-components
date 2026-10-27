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
// question it is asking: domainMin/domainMax is what the config really pins
// (undefined = nothing pinned), which is what the widget's fields show;
// resolvedDomainMin/resolvedDomainMax is where each end of the axis resolved
// to (undefined = autoscale this end), which is what a domain computes from.
// pinsDomain is the third question, and the only one of the three that
// survives a `defaultScoreDomain` override. All of them come from
// `ScoreAxisMixin`. Each is named for `encoding.y.scale`'s `domainMin` and
// `domainMax`, never `minScore`, a stored summary field `encoding.y` can plot.
export interface ScoreScaleModel extends IStateTreeNode {
  scaleType: string
  scaleZero: boolean
  fenceQuantile: number
  clipFenceQuantile: number
  domainMin: number | undefined
  domainMax: number | undefined
  resolvedDomainMin: number | undefined
  resolvedDomainMax: number | undefined
  pinsDomain: boolean
  autoscaleRange: [number, number] | undefined
  autoscaledDomain: [number, number] | undefined
  setScaleType: (v: string) => void
  setScaleZero: (zero: boolean) => void
  setDomainMin: (n?: number) => void
  setDomainMax: (n?: number) => void
  setFenceQuantile: (quantile: number) => void
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

/**
 * The one track-menu row for a value scale. It opens the drawer widget that
 * edits `encoding.y` live — scale type, range, 0, outlier clipping, the axis a
 * group shares, grid and reference lines — so the track redraws beside it.
 */
export function makeScoreAxisMenuItem(
  self: ScoreScaleModel & { id: string },
  opts: ScoreAxisMenuItemOptions = {},
): NormalMenuItem {
  const { label = Y_AXIS_LABEL, disabled, disabledHelpText } = opts
  return {
    label: `${label}...`,
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
