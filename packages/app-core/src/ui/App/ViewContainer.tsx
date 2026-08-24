import { useEffect } from 'react'

import { useFocusOnInteraction, useWidthSetter } from '@jbrowse/core/util/hooks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import ViewHeader from './ViewHeader.tsx'
import ViewWrapper from './ViewWrapper.tsx'
import { useViewVisibility } from './useViewVisibility.ts'
import { viewTitle } from './viewTitle.ts'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

// Intended to keep views mounted within ~1.5 viewport-heights of the visible
// band. **It does nothing, and making it work was measured as a regression.**
//
// An observer clips the target against every scrolling ancestor before applying
// the margin, which expands only the root's box — and both view containers are
// `overflow-y: auto`, so through one of them `150% 0px` qualifies exactly the
// views a `0px` margin would. Rooting the observer at the scroll port instead
// (`scrollPortOf`) does restore the band, and it came out a wash on scroll cost
// while holding 9-13 live GPU canvases instead of 6. The mount band trades
// pipeline rebuilds for live contexts, and with the ceiling at 16 live WebGL2
// contexts the contexts are the tighter constraint.
// See agent-docs/reference/GPU_CONTEXT_BUDGET.md.
//
// So don't tune this number expecting an effect, and don't make it live without
// first cutting contexts per display.
const VIEW_VISIBILITY_ROOT_MARGIN = '150% 0px'

// Scroll-space reserved for a view that has never been measured yet, so a fresh
// load spreads views down the page instead of stacking them all in the viewport
// (which would mark them all visible and defeat the lazy mount).
const ESTIMATED_VIEW_HEIGHT = 400

// CALL THIS ONLY WHERE THE ESTIMATE IS ACTUALLY USED, i.e. under `reserveSpace`.
// A view's `height` is a computed over its track heights (LinearGenomeView's
// sums them), so reading it makes the caller an observer of every track resize
// and every display that grows with its data. Called unconditionally during
// render, that re-rendered the whole view chrome on each of those, to produce
// a placeholder height that only a hidden view ever shows. Measured: 2 chrome
// renders per height change became 0.
function viewHeight(view: AbstractViewModel) {
  return 'height' in view && typeof view.height === 'number'
    ? view.height
    : ESTIMATED_VIEW_HEIGHT
}

