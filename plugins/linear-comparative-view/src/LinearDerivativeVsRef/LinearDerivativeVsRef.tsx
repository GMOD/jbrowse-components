import { useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { ErrorMessage, SubmitDialog } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isSessionWithAddTracks,
  toLocale,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { when } from 'mobx'
import { observer } from 'mobx-react'

import {
  buildDerivativeVsRefSpec,
  derivativePathLabel,
} from './buildDerivativeVsRefSpec.ts'

import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

const useStyles = makeStyles()(theme => ({
  root: {
    maxWidth: 560,
  },
  path: {
    fontWeight: 'bold',
  },
  detail: {
    color: theme.palette.text.secondary,
  },
  caveat: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
  },
}))

interface ViewTrack {
  type: string
  configuration: { trackId: string }
}

// Which of the user's open tracks to redraw over the reconstruction. Everything
// except the alignments tracks: the reference panel merges every locus the path
// touches into one window, so a pileup there is a large fetch of the same reads
// that are already on screen in the view this was launched from, while the
// annotation and quantitative tracks are cheap and are the context that makes
// the allele mean something.
//
// Ids, not snapshots. A hand-written `{ type, configuration }` track entry
// mounts with NO display and draws nothing: `showTrackGeneric` is what picks a
// display compatible with the containing view type and builds the `displays`
// array, so these have to go through `showTrack` on the created view rather
// than into the snapshot it is created from.
function refPanelTrackIds(view: { tracks?: ViewTrack[] }) {
  return (view.tracks ?? [])
    .filter(t => t.type !== 'AlignmentsTrack')
    .map(t => t.configuration.trackId)
}

// Rows the picker draws. Enough that a real event's alternatives all fit, few
// enough that a repeat-driven list does not become the dialog.
const MAX_SHOWN = 10

interface SyntenyPanel {
  initialized?: boolean
  showTrack?: (
    trackId: string,
    initialSnapshot?: Record<string, unknown>,
    displayInitialSnapshot?: Record<string, unknown>,
  ) => void
}

// Run `show` once the panel has a width. A view created by an action is not
// measured until React lays it out, and a display attached before then reads a
// width that is not there yet — which for a track whose features come from its
// config, and so lays out the instant it attaches, is a certainty rather than a
// race. `when` fires synchronously if the panel is already sized, so this is
// only a wait when there is something to wait for. It is not a timeout: the
// condition is the view's own `initialized`.
function showWhenMeasured(panel: SyntenyPanel, show: () => void) {
  when(
    () => !isAlive(panel) || !!panel.initialized,
    () => {
      if (isAlive(panel)) {
        show()
      }
    },
  )
}

function segmentSummary(candidate: DerivativeCandidate) {
  const total = candidate.segments.reduce(
    (sum, seg) => sum + (seg.end - seg.start),
    0,
  )
  return `${candidate.segments.length} segments, ${toLocale(total)} bp`
}

