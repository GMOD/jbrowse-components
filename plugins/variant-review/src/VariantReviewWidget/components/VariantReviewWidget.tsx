import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Alert,
  Button,
  ButtonGroup,
  Chip,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { keyFor } from '../../commands/keymap.ts'
import { getReviewCommand, runReviewCommand } from '../../commands/registry.ts'

import type { VariantReviewView } from '../../VariantReviewViewExtension/model.ts'
import type {
  CandidateVariant,
  ReviewDecision,
} from '../../candidates/types.ts'
import type { ReviewCommandId } from '../../commands/registry.ts'
import type { VariantReviewWidgetModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: theme.spacing(1.5),
  },
  mono: {
    fontFamily: 'monospace',
  },
  hints: {
    color: theme.palette.text.secondary,
  },
  footer: {
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(1),
  },
}))

const DECISION_COLORS = {
  accepted: 'success',
  rejected: 'error',
  flagged: 'warning',
} as const

function truncateAllele(allele: string, max = 12) {
  return allele.length > max
    ? `${allele.slice(0, max)}…(+${allele.length - max})`
    : allele
}

function alleleSummary(c: CandidateVariant) {
  return `${truncateAllele(c.ref)}>${c.alt.map(a => truncateAllele(a)).join(',')}`
}

function locus(c: CandidateVariant) {
  return `${c.refName}:${c.pos1.toLocaleString('en-US')}`
}

function formatValue(v: unknown) {
  return Array.isArray(v) ? v.join(',') : String(v)
}

function sortLine(view: VariantReviewView, c: CandidateVariant) {
  const report = view.lastSortReport
  if (!report) {
    return undefined
  }
  if (report.total === 0) {
    return 'no alignment tracks to sort'
  }
  if (report.reason) {
    return report.reason
  }
  const where = c.sort
    ? ` at ${c.refName}:${(c.sort.pos + 1).toLocaleString('en-US')} (${c.sort.type === 'insertion' ? 'insertion' : 'base'})`
    : ''
  return `sorted ${report.sorted}/${report.total} tracks${where}`
}

const KeyHint = observer(function KeyHint({
  view,
  id,
  label,
}: {
  view: VariantReviewView
  id: ReviewCommandId
  label?: string
}) {
  const key = keyFor(view.reviewKeymap, id)
  return key ? (
    <span>
      <kbd>{key}</kbd> {label ?? getReviewCommand(id).label.toLowerCase()}
    </span>
  ) : null
})

const DecisionButtons = observer(function DecisionButtons({
  view,
}: {
  view: VariantReviewView
}) {
  const current = view.currentDecision?.decision
  const buttons: [ReviewCommandId, ReviewDecision | undefined][] = [
    ['accept', 'accepted'],
    ['reject', 'rejected'],
    ['flag', 'flagged'],
    ['clearDecision', undefined],
  ]
  return (
    <ButtonGroup size="small">
      {buttons.map(([id, decision]) => {
        const key = keyFor(view.reviewKeymap, id)
        const { label } = getReviewCommand(id)
        return (
          <Button
            key={id}
            variant={
              decision && current === decision ? 'contained' : 'outlined'
            }
            color={decision ? DECISION_COLORS[decision] : 'inherit'}
            onClick={() => {
              runReviewCommand(id, view)
            }}
          >
            {label}
            {key ? ` (${key})` : ''}
          </Button>
        )
      })}
    </ButtonGroup>
  )
})

const CandidatePanel = observer(function CandidatePanel({
  view,
}: {
  view: VariantReviewView
}) {
  const { classes } = useStyles()
  const c = view.currentCandidate
  if (!c) {
    return (
      <Typography variant="body2">
        {view.candidateCount === 0
          ? 'No candidates in this track.'
          : 'Press j to go to the first candidate.'}
      </Typography>
    )
  }
  const decision = view.currentDecision?.decision
  const status = sortLine(view, c)
  return (
    <>
      <div className={classes.row}>
        <Typography variant="h6" component="span">
          {view.candidateIndex + 1} / {view.candidateCount}
        </Typography>
        <Typography className={classes.mono}>{locus(c)}</Typography>
        <Typography className={classes.mono}>{alleleSummary(c)}</Typography>
        <Typography variant="body2">{c.kind.toUpperCase()}</Typography>
        <Chip
          size="small"
          label={decision ?? 'unreviewed'}
          color={decision ? DECISION_COLORS[decision] : 'default'}
        />
      </div>
      <div className={classes.row}>
        {c.vcfId ? <Typography variant="body2">ID {c.vcfId}</Typography> : null}
        <Typography variant="body2">
          FILTER {c.filter?.join(';') ?? '.'}
        </Typography>
        <Typography variant="body2">QUAL {c.qual ?? '.'}</Typography>
        {Object.entries(c.info).map(([k, v]) => (
          <Typography key={k} variant="body2">
            {k} {formatValue(v)}
          </Typography>
        ))}
      </div>
      {status ? (
        <Typography variant="body2" className={classes.hints}>
          {status}
        </Typography>
      ) : null}
      {view.windowExceeded ? (
        <Typography variant="body2" className={classes.hints}>
          event is wider than the review window; showing its start
        </Typography>
      ) : null}
      <DecisionButtons view={view} />
      <Typography
        variant="caption"
        className={`${classes.row} ${classes.hints}`}
      >
        <KeyHint view={view} id="next" label="next" />
        <KeyHint view={view} id="previous" label="previous" />
        <KeyHint view={view} id="nextUnreviewed" />
        <KeyHint view={view} id="sort" label="re-sort" />
        <KeyHint view={view} id="restoreViewport" label="re-centre" />
        <KeyHint view={view} id="details" label="details" />
      </Typography>
    </>
  )
})

