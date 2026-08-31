import { lazy } from 'react'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import {
  avg,
  getDialogHost,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { installLinkedViewSync } from '@jbrowse/plugin-linear-genome-view'
import {
  collectTrackWarnings,
  releaseTemporaryAssemblies,
} from '@jbrowse/synteny-core'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun } from 'mobx'

import { linearSyntenyViewHelperModelFactory } from '../LinearSyntenyViewHelper/stateModelFactory.ts'
import { followDirection } from '../SyntenyFollow/followDirection.ts'
import { installSyntenyFollow } from '../SyntenyFollow/installSyntenyFollow.ts'
import { levelHeightForCount } from './levelHeightBudget.ts'
import { sharedFit } from './sharedFit.ts'

import type { FollowPartialReport } from '../SyntenyFollow/installSyntenyFollow.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackContainer } from '@jbrowse/core/util'
import type { DisplayInitialSnapshot } from '@jbrowse/core/util/tracks'
import type {
  IAnyModelType,
  Instance,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'
import type {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { ComparativeWarning } from '@jbrowse/synteny-core'

// lazies
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)

// The display's own warning row, not a second declaration of the same two
// fields: the shape is `ComparativeWarning`, and a local copy meant a field
// added there simply never reached this view's report.
export type SyntenyWarning = ComparativeWarning

/**
 * #stateModel LinearComparativeView
 */
function stateModelFactory(pluginManager: PluginManager) {
  // Annotated rather than inferred to break a type cycle that is real but
  // purely at the type level: this model -> level -> LinearSyntenyDisplay
  // (which types its `view` getter as LinearSyntenyViewModel) -> this model.
  // The runtime import is acyclic. This is what makes `levels[i]` untyped at
  // use sites — not anything about how the level is registered.
  const LinearSyntenyLevel: IAnyModelType =
    linearSyntenyViewHelperModelFactory(pluginManager)
  return types
    .compose(
      'LinearComparativeView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         * Abstract base: never registered or instantiated standalone, always
         * composed into a concrete subclass (e.g. LinearSyntenyView) that
         * overrides `type` with its own literal. Kept as `types.string` rather
         * than a literal so subclass models stay assignable to this base type.
         */
        type: types.string,
        /**
         * #property
         * vestigial: the hierarchical selector is the only one that exists, so
         * this value is ignored. Retained because saved sessions and configs
         * persist it.
         */
        trackSelectorType: types.stripDefault(types.string, 'hierarchical'),
        /**
         * #property
         * sync scroll and zoom across the genome rows, so panning one pans
         * them all
         */
        linkViews: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Move the non-anchor genome rows to whatever region aligns to the
         * anchor row, re-resolved through the synteny data each time the anchor
         * settles. The synteny-aware alternative to `linkViews`, which locks the
         * rows in PIXELS and so drifts apart as soon as an indel accumulates —
         * the two are mutually exclusive (see setRowSyncMode).
         */
        followSynteny: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Hold every genome row on one bp/px — the coarsest row's fit — so the
         * rows compare by drawn length instead of all filling their pane. A
         * mode rather than a one-shot zoom because it is the rows' zoom-out
         * LIMIT it moves (`sharedFit`), and a limit has to still be there on
         * the next wheel tick.
         */
        sameScale: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Which genome row drives the others while `followSynteny` is on. Every
         * other row is placed by mapping this one's window outward one level at
         * a time. Clamped to the views array by reconcileLevels.
         */
        followAnchorIndex: types.stripDefault(types.number, 0),
        /**
         * #property
         * While following, flip a row whose placing alignment runs the other
         * way from the anchor's, so the two pan in the same direction. Off by
         * default: the crossing ribbons are the picture of an inversion, and
         * a row turning round under the reader is the loudest thing one can do.
         */
        followMatchOrientation: types.stripDefault(types.boolean, false),
        /**
         * #property
         * One synteny band per adjacent pair of `views`. Each holds its own
         * track list, which is why the track-selector and add-track widgets
         * address them through `trackContainerFor` — a level is not a view and
         * cannot be the target of their `view` reference.
         */
        levels: types.array(LinearSyntenyLevel),
        /**
         * #property
         * N genome rows, with N-1 synteny `levels` between adjacent pairs. The
         * views/levels invariant is maintained by reconcileLevels().
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      width: undefined as number | undefined,
      /**
       * #volatile
       * View-level failure (e.g. an `init` block that couldn't be applied).
       * Volatile on purpose: a reload re-runs the init autorun from a clean
       * slate, so a transient failure stays recoverable.
       */
      volatileError: undefined as unknown,
      /**
       * #volatile
       * The follow found no alignment over the anchor row's window on its last
       * pass, so the other rows are holding position. What the header's follow
       * button reports; without it the rows simply stop tracking, which is the
       * same picture as a broken follow. Volatile because it describes the
       * current window, not the session.
       */
      followUnaligned: false,
      /**
       * #volatile
       * The follow placed a row by mapping the anchor window proportionally
       * rather than by walking a CIGAR, so its position is close but not
       * base-exact — a window wider than one alignment, or a tier carrying no
       * CIGAR. What the header's follow tooltip reports; nothing else in the
       * view distinguishes the two.
       */
      followApproximate: false,
      /**
       * #volatile
       * The follow had a multi-contig answer and refused it: placing a row on
       * two regions that are not neighbours in its layout puts every contig
       * between them on screen too, and past a point that is nearly all of what
       * the reader is looking at. The rows are on one of the anchor's regions
       * instead, and this names it and the ones whose answers are therefore off
       * screen — enough for the header to say which region to scroll onto to
       * see those instead. Read only by the header's follow tooltip.
       */
      followPartial: undefined as FollowPartialReport | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * scroll-to-zoom is a global, personal preference resolved from the
       * session; toggling it in any view applies everywhere
       */
      get scrollZoom() {
        return getSession(self).scrollZoom
      },
      /**
       * #getter
       */
      get initialized() {
        /* oxlint-disable typescript/no-unnecessary-condition -- width is nominally number but undefined before first layout */
        return (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          self.width !== undefined &&
          self.views.length > 0 &&
          self.views.every(view => view.initialized)
        )
        /* oxlint-enable typescript/no-unnecessary-condition */
      },

      /**
       * #getter
       */
      get error(): unknown {
        // resolved, like LGV's and dotplot's: it folds in the sub-views, whose
        // assemblies are what `initialized` waits on. Without them a failed
        // assembly left this empty while `initialized` stayed false forever, so
        // `showLoading` spun instead of falling back to the import form with the
        // banner, and an SVG export waited on it with nothing to report
        return self.volatileError ?? self.views.find(v => v.error)?.error
      },

      /**
       * #getter
       */
      get assemblyNames() {
        return [...new Set(self.views.flatMap(v => v.assemblyNames))]
      },

      /**
       * #getter
       * The zoom-out limit every row shares while `sameScale` is on, and
       * whether it can be answered at all. Each row PULLS this back through its
       * own `maxBpPerPx` (`sharedScaleContainerOf` finds this view by the
       * presence of this getter), so nothing here is copied onto the rows and
       * nothing can go stale between a resize and the next layout. The
       * dotplot's `lockAspectRatio` derives the same quantity the same way.
       *
       * The rule, and why the unanswered state is not a zero, are in
       * `sharedFit.ts`.
       */
      get sharedFit() {
        return sharedFit(self.views, self.sameScale)
      },

      /**
       * #getter
       * Every synteny display across every level, flattened. One memoized
       * getter for the view-wide aggregates that would otherwise each
       * re-flatten the levels.
       */
      get allSyntenyDisplays() {
        return self.levels.flatMap(l => l.linearSyntenyDisplays)
      },

      /**
       * #getter
       * Each synteny level resolved into the pair of rows a follow would move
       * it between: which row stays, which row moves, which axis the anchor
       * window is read off, and the assembly naming the level's lane of an
       * all-vs-all track. Levels whose rows are not both initialized are
       * dropped, since there is nothing to place yet.
       *
       * A getter rather than a loop in each caller because the follow reads it
       * from TWO autoruns — the exact one and the per-frame one — which had
       * each resolved the direction, looked the two rows up and repeated the
       * initialized guard. Those are the same question, and the answer changes
       * only when the rows or the anchor do.
       *
       * ORDERED OUTWARD FROM THE ANCHOR rather than by level index, which is
       * what makes a stack of three or more settle in one pass: a level's
       * staying row is either the anchor or a row some nearer level places, so
       * visiting them nearest-first means every level reads an input the same
       * pass has already written. In level order that only holds when the
       * anchor is the top row.
       */
      get followPairs() {
        const { followAnchorIndex } = self
        return self.levels
          .map(level => ({
            level,
            ...followDirection(level.level, followAnchorIndex),
          }))
          .sort((a, b) => a.distance - b.distance)
          .flatMap(({ level, stayingIndex, movingIndex, toMate }) => {
            const stayingView = self.views[stayingIndex]
            const movingView = self.views[movingIndex]
            return stayingView?.initialized && movingView?.initialized
              ? [
                  {
                    level,
                    stayingView,
                    movingView,
                    toMate,
                    movingIndex,
                    // the level's LOWER row is the one on the alignments' mate
                    // axis whichever direction the level runs in
                    mateAssembly: self.views[level.level + 1]?.assemblyNames[0],
                  },
                ]
              : []
          })
      },

      /**
       * #getter
       * Data-quality warnings raised by every synteny display, e.g. a reversed
       * assembly row order. What the header's warning button counts.
       */
      get syntenyWarnings(): SyntenyWarning[] {
        return this.allSyntenyDisplays.flatMap(d => d.warnings)
      },
      /**
       * #getter
       * The same warnings grouped under the track that raised each, which is
       * what the dialog reports. A stacked view's levels raise
       * `swappedAssembliesWarning` verbatim, and so does every overlaid track
       * that hits it, so the flat list above was N identical rows with nothing
       * to tell the user which file to go fix. Shared with the dotplot's table
       * so the two reports say the same thing.
       */
      get trackWarnings() {
        return collectTrackWarnings(this.allSyntenyDisplays)
      },

      /**
       * #method
       * The level that owns a given track list. This view holds one track list
       * per synteny band rather than one of its own, so the track-selector and
       * add-track widgets target a level through here instead of referencing
       * this view directly. By id, not index: reconcileLevels pops levels when
       * a genome row is removed, and an index would silently retarget a
       * different pair.
       */
      trackContainerFor(id: string): TrackContainer | undefined {
        return self.levels.find(level => level.id === id)
      },
      /**
       * #getter
       * The same track lists, for a reader with no id to ask with. This view
       * has no `tracks` of its own, so anything walking a session for displays
       * — `AppReadyMarker`, the capture harness's busy probe — sees an empty
       * view and reports a still-fetching synteny stack as idle unless it asks
       * here too.
       */
      get trackContainers(): TrackContainer[] {
        return [...self.levels]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Written by the follow's autorun and read only by the header, which is
       * what keeps it from being a dependency of the very pass that writes it.
       *
       * In THIS block, ahead of afterAttach, rather than with the other follow
       * actions below: a later block's actions are not on the `self` an earlier
       * one sees, so anything afterAttach calls has to be declared before it —
       * the same reason `reconcileLevels` is here.
       */
      setFollowUnaligned(arg: boolean) {
        self.followUnaligned = arg
      },
      /**
       * #action
       * Same terms as setFollowUnaligned above: written by the autorun, read
       * only by the header.
       */
      setFollowApproximate(arg: boolean) {
        self.followApproximate = arg
      },
      /**
       * #action
       * Same terms again: written by the autorun, read only by the header.
       */
      setFollowPartial(arg: FollowPartialReport | undefined) {
        self.followPartial = arg
      },
      /**
       * #action
       * The one way the UI changes how the rows track each other, so the two
       * flags can't both be on. They fight if they are: `linkViews` replays the
       * anchor's own scroll/zoom onto every row, which is precisely the pixel
       * lock the follow then has to undo on the next settle, and the moving row
       * visibly jumps twice.
       *
       * Here rather than beside `setLinkViews` for the reason above
       * setFollowUnaligned: the follow's own snackbar offers this as the way out
       * of a row it moved back, so afterAttach's `installSyntenyFollow` has to
       * see it on `self`.
       */
      setRowSyncMode(mode: 'independent' | 'link' | 'follow') {
        self.linkViews = mode === 'link'
        self.followSynteny = mode === 'follow'
      },
      /**
       * #action
       * Same terms as setRowSyncMode above, and offered beside it in that same
       * snackbar: which row drives is otherwise a submenu away.
       */
      setFollowAnchorIndex(idx: number) {
        self.followAnchorIndex = idx
      },
      /**
       * #action
       * Reconcile the levels array to the views array: exactly one synteny
       * level per gap between adjacent views (N views -> N-1 levels). Grows or
       * shrinks from the end, preserving existing levels and their tracks. The
       * single source of truth for the views/levels invariant.
       */
      reconcileLevels() {
        while (self.levels.length < self.views.length - 1) {
          self.levels.push(
            cast({
              level: self.levels.length,
              // A band added to a stack that already has one matches its
              // neighbour rather than arriving at the type's 100px default.
              // The default is only ever right for the first level: past that
              // the stack has already been given a height — the band budget
              // `autoScaleLevelHeights` split across it, or one the user
              // dragged — and a level materialized at 100 among 64s reads as a
              // mis-sized row. Growth doesn't re-split the budget (that would
              // discard a hand-resize); "Auto-scale level heights" re-applies
              // it on demand.
              height: self.levels.at(-1)?.height,
            }),
          )
        }
        while (self.levels.length > Math.max(self.views.length - 1, 0)) {
          self.levels.pop()
        }
        // The follow anchor addresses a row, so it is clamped here rather than
        // in its setter: every path that changes the views array comes through
        // this one (afterAttach, setViews, addView, removeLastRow), and a
        // snapshot can arrive with an anchor its views cannot support.
        self.followAnchorIndex = Math.min(
          Math.max(self.followAnchorIndex, 0),
          Math.max(self.views.length - 1, 0),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        // A snapshot can arrive with a levels array that doesn't match its
        // views: hand-authored multi-way sessions typically write `views` and
        // leave `levels` out entirely, which would otherwise render N-1 rows of
        // synteny as zero or one. The actions below keep the invariant once the
        // view is live; this is the same repair applied to what was loaded.
        self.reconcileLevels()
        // The same repair for the other pair of properties that cannot both
        // hold. `setRowSyncMode` is the only writer that enforces it, so a
        // snapshot naming both arrives with neither half of the exclusion
        // applied and nothing downstream resolves it: the header reports
        // `follow` (menus.ts picks it first) while the middleware below keeps
        // replaying the anchor's pixel scroll onto every row, which is the
        // fight `setRowSyncMode` exists to prevent. Follow wins, matching what
        // the header already says.
        if (self.followSynteny) {
          self.linkViews = false
        }
        // doesn't link showTrack/hideTrack, doesn't make sense in synteny
        // views most time
        installLinkedViewSync(self, ['horizontalScroll', 'zoomTo'])
        // The synteny-aware sibling of the line above, and mutually exclusive
        // with it (setRowSyncMode). Installed unconditionally: its autorun's
        // first read is the flag, so it costs one observable read while off.
        installSyntenyFollow(self)
        addDisposer(
          self,
          autorun(
            function comparativeViewWidthAutorun() {
              if (self.width) {
                for (const view of self.views) {
                  view.setWidth(self.width)
                }
              }
            },
            { name: 'ComparativeViewWidth' },
          ),
        )
        // Rows pull the ceiling, but `bpPerPx` is clamped only where it is
        // written, so a ceiling that DROPS strands them above it until
        // something writes. Skipped while unanswered — that is a row mid-layout
        // rather than a release.
        //
        // `sameScale` as well, because `answered` is not the same question:
        // mode off answers 0 without reading a row, so this ran on the first
        // pass of every restored stack. There is no shared ceiling then, and
        // nothing to re-clamp — each row's own limit is already applied
        // wherever its `bpPerPx` is written — so the pass had only side
        // effects: `width` throws before layout, and once past that it dragged
        // a restored row that had been saved zoomed out past its own fit back
        // in, which nobody asked it to do.
        addDisposer(
          self,
          autorun(
            function comparativeViewSameScaleAutorun() {
              if (self.sameScale && self.sharedFit.answered) {
                for (const view of self.views) {
                  if (view.initialized) {
                    view.clampZoomToCeiling()
                  }
                }
              }
            },
            { name: 'ComparativeViewSameScale' },
          ),
        )
      },

      // automatically removes session assemblies associated with this view
      // e.g. read vs ref. Both hooks, and `releaseTemporaryAssemblies` says
      // why: `removeView` detaches before it destroys, so the reach for the
      // session has to happen at the detach.
      beforeDetach() {
        releaseTemporaryAssemblies(self)
      },
      beforeDestroy() {
        releaseTemporaryAssemblies(self)
      },

      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
      },

      /**
       * #action
       */
      setError(e: unknown) {
        self.volatileError = e
      },

      /**
       * #action
       */
      setViews(views: SnapshotIn<LinearGenomeViewModel>[]) {
        self.views = cast(views)
        self.levels = cast([])
        self.reconcileLevels()
        // rebuilding the view supersedes whatever failed last time, e.g. a
        // re-submit from the import form after a bad init
        self.volatileError = undefined
      },

      /**
       * #action
       * Push a new genome row. The new trailing level starts with no synteny
       * tracks.
       */
      addView(view: SnapshotIn<LinearGenomeViewModel>) {
        self.views.push(view)
        self.reconcileLevels()
      },

      /**
       * #action
       * Drop the bottom genome row and its synteny level. Only terminal removal
       * is supported: a level's `level` index addresses views[level]/[level+1],
       * so removing a middle row would require reindexing every level below it.
       * Growth and shrinkage both happen at the end of the chain.
       */
      removeLastRow() {
        if (self.views.length > 0) {
          self.views.pop()
          self.reconcileLevels()
        }
      },

      /**
       * #action
       * Kept for the plugin ABI; `setRowSyncMode` is what the UI calls. It
       * still has to drop the follow, since the exclusion below is a property
       * of the two flags rather than of the action that happens to set them.
       */
      setLinkViews(arg: boolean) {
        self.linkViews = arg
        if (arg) {
          self.followSynteny = false
        }
      },
      /**
       * #action
       */
      setFollowMatchOrientation(arg: boolean) {
        self.followMatchOrientation = arg
      },
      /**
       * #action
       */
      setScrollZoom(arg: boolean) {
        getSession(self).setScrollZoom(arg)
      },
      /**
       * #action
       */
      activateTrackSelector(level: number) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const selector = session.addWidget(
            'HierarchicalTrackSelectorWidget',
            'hierarchicalTrackSelector',
            {
              view: self.id,
              trackContainerId: self.levels[level]?.id,
            },
          )
          session.showWidget(selector)
          return selector
        }
        throw new Error('session does not support widgets')
      },

      /**
       * #action
       */
      toggleTrack(trackId: string, level = 0) {
        return self.levels[level]?.toggleTrack(trackId)
      },

      /**
       * #action
       * No-op for a level that doesn't exist, matching hideTrack/toggleTrack.
       * reconcileLevels already materializes exactly one level per adjacent view
       * pair, so a missing level means the caller named a gap that has no views
       * (e.g. an `init.tracks` with more levels than `init.views` has gaps);
       * creating one here would append a level whose views[level+1] is absent,
       * which renders nothing and silently breaks the views/levels invariant.
       */
      showTrack(
        trackId: string,
        level = 0,
        // annotated rather than inferred: a bare `{}` accepts a number, which is
        // what let the dotplot's two-argument twin pass an
        // `applySyntenyTrackSelections` level off as a track snapshot
        initialSnapshot: object = {},
        displayInitialSnapshot: DisplayInitialSnapshot = {},
        inlineConf?: Record<string, unknown>,
      ) {
        self.levels[level]?.showTrack(
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
          inlineConf,
        )
      },

      /**
       * #action
       */
      hideTrack(trackId: string, level = 0) {
        self.levels[level]?.hideTrack(trackId)
      },
      /**
       * #action
       * Every row onto the rows' average bp/px, each staying where it is.
       *
       * `zoomTo` anchors at the row's centre — the same call `applySharedScale`
       * below makes, and the same thing this used to spell as `pxToBp` at the
       * midpoint, `setNewView`, and `centerAt` back onto that base. That
       * spelling scrolled to the row's OLD pixel offset in between, which
       * `centerAt` then undid; a row whose midpoint resolved to no refName
       * (scrolled past its regions) kept it, and was left at the new scale on
       * the old offset.
       */
      squareView() {
        const average = avg(self.views.map(v => v.bpPerPx))
        for (const view of self.views) {
          view.zoomTo(average)
          // a discrete jump, so the coarse blocks flush rather than waiting out
          // their debounce — `setNewView`/`centerAt` did this for us before
          view.settleCoarseBlocks()
        }
      },
      /**
       * #action
       * Every row onto its whole assembly, and the one choice about it: leave
       * them all on ONE bp/px — the coarsest row's fit, so the largest genome
       * fills its pane and every other row is drawn shorter in proportion to
       * its size — or hand each row its own fit, so each fills its own pane.
       *
       * That difference is the point of offering the choice: rows fit
       * individually to width all end up the same length, which silently
       * stretches a small genome to look like a large one and misaligns every
       * ribbon between them by the ratio. Distinct from squareView, which
       * averages the rows' current scales (the average fits nobody, and each
       * row's own zoom clamp pulls the small ones back to fit-to-width anyway).
       *
       * ONE ACTION FOR BOTH, because the menu offers them as one radio and a
       * reader reads them as one sentence with one word changed. Written as two
       * bodies they drifted: the same-scale half took its scale off whatever
       * region subset a row happened to be displaying while the other half
       * reset the rows first, so the pair was not a pair — switching between
       * them did not land back where it started.
       *
       * `sameScale` LATCHES rather than firing once, because the shared scale
       * is coarser than a small row's own fit: without the raised ceiling the
       * first wheel tick or `setDisplayedRegions` clamps that row straight back
       * to fit-to-width and the comparison is gone.
       */
      showAllRegionsAcrossRows(sameScale: boolean) {
        this.setSameScale(sameScale)
        for (const view of self.views) {
          view.showAllRegionsInAssembly()
        }
        // Second pass: a row's fit moves with its regions, so the ceiling is
        // only settled once every row above has been reset.
        for (const view of self.views) {
          view.showAllRegions()
        }
      },
      /**
       * #action
       */
      setSameScale(sameScale: boolean) {
        self.sameScale = sameScale
      },
      /**
       * #action
       * Latch the mode and zoom every row onto the scale it implies, without
       * touching any row's regions or its centre — `init` names a `loc` per
       * row, and both a region reset and a re-centre would throw that away.
       * `zoomTo` anchors at the centre, which is the difference.
       */
      applySharedScale() {
        this.setSameScale(true)
        for (const view of self.views) {
          if (view.initialized) {
            view.zoomTo(view.maxBpPerPx)
          }
        }
      },
      /**
       * #action
       */
      clearView() {
        self.views = cast([])
        self.levels = cast([])
        self.volatileError = undefined
      },
      /**
       * #action
       */
      compactAllViews() {
        for (const view of self.views) {
          view.setScalebarOnly(true)
        }
      },
      /**
       * #action
       */
      expandAllViews() {
        for (const view of self.views) {
          view.setScalebarOnly(false)
        }
      },
      /**
       * #action
       * Resize every synteny band by the same delta. The bars between the rows
       * size the STACK: a multi-way view is read as one picture, and sizing its
       * gaps one at a time to match is the tedium the user actually hits — the
       * levels keep whatever differences they already have, since this moves
       * each by the same px rather than setting them all to one height.
       *
       * Each level clamps its own drag (`LinearSyntenyViewHelper.resizeHeight`),
       * which is also what one band's Alt-drag goes through — so the floor that
       * keeps a bar grabbable is stated once, for both.
       */
      resizeAllLevelHeights(distance: number) {
        for (const level of self.levels) {
          level.resizeHeight(distance)
        }
      },
      /**
       * #action
       */
      autoScaleLevelHeights() {
        const numLevels = self.levels.length
        if (numLevels > 0) {
          const targetHeight = levelHeightForCount(numLevels)
          for (const level of self.levels) {
            level.setHeight(targetHeight)
          }
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Append an assembly to the bottom of the stack and optionally show a
       * synteny track on the new level connecting it to the previous bottom
       * row. A synteny dataset is an edge between two adjacent assemblies, so
       * rows are only ever added at the chain's end.
       *
       * The new row is created with a LinearGenomeView `init` — its own
       * afterAttach autorun loads the assembly regions and navigates (whole
       * genome, or `loc` when given), so we don't reimplement that imperatively
       * here.
       */
      appendRow({
        assembly,
        loc,
        syntenyTrackId,
      }: {
        assembly: string
        loc?: string
        syntenyTrackId?: string
      }) {
        const level = self.views.length - 1
        self.addView({
          type: 'LinearGenomeView',
          hideHeader: true,
          assembly,
          loc,
        })
        if (syntenyTrackId) {
          self.showTrack(syntenyTrackId, level)
        }
      },
    }))
    .views(() => ({
      /**
       * #method
       * The view header's own hamburger, overridden by subclasses. A SEPARATE
       * list from `menuItems()`, not a subset of it: that one is what the app
       * menubar shows for any view, this one is what the view's own header
       * offers, and a subclass fills them independently.
       */
      headerMenuItems(): MenuItem[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menuItems(): MenuItem[] {
        return [
          {
            label: 'Return to import form',
            onClick: () => {
              getDialogHost(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
            icon: FolderOpenIcon,
          },
        ]
      },
      /**
       * #method
       */
      rubberBandMenuItems() {
        // captured here rather than read inside onClick: the menu's onClose
        // runs first and releases the selection, so a live read sees undefined
        // and the zoom silently no-ops
        const selection = self.views.map(view => ({
          view,
          leftOffset: view.leftOffset,
          rightOffset: view.rightOffset,
        }))
        return [
          {
            label: 'Zoom to region(s)',
            onClick: () => {
              for (const { view, leftOffset, rightOffset } of selection) {
                if (leftOffset && rightOffset) {
                  view.moveTo(leftOffset, rightOffset)
                }
              }
            },
          },
        ]
      },
    }))
    .preProcessSnapshot<
      // legacy snapshots stored `tracks` at the top level before the `levels`
      // restructure; accept the loose shape and let MST revalidate at runtime
      | ({ tracks?: unknown; levels?: unknown } & Record<string, unknown>)
      | undefined
    >(snap => {
      // only invent a level for a legacy snapshot that actually carried
      // top-level `tracks`; otherwise leave levels to afterAttach's
      // reconcileLevels, which sizes it from the views
      const {
        tracks,
        levels = tracks ? [{ tracks, level: 0 }] : [],
        ...rest
      } = snap || {}
      return {
        ...rest,
        levels,
      }
    })
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel =
  Instance<LinearComparativeViewStateModel>

export default stateModelFactory