// Every view that waits on something before it can mount content models that
// wait as `showLoading`. Views without the getter are mounted content the moment
// they render — which is the trap, because a view that waits and *doesn't*
// declare it is indistinguishable from one that never waits, and reports ready
// over a body that is plainly working. Spreadsheet and SV inspector were exactly
// that until they got the getter, and a spreadsheet mounts no displays, so no
// display-level wait covered for them either.
//
// LGV, dotplot, synteny, circular and breakpoint-split paint a spinner in place
// of their whole body meanwhile. Spreadsheet is the exception and keeps its
// import wizard mounted with a spinner above it, since the chosen file, type and
// assembly are worth more on screen than a bare loading screen — the phase is
// about the model, not about which component is mounted.
//
// Two values, not one per render branch: an import form is finished content, not
// a pending state, so it reports ready like anything else.
function viewPhase(view: AbstractViewModel) {
  return 'showLoading' in view && view.showLoading === true
    ? 'loading'
    : 'ready'
}

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
    overflow: 'clip',
    // xref https://stackoverflow.com/questions/43909940/why-does-overflowhidden-prevent-positionsticky-from-working
    // note that contain:paint also seems to work

    // `:focus-visible`, never `:focus`. The container carries tabIndex={0}, and
    // a click on any non-focusable descendant of a tabbable node focuses that
    // node — so on `:focus` this ring would appear around the whole view on
    // essentially every click, which is a visible regression for every existing
    // mouse user. `:focus-visible`'s heuristic excludes exactly that case.
    //
    // Inset (`outlineOffset: -2`) because `overflow: clip` above and the
    // scroll port this sits in would clip a ring drawn outside the border box.
    //
    // `secondary.contrastText`, which is the same token the header's icons take,
    // because inset is what decides the color: the ring lands entirely on this
    // element's own secondary-colored band, so it has to contrast with THAT and
    // not with the page. `primary.main` was the reflex and is midnight (#0D233F)
    // against grape (#721E63) — drawn, measured on screen, and all but invisible.
    // contrastText is the one token guaranteed legible on this background
    // whatever an embedder's theme sets.
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.secondary.contrastText}`,
      outlineOffset: -2,
    },
  },
  focusedView: {
    background: theme.palette.secondary.main,
  },
  unfocusedView: {
    background: theme.palette.secondary.dark,
  },
}))

const ViewContainer = observer(function ViewContainer({
  view,
  session,
  scrollOnMount,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
  scrollOnMount?: boolean
}) {
  const ref = useWidthSetter(view)
  const { classes } = useStyles()
  const {
    ref: bodyRef,
    visible,
    measuredHeight,
  } = useViewVisibility(VIEW_VISIBILITY_ROOT_MARGIN)

  useFocusOnInteraction(ref, () => {
    session.setFocusedViewId(view.id)
  })

  // A minimized view renders no body, so it neither mounts the (GPU-heavy) view
  // component nor reserves placeholder scroll-space; a spacer would otherwise
  // re-expand the collapsed view to its pre-minimize height as soon as it
  // scrolled out of the viewport.
  const { minimized } = view
  const showBody = visible && !minimized
  const reserveSpace = !visible && !minimized

  // Tell the view whether its body is in the DOM. A display's phase counts its
  // first paint as pending work, and a body that was never mounted has no
  // canvas to paint — so without this an off-screen view holds the whole app's
  // readiness marker at `loading` forever. See `BaseViewModel.bodyMounted`.
  useEffect(() => {
    if (isAlive(view)) {
      view.setBodyMounted(showBody)
    }
  }, [view, showBody])

  // Only this container tracks focus now, not its header: with the arrow icon
  // in its own observer (ViewFocusIndicator) the header's props are unchanged
  // for every view but the two the focus moved between, so mobx-react's memo
  // holds and one click re-renders two headers rather than all of them.
  const backgroundColorClassName =
    session.focusedViewId === view.id
      ? classes.focusedView
      : classes.unfocusedView

  // Same title `ViewContainerTitle` shows, recomputed rather than shared through
  // a ref or aria-labelledby: the visible one lives inside an EditableTypography
  // whose rendered node is an <input> while it is being edited, and a label
  // pointing at an input reads back as the input, not as the name. Both of its
  // inputs (`displayName`, `assemblyNames`) are cold — a rename and a change of
  // displayed region — so this adds no per-frame read.
  const { assemblyManager } = session

  return (
    <Paper
      ref={ref}
      elevation={12}
      className={cx(classes.viewContainer, backgroundColorClassName)}
      // The view's one tab stop, and the only thing that makes the ctrl/cmd +
      // arrow shortcuts reachable without a mouse: they are gated on
      // `session.focusedViewId`, which `useFocusOnInteraction` now assigns from
      // `focusin`. It goes on the outermost node so there is exactly one stop
      // per view ahead of the header's own buttons, and so every view type gets
      // it rather than each one growing its own.
      tabIndex={0}
      // A tab stop with no role and no name announces as nothing. `region` is
      // the conservative reading — it is what the session's view stack is, a set
      // of labelled panels — and a named region shows up in a screen reader's
      // landmark list, so "jump to the second view" stops being a Tab count.
      role="region"
      aria-label={viewTitle(view, r => assemblyManager.getDisplayName(r))}
      data-testid={`view-container-${view.id}`}
      // the view-level counterpart of DisplayChrome's data-display-phase: while
      // this reads `loading` the view has no displays mounted, so every
      // display-level readiness signal is silent and a capture taken now lands on
      // a bare spinner (see waitForViewPhases in @jbrowse/browser-test-utils)
      data-view-phase={viewPhase(view)}
    >
      <ViewHeader
        view={view}
        className={backgroundColorClassName}
        scrollOnMount={scrollOnMount}
      />
      <Paper elevation={0}>
        {/* stays mounted even when empty, so the visibility observer keeps a
        stable node to watch */}
        <div
          ref={bodyRef}
          style={
            reserveSpace
              ? { height: measuredHeight ?? viewHeight(view) }
              : undefined
          }
        >
          {showBody ? <ViewWrapper view={view} session={session} /> : null}
        </div>
      </Paper>
    </Paper>
  )
})

export default ViewContainer