// The picker for "Reconstruct derivative allele". Every row is a path some set
// of reads describes, ranked by how many of them do; picking one draws it as a
// synteny view. Nothing here decides whether a path is real — the read count is
// the evidence offered, and the view is where a person judges it.
const DerivativeVsRefDialog = observer(function DerivativeVsRefDialog({
  model,
  track,
  handleClose,
}: {
  model: { derivativePathCandidates: DerivativeCandidate[] }
  track: AbstractTrackModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const ranked = model.derivativePathCandidates
  // A window that produces dozens of paths has said something about all of them,
  // so the overflow is reported rather than dropped: it is the difference
  // between "here is the event" and "these reads map everywhere".
  const candidates = ranked.slice(0, MAX_SHOWN)
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState<unknown>()

  async function onSubmit() {
    try {
      const candidate = candidates[selected]
      if (!candidate) {
        return
      }
      const session = getSession(track)
      const view = getContainingView(track) as {
        width: number
        tracks?: ViewTrack[]
      }
      const [trackAssembly] = getConf(track, 'assemblyNames') as string[]
      const assembly = await session.assemblyManager.waitForAssembly(
        trackAssembly!,
      )
      if (!assembly) {
        throw new Error('assembly not found')
      }
      const { segmentsTrack, segmentsDisplay, temporaryAssembly, viewSpec } =
        buildDerivativeVsRefSpec({
          candidate,
          trackAssembly: trackAssembly!,
          viewWidth: view.width,
          sequenceTrackConf: getConf(assembly, 'sequence') as {
            trackId: string
          },
          now: () => Date.now(),
          rand: () => Math.random(),
        })
      session.addTemporaryAssembly?.(temporaryAssembly)
      const created = session.addView('LinearSyntenyView', viewSpec) as {
        views?: SyntenyPanel[]
      }
      const [refPanel, derivativePanel] = created.views ?? []
      // the launching view's own tracks go onto the reference panel only: the
      // derivative panel is a synthetic assembly no configured track names
      const carried = refPanelTrackIds(view)
      if (refPanel && carried.length > 0) {
        showWhenMeasured(refPanel, () => {
          for (const trackId of carried) {
            refPanel.showTrack?.(trackId)
          }
        })
      }
      // A session that refuses track configs (embedded, `disableAddTracks`) gets
      // the reconstruction without its segment labels rather than a panel
      // naming a track nothing can resolve.
      if (isSessionWithAddTracks(session) && derivativePanel) {
        session.addTrackConf(segmentsTrack)
        showWhenMeasured(derivativePanel, () => {
          derivativePanel.showTrack?.(
            segmentsTrack.trackId,
            {},
            segmentsDisplay,
          )
        })
      }
      handleClose()
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  return (
    <SubmitDialog
      open
      title="Reconstruct derivative allele"
      submitText="Draw it"
      submitDisabled={candidates.length === 0}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        void onSubmit()
      }}
    >
      <div className={classes.root}>
        {error ? <ErrorMessage error={error} /> : null}
        {candidates.length === 0 ? (
          <Typography>
            No rearranged path is supported by more than one read in this
            window. Reconstruction reads split alignments, so it needs reads
            whose SA tag places part of them elsewhere: navigate to a
            breakpoint, and widen the window if the reads are long.
          </Typography>
        ) : (
          <>
            <Typography>
              Each path below is a route through the reference that this many
              reads independently describe, laid out in the order and
              orientation the reads cross it. Drawing one opens it as a synteny
              view, one ribbon per segment, so the reconstruction can be read
              against the reference it came from.
            </Typography>
            <Typography className={classes.caveat}>
              Read counts rank these paths; they do not vouch for them. The size
              beside each is the check: a route whose segments are all about one
              read long is an aligner splitting a short read, not an allele.
            </Typography>
            <RadioGroup
              // the real result of the reconstruction pass, so a screenshot
              // spec (and a test) can wait on the candidates existing rather
              // than on a timeout
              data-testid="derivative-path-candidates"
              value={selected}
              onChange={event => {
                setSelected(+event.target.value)
              }}
            >
              {candidates.map((candidate, idx) => (
                <FormControlLabel
                  key={candidate.locString}
                  value={idx}
                  control={<Radio />}
                  label={
                    <div>
                      <div className={classes.path}>
                        {derivativePathLabel(candidate)}
                      </div>
                      <div className={classes.detail}>
                        {candidate.readCount} reads, {segmentSummary(candidate)}
                        {candidate.extendsOffScreen
                          ? ', extends beyond this window'
                          : ''}
                      </div>
                    </div>
                  }
                />
              ))}
            </RadioGroup>
            {ranked.length > candidates.length ? (
              <Typography className={classes.caveat}>
                {ranked.length - candidates.length} further paths are supported
                by at least two reads and are not listed. A window that produces
                this many is usually repetitive rather than rearranged.
              </Typography>
            ) : null}
          </>
        )}
      </div>
    </SubmitDialog>
  )
})

export default DerivativeVsRefDialog
