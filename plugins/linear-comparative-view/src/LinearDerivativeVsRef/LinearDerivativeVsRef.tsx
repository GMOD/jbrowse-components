import { useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { ErrorMessage, SubmitDialog, replaceViewAction } from '@jbrowse/core/ui'
import {
  addOrReplaceView,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
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
  derivativePathTestIds,
  selectedCandidateIndex,
} from './buildDerivativeVsRefSpec.ts'
import {
  MAX_SPLIT_PANELS,
  buildSplitViewFromPath,
} from './buildSplitViewFromPath.ts'
import { segmentSizeSummary } from './pathStripBlocks.ts'

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
  // Set off from the route list above it, which is the dialog's other radio
  // group: a rule and a label say these are two questions, not eleven rows of
  // one.
  drawAs: {
    // full width, so the rule reads as a divider across the dialog rather than
    // as an underline under the label — a FormControl is only as wide as the
    // radio row inside it
    width: '100%',
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
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
    inlineConf?: Record<string, unknown>,
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
// of reads describes, ranked by how many of them do; picking one draws it, as
// either of the two pictures under "Draw as". Nothing here decides whether a
// path is real — the read count is the evidence offered, and the view is where a
// person judges it.
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
  // The chosen ROUTE, not a row number. `derivativePathCandidates` is computed
  // from the reads in view, so it re-ranks whenever more of them land -- and
  // this dialog is opened over a pileup that is often still streaming, which is
  // exactly when a new route can outrank the one under the cursor. Holding an
  // index means the selection silently slides onto a different allele between
  // the click and the draw.
  //
  // The route rather than its `locString`, which was the same bug one step
  // quieter. A locstring carries the path's OUTER edges, and those come from
  // whichever supporting read is widest -- so one wider read landing in the
  // group the user already picked rewrites its locstring, the lookup misses,
  // and the selection drops back to row 0. Same streaming that motivates
  // holding a route at all, and it needs no re-ranking to fire.
  //
  // `selectedCandidateIndex` is where the lookup lives, because `pathId` alone
  // does not quite finish the job: it is the junctions, but the junctions carry
  // clustered coordinates a later read can still relabel.
  const [picked, setPicked] = useState<DerivativeCandidate>()
  const [error, setError] = useState<unknown>()
  // WHAT to draw, kept here beside WHICH route because both are properties of
  // the reconstruction; the buttons then answer only where it goes, in the same
  // two words every other launch dialog uses. Three buttons that mixed the two
  // questions could not be labelled (review: "'replace with split view' and
  // 'replace current view' are unclear what they would do").
  const [drawAs, setDrawAs] = useState<'synteny' | 'split'>('synteny')

  // Above every read of the two props, which is the whole of the backstop:
  // "Replace current view" detaches the launching view and destroys it a task
  // later (`scheduleDetachedDestroy`), and both `track` and `model` live in it.
  // The reads then split two ways. `getSession`/`getContainingView` below WALK,
  // and a walk from a destroyed node throws, out of `DialogQueue`, which sits
  // above every per-view ErrorBoundary — the whole page became jbrowse-web's
  // fatal-error dialog. `model.derivativePathCandidates` is the quieter half: a
  // dead node's computed warns from `assertAlive` and hands back whatever it
  // last cached, so it renders a stale list rather than throwing.
  //
  // It used to sit below the derivations, where the quiet half ran first and
  // the guard could not cover it. Hooks are all above; nothing else may go
  // between. MST's `isAlive` is observable, so the render that sees it flip is
  // the one the destroy schedules.
  if (!isAlive(track)) {
    return null
  }

  const ranked = model.derivativePathCandidates
  // A window that produces dozens of paths has said something about all of them,
  // so the overflow is reported rather than dropped: it is the difference
  // between "here is the event" and "these reads map everywhere".
  const candidates = ranked.slice(0, MAX_SHOWN)
  // decided once, for the list, because that is what it is a property of
  const showOffScreen = showsOffScreenFlag(candidates)
  const testIds = derivativePathTestIds(candidates)
  const selected = selectedCandidateIndex(candidates, picked)
  // Whether the split drawing is offered for the route now selected, so the two
  // radio groups stay independent: a reader who picked "Breakpoint split view"
  // over a three-segment route and then moves to a 900-segment one would
  // otherwise carry that choice onto a route it cannot draw. Derived rather than
  // synced, so `drawAs` keeps the reader's answer and comes back when they move
  // to a route it fits.
  const splitPanels = candidates[selected]?.segments.length ?? 0
  const splitTooLong = splitPanels > MAX_SPLIT_PANELS
  const effectiveDrawAs = splitTooLong ? 'synteny' : drawAs

  // The same candidate, drawn the other way the tutorial contrasts: stacked
  // reference panels rather than the derivative's own axis. It exists because
  // the alternative is the import form, where a person types one row per
  // chromosome by hand -- which loses the ORDER the reads cross the loci in, and
  // silently merges a path that visits one chromosome twice into a single
  // panel. The candidate already knows both, so nothing here is typed.
  async function drawSplitView(
    candidate: DerivativeCandidate,
    replace: boolean,
  ) {
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
    // Read BEFORE the replace below, like `drawSynteny` reads its carried
    // track list: replacing destroys the launching view, and `track` lives in
    // it.
    const [trackAssembly] = getConf(track, 'assemblyNames') as string[]
    // "Replace current view" is the destination this drawing is usually
    // wanted at, and the one the docs and figures take: unlike the synteny
    // reconstruction, the split view carries the launching view's OWN tracks
    // and its first panel opens on the segment the pileup is already showing,
    // so leaving that view standing above it is a second copy of the same
    // locus with the same tracks, one scroll apart. (Reviewer, on the figure
    // of exactly that: "too chaotic ... should also use 'replace view'".)
    const created = addOrReplaceView({
      session,
      typeName: 'BreakpointSplitView',
      initialState: viewSnapshot,
      replacing: replace ? (view as AbstractViewModel) : undefined,
    }) as unknown as {
      views: { navToLocString: (l: string, asm: string) => Promise<void> }[]
    }
    // Before the navigation, not after it, and this is the ordering the bug
    // was. A replace detaches the launching view and destroys it a task later
    // (`scheduleDetachedDestroy`), and `track` lives in it — so a dialog left
    // mounted across an await is a dialog whose next render walks a dead node.
    // `getContainingView(track)` in the body below is that walk, and it THROWS,
    // out of `DialogQueue`, which sits above every per-view ErrorBoundary: the
    // whole page became jbrowse-web's fatal-error dialog. `drawSynteny` closes
    // in the same tick and never saw it.
    //
    // Navigation errors therefore go to the session rather than into `error`
    // below: this component is gone by the time one can arrive.
    handleClose()
    await Promise.all(
      locStrings.map(async (loc, idx) => {
        try {
          await created.views[idx]?.navToLocString(loc, trackAssembly!)
        } catch (e) {
          session.notifyError(`Could not navigate to ${loc}`, e)
        }
      }),
    )
  }

  async function drawSynteny(candidate: DerivativeCandidate, replace: boolean) {
    const session = getSession(track)
    const view = getContainingView(track) as { tracks?: ViewTrack[] }
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
    // The config travels on the track rather than into any session list. It is
    // a per-launch `FromConfigAdapter` over the synthetic derivative axis, so
    // nothing outside this view can draw it and nothing outside this view should
    // outlive it — closing the panel's track takes the config with it, and no
    // session list has to be swept afterwards. Same footing as the synteny band
    // above, whose config the view spec carries the same way.
    if (derivativePanel) {
      showWhenMeasured(derivativePanel, () => {
        derivativePanel.showTrack?.(
          segmentsTrack.trackId,
          {},
          segmentsDisplay,
          segmentsTrack,
        )
      })
    }
    handleClose()
  }

  // The one thing both buttons do, differing only in where the drawing lands.
  function draw(replace: boolean) {
    const candidate = candidates[selected]
    if (!candidate) {
      return
    }
    const drawn =
      effectiveDrawAs === 'split'
        ? drawSplitView(candidate, replace)
        : drawSynteny(candidate, replace)
    drawn.catch((e: unknown) => {
      console.error(e)
      setError(e)
    })
  }

  return (
    <SubmitDialog
      // The two destinations every launch dialog offers, worded as they word
      // them (the synteny launches, "read vs ref"), because that is all these
      // buttons decide now: what gets drawn is the "Draw as" choice in the body,
      // beside the route it is drawn from.
      {...replaceViewAction({
        session: getSession(track),
        sourceView: getContainingView(track),
        disabled: candidates.length === 0,
        onReplace: () => {
          draw(true)
        },
      })}
      open
      title="Reconstruct derivative allele"
      // Named unconditionally, unlike the other launch dialogs: with no replace
      // button beside it this is still the one thing it does, and the body above
      // it is already a form of choices rather than a confirmation.
      submitText="Open in new view"
      submitDisabled={candidates.length === 0}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        draw(false)
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
              explaining what each drawing looks like (review: "i do not like
              the look of the dialog box"), which is eight lines of grey text
              above three short rows -- the "Draw as" options below carry those
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
                  setPicked(candidates[+event.target.value])
                }}
              >
                {candidates.map((candidate, idx) => (
                  <FormControlLabel
                    key={candidate.pathId}
                    data-testid={testIds[idx]}
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
            <FormControl className={classes.drawAs}>
              <FormLabel>Draw as</FormLabel>
              {/* Named as the VIEW TYPES they open, the names the Add menu and
                  every other launch already use, rather than as descriptions of
                  what each one draws (review: "is it breakpoint split view? or
                  synteny view? ... it helps to use our existing wording"). A row
                  rather than a column: it is a second question, not two more
                  rows of the first. */}
              <RadioGroup
                row
                value={effectiveDrawAs}
                onChange={event => {
                  setDrawAs(
                    event.target.value === 'split' ? 'split' : 'synteny',
                  )
                }}
              >
                <FormControlLabel
                  data-testid="derivative-draw-as-synteny"
                  value="synteny"
                  control={<Radio />}
                  label="Linear synteny view"
                />
                <FormControlLabel
                  data-testid="derivative-draw-as-split"
                  value="split"
                  control={<Radio />}
                  disabled={splitTooLong}
                  label="Breakpoint split view"
                />
              </RadioGroup>
              {/* Greyed out with the count said, because the reason is a fact
                  about the ROUTE and not about the control: this drawing is one
                  panel per segment, so the reader is being told how many panels
                  they asked for. The synteny drawing takes the same route on one
                  axis and stays offered, so the sentence names it. */}
              {splitTooLong ? (
                <FormHelperText>
                  {splitPanels} segments is one panel per segment past what this
                  view can show; the synteny drawing takes the whole route on
                  one axis.
                </FormHelperText>
              ) : null}
            </FormControl>
          </>
        )}
      </div>
    </SubmitDialog>
  )
})

export default DerivativeVsRefDialog