const TrackPicker = observer(function TrackPicker({
  view,
}: {
  view: VariantReviewView
}) {
  const session = getSession(view)
  const tracks = view.variantTracks
  if (tracks.length === 0) {
    return (
      <Typography variant="body2">
        Open a variant track to start review.
      </Typography>
    )
  }
  return (
    <TextField
      select
      size="small"
      label="Review variants in"
      value=""
      onChange={event => {
        void view.startReview(event.target.value)
      }}
    >
      {tracks.map(t => {
        const trackId = t.configuration.trackId as string
        return (
          <MenuItem key={trackId} value={trackId}>
            {getTrackName(t.configuration, session)}
          </MenuItem>
        )
      })}
    </TextField>
  )
})

const ReviewBody = observer(function ReviewBody({
  view,
}: {
  view: VariantReviewView
}) {
  const { classes } = useStyles()
  if (!view.reviewActive) {
    return <TrackPicker view={view} />
  }
  if (!view.reviewTrack) {
    return (
      <>
        <Alert severity="warning">
          The track under review is no longer in this view.
        </Alert>
        <Button
          variant="outlined"
          onClick={() => {
            view.stopReview()
          }}
        >
          Stop review
        </Button>
      </>
    )
  }
  const counts = view.decisionCounts
  const trackName = getTrackName(
    view.reviewTrack.configuration,
    getSession(view),
  )
  return (
    <>
      <Typography variant="subtitle2">Reviewing {trackName}</Typography>
      {view.candidatesState === 'loading' ? (
        <>
          <LinearProgress />
          <Typography variant="caption">
            {view.candidatesStatus || 'Loading candidates…'}
          </Typography>
        </>
      ) : null}
      {view.candidatesState === 'error' ? (
        <Alert severity="error">{`${view.candidatesError}`}</Alert>
      ) : null}
      {view.candidatesTruncated ? (
        <Alert severity="warning">
          Candidate list truncated at{' '}
          {view.reviewConfig.maxCandidates.toLocaleString('en-US')} records —
          filter the track or load a smaller call set.
        </Alert>
      ) : null}
      {view.reviewTargets.length === 0 ? (
        <Typography variant="body2" className={classes.hints}>
          no alignment tracks to sort
        </Typography>
      ) : null}
      {view.candidatesState === 'ready' ? <CandidatePanel view={view} /> : null}
      <div className={`${classes.row} ${classes.footer}`}>
        <Typography variant="caption">
          {view.candidateCount} total · {counts.accepted} accepted ·{' '}
          {counts.rejected} rejected · {counts.flagged} flagged ·{' '}
          {counts.unreviewed} unreviewed
        </Typography>
      </div>
      <div className={classes.row}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            view.exportDecisions()
          }}
        >
          Export TSV
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            void view.refreshCandidates()
          }}
        >
          Refresh
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            view.stopReview()
          }}
        >
          Stop review
        </Button>
      </div>
    </>
  )
})

const VariantReviewWidget = observer(function VariantReviewWidget({
  model,
}: {
  model: VariantReviewWidgetModel
}) {
  const { classes } = useStyles()
  const view = model.reviewView
  const views = model.reviewableViews
  return (
    <div className={classes.root}>
      {view ? (
        <ReviewBody view={view} />
      ) : views.length > 0 ? (
        <TextField
          select
          size="small"
          label="Review in view"
          value=""
          onChange={event => {
            model.setView(event.target.value)
          }}
        >
          {views.map((v, i) => (
            <MenuItem key={v.id} value={v.id}>
              {`Linear genome view ${i + 1}`}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Typography variant="body2">
          Open a linear genome view with a variant track to start review.
        </Typography>
      )}
    </div>
  )
})

export default VariantReviewWidget
