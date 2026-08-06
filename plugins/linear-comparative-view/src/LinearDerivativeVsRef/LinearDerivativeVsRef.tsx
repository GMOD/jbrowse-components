import { useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  ErrorMessage,
  ReplaceCurrentViewButton,
  SubmitDialog,
} from '@jbrowse/core/ui'
import {
  addOrReplaceView,
  getContainingView,
  getSession,
  isSessionWithAddTracks,
  isSessionWithViewReplacement,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { when } from 'mobx'
import { observer } from 'mobx-react'

import DerivativePathStrip from './DerivativePathStrip.tsx'
import {
  buildDerivativeVsRefSpec,
  derivativePathLabel,
} from './buildDerivativeVsRefSpec.ts'
import { buildSplitViewFromPath } from './buildSplitViewFromPath.ts'
import { segmentSizeSummary } from './derivativePathStrip.ts'

import type { AbstractTrackModel, AbstractViewModel } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

const useStyles = makeStyles()(theme => ({
  root: {
    maxWidth: 560,
  },
  path: {
    fontWeight: 'bold',
  },
  row: {
    // a three-line row against its neighbour's three lines reads as six lines
    // of one thing; the gap is what makes each row a row
    paddingBlock: theme.spacing(0.5),
  },
  detail: {
    color: theme.palette.text.secondary,
  },
  // A radio with one option is a control that cannot be operated. The single
  // candidate — which is what a clean event looks like — is drawn as the row it
  // already is, with the buttons below acting on it.
  soleCandidate: {
    marginTop: theme.spacing(1),
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

// `extendsOffScreen` is documented as purely informational and as the normal
// case for an interchromosomal event — which is to say it is usually true of
// every row at once, and on COLO829's two loci it is true of all four. A fact
// that every row states is a fact about the list, and this row has three lines
// to spend: printed per row it only pushed the sizes onto a wrapped fourth.
//
// So it is shown when, and only when, the candidates disagree about it, which
// is the case where it tells a reader which row to pick — the same rule the
// dialog's own opening comment sets for what may take a line here.
function showsOffScreenFlag(candidates: DerivativeCandidate[]) {
  return new Set(candidates.map(c => c.extendsOffScreen)).size > 1
}

// One candidate: what it is, what it looks like, and what backs it. The strip
// carries the shape and the size list the exact figures, which between them are
// the evidence the caveat above the list asks a reader to weigh — the path's
// total span, which this row used to print instead, is the same ~60kb whether
// the path is one 52kb arm carrying three sub-kilobase inserts or four
// read-length fragments an aligner split apart.
function CandidateRow({
  candidate,
  showOffScreen,
}: {
  candidate: DerivativeCandidate
  showOffScreen: boolean
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.row}>
      <div className={classes.path}>{derivativePathLabel(candidate)}</div>
      <DerivativePathStrip segments={candidate.segments} />
      <div className={classes.detail}>
        {candidate.readCount} reads · {candidate.segments.length} segments ·{' '}
        {segmentSizeSummary(candidate.segments)}
        {showOffScreen && candidate.extendsOffScreen
          ? ' · extends beyond this window'
          : ''}
      </div>
    </div>
  )
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
  model: {
    derivativePathCandidates: DerivativeCandidate[]
    hasReadsForDerivativePaths: boolean
  }
  track: AbstractTrackModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const ranked = model.derivativePathCandidates
  // A window that produces dozens of paths has said something about all of them,
  // so the overflow is reported rather than dropped: it is the difference
  // between "here is the event" and "these reads map everywhere".
  const candidates = ranked.slice(0, MAX_SHOWN)
  // decided once, for the list, because that is what it is a property of
  const showOffScreen = showsOffScreenFlag(candidates)
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState<unknown>()
  const canReplace = isSessionWithViewReplacement(getSession(track))

  // The same candidate, drawn the other way the tutorial contrasts: stacked
  // reference panels rather than the derivative's own axis. It exists because
  // the alternative is the import form, where a person types one row per
  // chromosome by hand -- which loses the ORDER the reads cross the loci in, and
  // silently merges a path that visits one chromosome twice into a single
  // panel. The candidate already knows both, so nothing here is typed.
  async function onOpenSplitView() {
    try {
      const candidate = candidates[selected]
      if (!candidate) {
        return
      }
      const session = getSession(track)
      // `IStateTreeNode`, not `unknown[]`: `getSnapshot` takes the live MST node
      // and this is where it comes from, so typing it as a plain array both
      // fails to compile and hides that `?? []` is not a fallback -- getSnapshot
      // throws on a value that is not a tree node, so an empty literal would
      // have been a runtime error rather than an empty track list.
      const view = getContainingView(track) as {
        tracks?: IStateTreeNode
      }
      const { viewSnapshot, locStrings } = buildSplitViewFromPath({
        candidate,
        // every track, alignments included: a read leaving one panel and
        // arriving in the next is the whole content of this view type, which is
        // the opposite of the synteny launch's reference panel
        tracks: view.tracks
          ? (getSnapshot(view.tracks) as Parameters<
              typeof buildSplitViewFromPath
            >[0]['tracks'])
          : [],
      })
      // The assembly has to be named. A panel created by this action has no
      // displayedRegions yet, so it has no assembly to infer one from, and a
      // bare navToLocString reports `assemblyName:undefined`. It is also what
      // makes the path's refNames resolve: the reads carry `3`/`10`/`12` where
      // the assembly is `chr3`/`chr10`/`chr12`, and refName aliasing runs off
      // the named assembly.
      //
      // Read BEFORE the replace below, like `onSubmit` reads its carried track
      // list: replacing destroys the launching view, and `track` lives in it.
      const [trackAssembly] = getConf(track, 'assemblyNames') as string[]
      // Replaces the launching view rather than opening below it, which is why
      // this button says so. Unlike the synteny destinations, the split view
      // this builds carries the launching view's OWN tracks and its first panel
      // opens on the segment the pileup is already showing -- so leaving that
      // view standing above it is a second copy of the same locus with the same
      // tracks, one scroll apart. (Reviewer, on the figure of exactly that:
      // "too chaotic ... should also use 'replace view'".) A session that
      // refuses replacement, e.g. embedded, falls back to adding.
      const created = addOrReplaceView({
        session,
        typeName: 'BreakpointSplitView',
        initialState: viewSnapshot,
        replacing: canReplace ? (view as AbstractViewModel) : undefined,
      }) as unknown as {
        views: { navToLocString: (l: string, asm: string) => Promise<void> }[]
      }
      await Promise.all(
        locStrings.map(async (loc, idx) => {
          await created.views[idx]?.navToLocString(loc, trackAssembly!)
        }),
      )
      handleClose()
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  async function onSubmit(replace = false) {
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
      // Read off the launching view BEFORE it may be swapped out: replacing
      // destroys it, and this list is what the reference panel opens with.
      const carried = refPanelTrackIds(view)
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
      const created = addOrReplaceView({
        session,
        typeName: 'LinearSyntenyView',
        initialState: viewSpec,
        replacing: replace ? (view as AbstractViewModel) : undefined,
      }) as { views?: SyntenyPanel[] }
      const [refPanel, derivativePanel] = created.views ?? []
      // the launching view's own tracks go onto the reference panel only: the
      // derivative panel is a synthetic assembly no configured track names
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
      // The dialog's own verb, with the destination named now that there are
      // two of them. The reconstruction is anchored on the window the pileup is
      // already showing, so putting it in that view's place is as reasonable an
      // outcome as adding it below, the same offer the synteny and read-vs-ref
      // launches make.
      submitText={canReplace ? 'Draw in new view' : 'Draw it'}
      submitDisabled={candidates.length === 0}
      actions={
        <>
          <Button
            // SubmitForm renders `actions` inside its <form>, where a button
            // with no type is a submit button: without this the click runs this
            // handler AND the form's, so the dialog draws the synteny view too
            type="button"
            // Same variant as the other two destinations. It is one of three
            // things this dialog can draw, and left on the default text variant
            // it read as a link between two filled buttons -- three ways to say
            // "draw it" in three different weights (review: "i do not like the
            // look of the dialog box").
            variant="contained"
            color="primary"
            disabled={candidates.length === 0}
            onClick={() => {
              void onOpenSplitView()
            }}
          >
            {/* Names the destination AND what happens to this view, because
                what happens differs from the other buttons': the split view
                carries these very tracks at this very locus, so it takes this
                view's place rather than stacking under it (see
                onOpenSplitView). A session that cannot replace gets the
                "Open as" wording, since there it does open below. */}
            {canReplace ? 'Replace with split view' : 'Open as split view'}
          </Button>
          {canReplace ? (
            <ReplaceCurrentViewButton
              disabled={candidates.length === 0}
              onClick={() => {
                void onSubmit(true)
              }}
            />
          ) : null}
        </>
      }
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        void onSubmit()
      }}
    >
      <div className={classes.root}>
        {error ? <ErrorMessage error={error} /> : null}
        {!model.hasReadsForDerivativePaths ? (
          // Distinguished from "reads, but no path" because the two call for
          // opposite responses. This is the state a window too large for the
          // track's byte budget lands in: the pileup shows `force load` and
          // nothing has been fetched, so reporting an absence of paths would
          // send a reader looking for an event that was never read.
          <Typography>
            This track has not loaded reads for this window, so there is nothing
            to reconstruct from yet. If the pileup is asking to force load,
            narrow the window: the reconstruction reads SA tags, so the far side
            of a junction does not have to be on screen to be reconstructed.
          </Typography>
        ) : candidates.length === 0 ? (
          <Typography>
            No rearranged path is supported by more than one read in this
            window. Reconstruction reads split alignments, so it needs reads
            whose SA tag places part of them elsewhere: navigate to a
            breakpoint, and widen the window if the reads are long.
          </Typography>
        ) : (
          <>
            {/*
              One line, then the list. This used to open with two paragraphs
              explaining what each destination button draws (review: "i do not
              like the look of the dialog box"), which is eight lines of grey
              text above three short rows -- the buttons already carry those
              names, and the tutorial carries the rest. What stays is the
              sentence that says what a row IS, and the one caveat that changes
              which row a reader picks.
            */}
            <Typography>
              {candidates.length === 1
                ? 'One route through the reference, crossed in the same order and orientation by the reads counted below.'
                : 'Each route below is one that this many reads cross in the same order and orientation.'}
            </Typography>
            <Typography className={classes.caveat}>
              Read counts rank them; they do not vouch for them. A route whose
              segments are all about one read long is an aligner splitting a
              short read rather than an allele, which is what the strip and the
              sizes beside each row are for.
            </Typography>
            {candidates.length === 1 ? (
              <div
                // the real result of the reconstruction pass, so a screenshot
                // spec (and a test) can wait on the candidates existing rather
                // than on a timeout. Same testid on both shapes: what a caller
                // waits for is that the pass produced rows, not which control
                // it drew them in.
                data-testid="derivative-path-candidates"
                className={classes.soleCandidate}
              >
                {/* always false here — one candidate cannot disagree with
                    itself — and rightly so: with nothing to pick between, an
                    informational flag has even less claim on the row */}
                <CandidateRow
                  candidate={candidates[0]!}
                  showOffScreen={showOffScreen}
                />
              </div>
            ) : (
              <RadioGroup
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
                      <CandidateRow
                        candidate={candidate}
                        showOffScreen={showOffScreen}
                      />
                    }
                  />
                ))}
              </RadioGroup>
            )}
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
