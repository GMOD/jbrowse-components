import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { VariantReviewView } from '../VariantReviewViewExtension/model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  column: {
    position: 'absolute',
    top: 0,
    height: '100%',
    pointerEvents: 'none',
    zIndex: 9,
    boxSizing: 'border-box',
  },
  label: {
    position: 'absolute',
    top: 0,
    left: 2,
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 1,
    padding: '1px 2px',
    borderRadius: 2,
    color: '#fff',
  },
})

const DECISION_COLORS = {
  accepted: '#2e7d32',
  rejected: '#c62828',
  flagged: '#ed6c02',
} as const
const NEUTRAL = '#1976d2'

const DECISION_LETTERS = {
  accepted: 'A',
  rejected: 'R',
  flagged: 'F',
} as const

/**
 * The current candidate's column over the tracks: the base the pileups are
 * sorted on (or the whole event when there is no sort column), tinted by the
 * decision. The reviewer's eye is on the pileup, so this, not the drawer, is
 * where a decision is seen to land. Not a session highlight: those are user
 * data that persist and export.
 */
const CandidateColumnOverlay = observer(function CandidateColumnOverlay({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const view = model as unknown as Partial<VariantReviewView>
  const c = view.reviewActive ? view.currentCandidate : undefined
  if (!c) {
    return null
  }
  const [start, end] = c.sort ? [c.sort.pos, c.sort.pos + 1] : [c.start, c.end]
  // canonicalizes the refName and mirrors a reversed region
  const coords = model.getHighlightCoords({
    refName: c.refName,
    start,
    end,
    assemblyName: c.assemblyName,
  })
  if (!coords) {
    return null
  }
  const decision = view.currentDecision?.decision
  const color = decision ? DECISION_COLORS[decision] : NEUTRAL
  return (
    <div
      className={classes.column}
      data-testid="variant-review-column"
      style={{
        left: coords.left,
        width: Math.max(coords.width, 2),
        background: alpha(color, 0.15),
        borderLeft: `1px solid ${alpha(color, 0.8)}`,
        borderRight: `1px solid ${alpha(color, 0.8)}`,
      }}
    >
      {decision ? (
        <span className={classes.label} style={{ background: color }}>
          {DECISION_LETTERS[decision]}
        </span>
      ) : null}
    </div>
  )
})

export default CandidateColumnOverlay
