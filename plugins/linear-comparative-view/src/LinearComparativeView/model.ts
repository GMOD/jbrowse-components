import { lazy } from 'react'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { avg, getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
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

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackContainer } from '@jbrowse/core/util'
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
         * Which genome row drives the others while `followSynteny` is on. Every
         * other row is placed by mapping this one's window outward one level at
         * a time. Clamped to the views array by reconcileLevels.
         */
        followAnchorIndex: types.stripDefault(types.number, 0),
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

        /**
         * #property
         * this represents tracks specific to this view specifically used for
         * read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.stripDefault(
          types.array(pluginManager.pluggableConfigSchemaType('track')),
          [],
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
       */
      isViewCompact(idx: number) {
        return self.views[idx]?.scalebarOnly ?? false
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
       * The one way the UI changes how the rows track each other, so the two
       * flags can't both be on. They fight if they are: `linkViews` replays the
       * anchor's own scroll/zoom onto every row, which is precisely the pixel
       * lock the follow then has to undo on the next settle, and the moving row
       * visibly jumps twice.
       */
      setRowSyncMode(mode: 'independent' | 'link' | 'follow') {
        self.linkViews = mode === 'link'
        self.followSynteny = mode === 'follow'
      },
      /**
       * #action
       */
      setFollowAnchorIndex(idx: number) {
        self.followAnchorIndex = idx
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
      showTrack(trackId: string, level = 0, initialSnapshot = {}) {
        self.levels[level]?.showTrack(trackId, initialSnapshot)
      },

      /**
       * #action
       */
      hideTrack(trackId: string, level = 0) {
        self.levels[level]?.hideTrack(trackId)
      },
      /**
       * #action
       */
      squareView() {
        const average = avg(self.views.map(v => v.bpPerPx))
        for (const view of self.views) {
          const center = view.pxToBp(view.width / 2)
          view.setNewView(average, view.offsetPx)
          if (center.refName) {
            view.centerAt(center.coord0, center.refName, center.index)
          }
        }
      },
      /**
       * #action
       * Show every row's whole region set on ONE bp/px, the coarsest row's, so
       * the largest genome still fills its pane and every other row is drawn
       * shorter in proportion to its size. That difference is the point: rows
       * fit individually to width all end up the same length, which silently
       * stretches a small genome to look like a large one and misaligns every
       * ribbon between them by the ratio. Distinct from squareView, which
       * averages the rows' current scales (the average fits nobody, and each
       * row's own zoom clamp pulls the small ones back to fit-to-width anyway).
       */
      showAllRegionsSameScale() {
        const bpPerPx = Math.max(...self.views.map(v => v.maxBpPerPx))
        for (const view of self.views) {
          view.showAllRegionsAtScale(bpPerPx)
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
      toggleCompactView(idx: number) {
        const view = self.views[idx]
        if (view) {
          view.setScalebarOnly(!view.scalebarOnly)
        }
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
          init: { assembly, loc },
        })
        if (syntenyTrackId) {
          self.showTrack(syntenyTrackId, level)
        }
      },
    }))
    .views(() => ({
      /**
       * #method
       * includes a subset of view menu options because the full list is a
       * little overwhelming. overridden by subclasses
       */
      headerMenuItems(): MenuItem[] {
        return []
      },
      /**
       * #method
       * items for the "Show..." submenu in the header. overridden by
       * subclasses to add view-specific toggle options
       */
      showMenuItems(): MenuItem[] {
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
              getSession(self).queueDialog(handleClose => [
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
        return [
          {
            label: 'Zoom to region(s)',
            onClick: () => {
              for (const view of self.views) {
                const { leftOffset, rightOffset } = view
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
