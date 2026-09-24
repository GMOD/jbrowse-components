import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { exportViewSvg } from '@jbrowse/core/svg/exportViewSvg'
import {
  avg,
  clamp,
  getDialogHost,
  getSession,
  isSessionModelWithWidgets,
  scheduleDetachedDestroy,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { computeViewStatus, viewLoading } from '@jbrowse/core/util/viewStatus'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { addDisposer, cast, detach, types } from '@jbrowse/mobx-state-tree'
import {
  DiagonalizeProgressMixin,
  ImportFormSyntenyMixin,
  TrackColorsMixin,
  allSessionTracks,
  collectTrackWarnings,
  colorableColumns,
  getSyntenyTracks,
  releaseTemporaryAssemblies,
  trackHasLodTiers,
} from '@jbrowse/synteny-core'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import ViewStreamIcon from '@mui/icons-material/ViewStream'
import { autorun } from 'mobx'

import { linearSyntenyViewHelperModelFactory } from '../LinearSyntenyViewHelper/stateModelFactory.ts'
import { followDirection } from '../SyntenyFollow/followDirection.ts'
import { EMPTY_FOLLOW_REPORT } from '../SyntenyFollow/followHost.ts'
import { installSyntenyFollow } from '../SyntenyFollow/installSyntenyFollow.ts'
import { doAfterAttach } from './afterAttach.ts'
import {
  DEFAULT_ALPHA,
  DEFAULT_MIN_ALIGNMENT_LENGTH,
  DEFAULT_OVERDRAW_PX,
} from './consts.ts'
import { FADE_AUTO_MIN_FEATURES, fadesThinAt } from './fadeThin.ts'
import { linearSyntenyLaunchKeys } from './launchKeys.ts'
import { levelHeightForCount } from './levelHeightBudget.ts'
import {
  autoScaleMenuItems,
  compactViewsMenuItems,
  displayCanShowCigar,
  navigationMenuItems,
  removeRowMenuItems,
  rowMenuItems,
  rowViewMenuItems,
} from './menus.ts'
import { sharedFit } from './sharedFit.ts'

import type { FollowReport } from '../SyntenyFollow/followHost.ts'
import type {
  CigarMode,
  ExportSvgOptions,
  FadeThinMode,
  LinearSyntenyViewCommands,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackContainer } from '@jbrowse/core/util'
import type { DisplayInitialSnapshot } from '@jbrowse/core/util/tracks'
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  AttributeRange,
  CigarOpMask,
  ComparativeTrackModel,
  LodMode,
} from '@jbrowse/synteny-core'

// lazies
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReorderChromosomesDialog = lazy(
  () => import('./components/ReorderChromosomesDialog.tsx'),
)
const AddRowDialog = lazy(() => import('./components/AddRowDialog.tsx'))

// detached, then destroyed on a later task, so a display still mounted over the
// row never reads a dead node (ADR-069)
function takeOutRow(row: LinearGenomeViewModel) {
  detach(row)
  scheduleDetachedDestroy(row)
}

/**
 * #stateModel LinearSyntenyView
 *
 * #example
 * Hand-authored under `defaultSession.views`, with every setting written
 * directly on the view object. `views` declares the member assemblies (stacked
 * as linear views) and `tracks` the synteny feature track connecting them with
 * a ribbon:
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
 *   tracks: ['hg38_vs_mm10.paf'],
 *   drawCurves: true,
 *   colorBy: { field: 'query' },
 * }
 * ```
 * The launch keys are `views`, `tracks`, `levelHeights`, `autoDiagonalize`,
 * `sameScale` and `collapseEmptyRows`; everything else is a property below and
 * needs no list to join.
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  const LinearSyntenyLevel = linearSyntenyViewHelperModelFactory(pluginManager)
  const model = types
    .compose(
      'LinearSyntenyView',
      BaseViewModel,
      DiagonalizeProgressMixin(),
      ImportFormSyntenyMixin(),
      TrackColorsMixin(),
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: types.literal('LinearSyntenyView'),
        /**
         * #property
         * How per-base insertions and deletions inside each alignment are
         * shown: 'full' paints indel wedges, 'matches' leaves them see-through,
         * 'off' draws blocks only.
         */
        cigarMode: types.stripDefault(
          // `as const` keeps the CigarMode union from widening to `string`
          types.enumeration(['off', 'matches', 'full'] as const),
          'full',
        ),
        /**
         * #property
         * Draw every band's ribbons as bezier curves rather than straight chords.
         */
        drawCurves: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Continue the query row's scalebar grid down through every band: a tick
         * at each round query coordinate, joined to the coordinate the alignment
         * pairs it with.
         */
        drawLocationMarkers: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Mark the alignments the view cannot draw a ribbon for, along both
         * edges of each band. Costs a second query per pair of rows.
         */
        showOffscreenMates: types.stripDefault(types.boolean, true),
        /**
         * #property
         * pixels beyond the visible viewport edge that synteny lines are still
         * drawn. Effective up to the pan buffer (`syntenyPanBufferPx`: 2000px,
         * or half the viewport when that is wider) — the worker emits CIGAR
         * detail and location markers only that far, so a larger value draws
         * ribbons whose detail stops partway along them.
         */
        overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_PX),
        /**
         * #property
         * Per-feature opacity in [0,1]. The default is tuned for dense
         * unfiltered hairballs; a whole-genome view with minAlignmentLength set
         * can use a higher value (~0.4) for stronger color.
         */
        alpha: types.stripDefault(types.number, DEFAULT_ALPHA),
        /**
         * #property
         * Hide alignment blocks shorter than this many bp, which cuts
         * whole-genome hairball noise.
         */
        minAlignmentLength: types.stripDefault(
          types.number,
          DEFAULT_MIN_ALIGNMENT_LENGTH,
        ),
        /**
         * #property
         * Level-of-detail tier selection for PIF adapters. 'auto' uses the
         * adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier
         * (t/q); 'coarse' forces the tier whose CIGAR is folded to its large
         * indels (T/Q) when present.
         */
        lodMode: types.stripDefault(
          types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
          'auto',
        ),
        /**
         * #property
         * Fade alignment blocks by per-feature identity (lower identity = more
         * transparent), whatever the color mode.
         */
        opacityByIdentity: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Fade a sub-pixel-thin ribbon's opacity by its on-screen width, so an
         * unfiltered whole-genome view doesn't read as a full-opacity hairball.
         * 'auto' fades once a display is dominated by sub-pixel ribbons and
         * leaves a sparse comparison at full alpha; 'on'/'off' pin it. Resolved
         * view-wide by `fadeThinAlignments`.
         */
        fadeThinAlignmentsMode: types.stripDefault(
          types.enumeration('FadeThinMode', ['auto', 'on', 'off']),
          'auto',
        ),
        /**
         * #property
         * Transient launch state: the settings written on the view object that
         * need resolving before they can be view state — the genome rows to
         * open, the synteny tracks per level, the shared scale. The afterAttach
         * autorun applies and clears it. Not written by hand: author every
         * setting directly on the view.
         */
        launch: types.frozen<
          LaunchInput<LinearSyntenyViewCommands> | undefined
        >(),
        /**
         * #property
         * The non-anchor rows follow the anchor row through the alignment,
         * moving to whatever region aligns to its window.
         */
        followSynteny: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Hold every genome row on one bp/px — the coarsest row's fit — so the
         * rows compare by drawn length instead of each filling its pane. Moves
         * the rows' zoom-out limit (`sharedFit`), so it holds across later
         * zooms.
         */
        sameScale: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Which genome row drives the others while following.
         */
        followAnchorIndex: types.stripDefault(types.number, 0),
        /**
         * #property
         * Which genome row "Re-order chromosomes" keeps as it is: the rows
         * below it are ordered against the row above them, and the rows above
         * it against the row below.
         */
        diagonalizeAnchorRow: types.stripDefault(types.number, 0),
        /**
         * #property
         * While following, flip a row whose placing alignment runs the other
         * way from the anchor's, so the two pan in the same direction.
         */
        followMatchOrientation: types.stripDefault(types.boolean, false),
        /**
         * #property
         * One synteny band per adjacent pair of `views`, each holding its own
         * track list. The track-selector and add-track widgets address a band
         * through `trackContainerFor`.
         */
        levels: types.array(LinearSyntenyLevel),
        /**
         * #property
         * N genome rows, with N-1 synteny `levels` between adjacent pairs (see
         * reconcileLevels).
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView').stateModel,
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
       * View-level failure, e.g. a launch that couldn't be applied. Volatile so
       * a reload retries from a clean slate.
       */
      volatileError: undefined as unknown,
      /**
       * #volatile
       * What the follow's last settled pass reports, for the header's follow
       * button: rows holding because nothing aligns under the anchor, a row
       * placed proportionally rather than by a CIGAR walk, a level with no
       * synteny track, a multi-contig answer refused as mostly filler.
       */
      followReport: EMPTY_FOLLOW_REPORT,
      /**
       * #volatile
       * Whether the 'auto' thin-fade is latched on (see `fadeThinAlignments`).
       */
      fadeThinLatch: false,
    }))
    .views(self => ({
      /**
       * #getter
       * The rows a drag or a wheel on a band moves: every row the follow
       * cannot place. Off, that is every row; on, it is the anchor and any row
       * whose level toward the anchor has no synteny track.
       */
      get bandGestureRows() {
        if (!self.followSynteny) {
          return self.views
        }
        const placed = new Set(
          this.followPairs
            .filter(p => p.level.linearSyntenyDisplays.length)
            .map(p => p.movingView),
        )
        return self.views.filter(row => !placed.has(row))
      },
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
       * The view's own failure or the first failed row's, so an export or
       * launcher waiting on a stack with a failed row is told why.
       */
      get error(): unknown {
        return self.volatileError ?? self.views.find(v => v.error)?.error
      },

      /**
       * #getter
       * The failure that leaves the stack nothing to show: the view's own, or
       * every row's. One failed row reports itself in its place in the stack.
       */
      get stackError(): unknown {
        const rowErrors = self.views.map(v => v.error)
        return (
          self.volatileError ??
          (rowErrors.every(Boolean) ? rowErrors[0] : undefined)
        )
      },

      /**
       * #getter
       */
      get assemblyNames() {
        return [...new Set(self.views.flatMap(v => v.assemblyNames))]
      },

      /**
       * #getter
       * The zoom-out limit every row shares while `sameScale` is on
       * (`sharedFit.ts`). Each row pulls it through its own `maxBpPerPx`,
       * finding this view by the presence of this getter.
       */
      get sharedFit() {
        return sharedFit(self.views, self.sameScale)
      },

      /**
       * #getter
       * Every synteny display across every level.
       */
      get allSyntenyDisplays() {
        return self.levels.flatMap(l => l.linearSyntenyDisplays)
      },

      /**
       * #getter
       * Each connected synteny level resolved into the pair of rows a follow
       * moves it between: which row stays, which moves, which axis the anchor
       * window is read off, and the assembly naming the level's lane of an
       * all-vs-all track.
       *
       * Ordered outward from the anchor, so each level's staying row is the
       * anchor or a row a nearer level has already placed, and a stack of three
       * or more settles in one pass.
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
            const rows = level.connectedRows
            return rows
              ? [
                  {
                    level,
                    stayingView: self.views[stayingIndex]!,
                    movingView: self.views[movingIndex]!,
                    toMate,
                    // the lower row is the alignments' mate axis
                    mateAssembly: rows.v1.assemblyNames[0],
                  },
                ]
              : []
          })
      },

      /**
       * #getter
       * Every synteny display's data-quality warnings (e.g. a reversed assembly
       * row order), grouped under the track that raised each: what the
       * header's warning button counts and its dialog reports.
       */
      get trackWarnings() {
        return collectTrackWarnings(this.allSyntenyDisplays)
      },

      /**
       * #method
       * The level that owns a given track list, by id. The track-selector and
       * add-track widgets target a level through here, since this view holds
       * one track list per band rather than one of its own.
       */
      trackContainerFor(id: string): TrackContainer | undefined {
        return self.levels.find(level => level.id === id)
      },
      /**
       * #getter
       * Every band's track list, for a reader walking the session for displays.
       */
      get trackContainers(): TrackContainer[] {
        return [...self.levels]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Every track in the view, across its bands.
       */
      get ownTracks() {
        return self.trackContainers.flatMap(c => c.tracks)
      },
      /**
       * #getter
       */
      get ownViews() {
        return [...self.views]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the launch state that still has something to apply — the gate the
       * loading and import-form paths below read.
       */
      get pendingLaunch() {
        return pendingLaunch(self.launch)
      },
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.views.length > 0 || !!this.pendingLaunch
      },
      /**
       * #getter
       * A launch that has not finished applying: the rows can exist, and be
       * initialized, while the synteny tracks are still several awaits away.
       * The levels' `settled` gate reads it.
       */
      get initPending() {
        return !!this.pendingLaunch
      },
      /**
       * #getter
       * Opts each row's scalebar into captioning its refName labels with the
       * assembly name ("hg38" ahead of "chr1"). Read duck-typed by the child
       * LinearGenomeView.
       */
      get showAssemblyNameInSubviewScalebar() {
        return true
      },
      /**
       * #getter
       */
      get drawCIGAR() {
        return self.cigarMode !== 'off'
      },
      /**
       * #getter
       */
      get drawCIGARMatchesOnly() {
        return self.cigarMode === 'matches'
      },
      /**
       * #getter
       */
      get syntenyTracks(): ComparativeTrackModel[] {
        return self.levels.flatMap(l => l.tracks)
      },
      /**
       * #getter
       * Whether any track has an adapter with tiered storage, which gates the
       * "Level of detail" setting.
       */
      get hasLodCapableAdapter() {
        return this.syntenyTracks.some(track => trackHasLodTiers(track))
      },
      /**
       * #getter
       * Whether any synteny display could show CIGAR detail, which gates the
       * CIGAR setting. True while no display has fetched yet, and false with no
       * synteny tracks.
       */
      get hasCigarData() {
        return self.allSyntenyDisplays.some(displayCanShowCigar)
      },
      /**
       * #getter
       * Union across loaded displays of the CIGAR indel ops drawn on screen,
       * which the legend lists chips for.
       */
      get presentCigarKinds(): CigarOpMask {
        return self.allSyntenyDisplays.reduce(
          (mask, d) => mask | d.presentCigarKinds,
          0,
        )
      },
      /**
       * #getter
       * The resolved fade-thin flag every display renders by. 'auto' fades once
       * any loaded display is dominated by sub-pixel ribbons, latched with a
       * deadband (`fadesThinAt`, ADR-083) so a view near the threshold does not
       * flip while panning. View-wide, so stacked levels fade together.
       */
      get fadeThinAlignments(): boolean {
        const { fadeThinAlignmentsMode, fadeThinLatch } = self
        return fadeThinAlignmentsMode === 'auto'
          ? fadesThinAt(this.autoFadeWidthPx, fadeThinLatch)
          : fadeThinAlignmentsMode === 'on'
      },
      /**
       * #getter
       * The width 'auto' compares against its thresholds: the narrowest capped
       * mean block width of any loaded display with at least
       * `FADE_AUTO_MIN_FEATURES` blocks, or `Infinity` with none.
       */
      get autoFadeWidthPx(): number {
        return Math.min(
          ...self.allSyntenyDisplays
            .filter(d => d.numFeats >= FADE_AUTO_MIN_FEATURES)
            .map(d => d.cappedMeanAlignmentPx)
            .filter(px => px > 0),
        )
      },
      /**
       * #getter
       * The assembly the 'reference' color field keys on: the one bordering the
       * most synteny levels, ties to the topmost. In a stacked ref-vs-A /
       * ref-vs-B layout that is the shared reference, so a region keeps its
       * color across levels.
       */
      get anchorAssemblyName() {
        // positional: a row that doesn't know its assembly yet contributes no
        // adjacency
        const asms = self.views.map(v => v.assemblyNames[0])
        const counts = new Map<string, number>()
        for (const [i, a] of asms.entries()) {
          const b = asms[i + 1]
          if (a !== undefined && b !== undefined) {
            counts.set(a, (counts.get(a) ?? 0) + 1)
            counts.set(b, (counts.get(b) ?? 0) + 1)
          }
        }
        let best: string | undefined
        let bestCount = -1
        for (const a of asms) {
          // -1 keeps an assembly-less row from winning
          const c = a === undefined ? -1 : (counts.get(a) ?? 0)
          if (c > bestCount) {
            bestCount = c
            best = a
          }
        }
        return best
      },
      /**
       * #method
       * Every synteny track across every level, in order.
       */
      colorableTrackConfigs() {
        return this.syntenyTracks.map(t => {
          const { trackId, name } = t.configuration
          return { trackId, name }
        })
      },
      /**
       * #method
       * The numeric columns the overlaid tracks declare (the ortholog-table
       * adapter's `attributeColumns`), one color mode each.
       */
      colorableAttributeNames() {
        return colorableColumns(
          this.syntenyTracks.flatMap(t => {
            const declared = getConf(t, ['adapter', 'attributeColumns']) as
              | string[]
              | undefined
            return declared ?? []
          }),
        )
      },
      /**
       * #method
       * Each loaded display's observed attribute spans, which the mixin unions
       * into the domain the legend labels its ramp with.
       */
      loadedAttributeRanges(): Record<string, AttributeRange>[] {
        return self.allSyntenyDisplays.map(
          d => d.featureData?.attributeRanges ?? {},
        )
      },

      /**
       * #method
       * The key's chips are composited by the ribbon alpha, as the ribbons
       * are.
       */
      legendAlpha(): number {
        return self.alpha
      },

      /**
       * #method
       * Only the indel ops drawn on screen get a chip.
       */
      legendCigarOps(): CigarOpMask {
        return this.presentCigarKinds
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return (
          self.awaitingAutoDiagonalize ||
          (self.hasSomethingToShow &&
            !self.stackError &&
            !self.views.some(v => v.initialized))
        )
      },
      /**
       * #getter
       * The assembly whose load the spinner is waiting on. `init` names them
       * before the rows are built, so it is the source until then.
       */
      get loadingAssembly() {
        const { assemblyManager } = getSession(self)
        return assemblyManager.loadingAssembly(
          self.views.length > 0
            ? self.views.flatMap(v => v.assemblyNames)
            : (self.pendingLaunch?.views?.map(v => v.assembly) ?? []),
        )
      },
      /**
       * #getter
       * What the loading screen says while `showLoading`, read off the
       * assembly whose load is the wait; undefined otherwise.
       */
      get loading() {
        return viewLoading(this.showLoading, () => this.loadingAssembly)
      },
      /**
       * #getter
       * Whether to show the import form: nothing to show, or a failure that
       * leaves the stack nothing to show (`stackError`), which the form reports
       * in a banner.
       */
      get showImportForm() {
        return !self.hasSomethingToShow || !!self.stackError
      },
      /**
       * #getter
       * The view's lifecycle as one value — ready, error, loading or noRegions
       * — for a host that draws its own chrome. Same shape and precedence as
       * the linear view's.
       */
      get status(): ViewStatus {
        return computeViewStatus({
          error: self.stackError,
          hasSomethingToShow: self.hasSomethingToShow,
          loading: () => this.loading,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Merge into `followReport`. Declared ahead of afterAttach, which
       * installs the follow that calls it.
       */
      setFollowReport(report: Partial<FollowReport>) {
        self.followReport = { ...self.followReport, ...report }
      },
      /**
       * #action
       */
      setFollowSynteny(flag: boolean) {
        self.followSynteny = flag
      },
      /**
       * #action
       */
      setFollowAnchorIndex(idx: number) {
        self.followAnchorIndex = idx
      },
      /**
       * #action
       * Release the clicked ribbon in every band, ahead of a band pointing its
       * own: the drawer shows one feature, so one ribbon is outlined
       */
      clearClickedFeatures() {
        for (const display of self.allSyntenyDisplays) {
          display.setClickedInstance(-1)
        }
      },
      /**
       * #action
       * Run a navigation of a row as the follow's own placement rather than as
       * a gesture. While following, a gesture on any row makes that row the
       * anchor, and the follow tells a gesture from its own work by root
       * action: whatever `fn` navigates is a nested action of this one.
       */
      holdFollowAnchor<T>(fn: () => T) {
        return fn()
      },
      /**
       * #action
       */
      takeOutRows() {
        for (const row of [...self.views]) {
          takeOutRow(row)
        }
      },
      /**
       * #action
       * Keep exactly one synteny level per gap between adjacent views, growing
       * or shrinking from the end, and both anchors inside the stack.
       */
      reconcileLevels() {
        while (self.levels.length < self.views.length - 1) {
          self.levels.push(
            cast({
              // matches its neighbour rather than the type's 100px default
              height: self.levels.at(-1)?.height,
            }),
          )
        }
        while (self.levels.length > Math.max(self.views.length - 1, 0)) {
          self.levels.pop()
        }
        // Both anchors address a row, and every path that changes the views
        // array comes through here. A spec attaches with no views yet, so an
        // empty stack leaves them alone.
        if (self.views.length > 0) {
          const lastRow = self.views.length - 1
          self.followAnchorIndex = clamp(self.followAnchorIndex, 0, lastRow)
          self.diagonalizeAnchorRow = clamp(
            self.diagonalizeAnchorRow,
            0,
            lastRow,
          )
        }
      },
    }))
    .actions(self => ({
      // releases session assemblies made for this view, e.g. read vs ref.
      // Both hooks: `removeView` detaches before it destroys.
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
        self.takeOutRows()
        self.views = cast(views)
        self.levels = cast([])
        self.reconcileLevels()
        // a rebuild supersedes whatever failed last time
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
       * Drop one genome row and the bands beside it. An interior row leaves
       * one new band between the rows it separated, drawn by a track that
       * connects them where the session has one — a track the removed bands
       * were already showing first, which is what an all-vs-all file gives.
       */
      removeRow(idx: number) {
        const row = self.views[idx]
        if (!row) {
          return
        }
        const interior = idx > 0 && idx < self.views.length - 1
        const firstBand = Math.max(idx - 1, 0)
        const removedBands = self.levels.slice(
          firstBand,
          firstBand + (interior ? 2 : 1),
        )
        const shown = new Set(
          removedBands.flatMap(band =>
            band.tracks.map(t => t.configuration.trackId as string),
          ),
        )
        const height = removedBands[0]?.height
        takeOutRow(row)
        self.levels.splice(firstBand, removedBands.length)
        if (interior) {
          self.levels.splice(firstBand, 0, cast({ height }))
        }
        if (idx < self.followAnchorIndex) {
          self.followAnchorIndex -= 1
        }
        if (idx < self.diagonalizeAnchorRow) {
          self.diagonalizeAnchorRow -= 1
        }
        self.reconcileLevels()
        if (interior) {
          const session = getSession(self)
          const connecting = getSyntenyTracks(
            allSessionTracks(session),
            [firstBand, firstBand + 1].map(
              i => self.views[i]!.assemblyNames[0] ?? '',
            ),
            session.assemblyManager,
          ).map(t => t.trackId as string)
          const trackId = connecting.find(id => shown.has(id)) ?? connecting[0]
          if (trackId) {
            self.levels[firstBand]!.launchTrack(trackId).catch((e: unknown) => {
              session.notifyError(`${e}`, e)
            })
          }
        }
      },

      /**
       * #action
       * Flip the stack top to bottom. Every band keeps the pair of rows it
       * draws between, so its tracks stay with it.
       */
      reverseRows() {
        const lastRow = self.views.length - 1
        self.views.replace([...self.views].reverse())
        self.levels.replace([...self.levels].reverse())
        self.followAnchorIndex = lastRow - self.followAnchorIndex
        self.diagonalizeAnchorRow = lastRow - self.diagonalizeAnchorRow
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
          const selector = session.openWidget(
            'HierarchicalTrackSelectorWidget',
            'hierarchicalTrackSelector',
            {
              view: self.id,
              trackContainerId: self.levels[level]?.id,
            },
          )
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
       */
      showTrack(
        trackId: string,
        level = 0,
        // annotated: a bare `{}` accepts a number, and `level` sits beside it
        initialSnapshot: object = {},
        displayInitialSnapshot: DisplayInitialSnapshot = {},
        inlineConf?: Record<string, unknown>,
      ) {
        return self.levels[level]?.showTrack(
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
          inlineConf,
        )
      },
      /**
       * #action
       * showTrack for a track whose display state model may be lazily
       * loaded: loads it, then shows
       */
      async launchTrack(
        trackId: string,
        level = 0,
        initialSnapshot: object = {},
        displayInitialSnapshot: DisplayInitialSnapshot = {},
        inlineConf?: Record<string, unknown>,
      ) {
        return self.levels[level]?.launchTrack(
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
       * A band's drag, over `bandGestureRows`. The rows' scrolls nest under
       * this action, so none of them reads as a gesture that would take the
       * anchor.
       */
      panStack(dx: number) {
        for (const row of self.bandGestureRows) {
          row.horizontalScroll(dx)
        }
      },
      /**
       * #action
       * Every row onto the rows' average bp/px, each keeping its centre.
       */
      squareView() {
        const live = self.views.filter(v => v.initialized)
        const average = avg(live.map(v => v.bpPerPx))
        for (const view of live) {
          view.zoomTo(average)
          // a discrete jump, so the coarse blocks flush rather than waiting out
          // their debounce
          view.settleCoarseBlocks()
        }
      },
      /**
       * #action
       * Every row onto its whole assembly, either all on one bp/px — the
       * coarsest row's fit, so the largest genome fills its pane and the others
       * draw shorter in proportion — or each fit to its own pane. `sameScale`
       * latches, so the shared scale holds across later zooms.
       */
      showAllRegionsAcrossRows(sameScale: boolean) {
        this.setSameScale(sameScale)
        for (const view of self.views) {
          view.showAllRegionsInAssembly()
        }
        // second pass: a row's fit moves with its regions, so the ceiling
        // settles only once every row has been reset
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
       */
      setDiagonalizeAnchorRow(row: number) {
        self.diagonalizeAnchorRow = row
      },
      /**
       * #action
       * Latch `sameScale` and zoom every row onto the shared scale, keeping
       * each row's regions and centre.
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
       * Back to the import form. Drops `launch` too, which `hasSomethingToShow`
       * keys off while there are no rows.
       */
      clearView() {
        self.takeOutRows()
        self.levels = cast([])
        self.volatileError = undefined
        self.launch = undefined
        self.cancelAutoDiagonalize()
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
       * Resize every synteny band by the same delta, keeping their differences.
       * Each level clamps its own drag (`resizeHeight`).
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
       * Append an assembly to the bottom of the stack, optionally showing a
       * synteny track on the new level. Returns `launchTrack`'s promise rather
       * than awaiting it, so the action stays synchronous.
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
        return syntenyTrackId
          ? self.launchTrack(syntenyTrackId, level)
          : undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setDrawCurves(arg: boolean) {
        self.drawCurves = arg
      },
      /**
       * #action
       */
      setCigarMode(arg: CigarMode) {
        self.cigarMode = arg
      },
      /**
       * #action
       */
      setDrawLocationMarkers(arg: boolean) {
        self.drawLocationMarkers = arg
      },
      /**
       * #action
       */
      setShowOffscreenMates(flag: boolean) {
        self.showOffscreenMates = flag
      },
      /**
       * #action
       */
      setOverdrawPx(arg: number) {
        self.overdrawPx = arg
      },
      /**
       * #action
       */
      setAlpha(arg: number) {
        self.alpha = arg
      },
      /**
       * #action
       */
      setMinAlignmentLength(arg: number) {
        self.minAlignmentLength = arg
      },
      /**
       * #action
       */
      setLodMode(arg: LodMode) {
        self.lodMode = arg
      },
      /**
       * #action
       */
      setOpacityByIdentity(arg: boolean) {
        self.opacityByIdentity = arg
      },
      /**
       * #action
       */
      setFadeThinAlignmentsMode(arg: FadeThinMode) {
        self.fadeThinAlignmentsMode = arg
      },
      /**
       * #action
       * Move the latched 'auto' thin-fade decision — `installAutoFadeLatch` is
       * the only caller.
       */
      setFadeThinLatch(arg: boolean) {
        self.fadeThinLatch = arg
      },
      /**
       * #action
       * Every row back to its own whole assembly, fit to its own width, which
       * also turns `sameScale` off.
       */
      showAllRegions() {
        self.showAllRegionsAcrossRows(false)
      },
      /**
       * #action
       */
      setLaunch(launch?: LaunchInput<LinearSyntenyViewCommands>) {
        self.launch = launch
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      // Promise<string> is stated: renderToSvg is typed against this very
      // model, so an inferred return makes the type reference itself (TS2456)
      async exportSvg(opts: ExportSvgOptions = {}): Promise<string> {
        return exportViewSvg(
          self as LinearSyntenyViewModel,
          opts,
          () => import('./svgcomponents/SVGLinearSyntenyView.tsx'),
        )
      },
    }))
    .views(self => {
      const exportSvgMenuItem = {
        label: 'Export SVG',
        icon: PhotoCameraIcon,
        onClick: () => {
          getDialogHost(self).queueDialog(handleClose => [
            ExportSvgDialog,
            {
              model: self,
              handleClose,
            },
          ])
        },
      }
      const returnToImportFormMenuItem = {
        label: 'Return to import form',
        icon: FolderOpenIcon,
        onClick: () => {
          getDialogHost(self).queueDialog(handleClose => [
            ReturnToImportFormDialog,
            {
              model: self,
              handleClose,
            },
          ])
        },
      }
      return {
        /**
         * #method
         * The header's view-options menu: the zoom actions, the row coupling,
         * what varies with the stack under "Rows", then Export SVG. Every
         * render setting is in `SyntenySettingsMenu` instead.
         * `ViewOptionsMenuButton` passes the "Show..." submenu as
         * `extraSubMenus`, since the search box prefs are React state.
         */
        headerMenuItems(extraSubMenus: MenuItem[] = []): MenuItem[] {
          return [
            ...navigationMenuItems(self),
            {
              label: 'Rows',
              icon: ViewStreamIcon,
              subMenu: [
                // nothing to append to while the import form is up
                ...(self.showImportForm
                  ? []
                  : [
                      {
                        label: 'Add assembly row...',
                        icon: AddIcon,
                        onClick: () => {
                          getDialogHost(self).queueDialog(handleClose => [
                            AddRowDialog,
                            {
                              handleClose,
                              model: self as LinearSyntenyViewModel,
                            },
                          ])
                        },
                      },
                    ]),
                ...removeRowMenuItems(self),
                {
                  label: 'Reverse row order',
                  icon: SwapVertIcon,
                  onClick: () => {
                    self.reverseRows()
                  },
                },
                {
                  label: 'Re-order chromosomes',
                  onClick: () => {
                    getDialogHost(self).queueDialog(handleClose => [
                      ReorderChromosomesDialog,
                      {
                        handleClose,
                        model: self as LinearSyntenyViewModel,
                      },
                    ])
                  },
                  icon: ShuffleIcon,
                },
                ...autoScaleMenuItems(self),
                ...compactViewsMenuItems(self),
                { type: 'subHeader', label: 'Row menus' },
                ...rowMenuItems(self),
              ],
            },
            ...extraSubMenus,
            exportSvgMenuItem,
          ]
        },
        /**
         * #method
         */
        menuItems(): MenuItem[] {
          return [
            returnToImportFormMenuItem,
            ...rowViewMenuItems(self),
            exportSvgMenuItem,
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
                // one stack zoom, which leaves the follow anchor where it was
                self.holdFollowAnchor(() => {
                  for (const { view, leftOffset, rightOffset } of selection) {
                    if (leftOffset && rightOffset) {
                      view.moveTo(leftOffset, rightOffset)
                    }
                  }
                })
              },
            },
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // a hand-authored session typically writes `views` and no `levels`
        self.reconcileLevels()
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
        // written, so a ceiling that drops strands them above it. Gated on
        // `sameScale` too: mode off answers without reading a row, and a
        // restored row saved past its own fit should stay there.
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
        doAfterAttach(self as LinearSyntenyViewModel)
      },
    }))

  return withLaunchInput(model, linearSyntenyLaunchKeys, {
    registry: pluginManager,
    materialized: snap => !!snap.views?.length,
  })
    .preProcessSnapshot<
      ({ fadeThinAlignments?: boolean } & Record<string, unknown>) | undefined
    >(snap => {
      // the boolean spelling of fadeThinAlignmentsMode, which shares its name
      // with the resolved getter
      const { fadeThinAlignments, ...rest } = snap || {}
      return typeof fadeThinAlignments === 'boolean'
        ? {
            ...rest,
            fadeThinAlignmentsMode: fadeThinAlignments ? 'on' : 'off',
          }
        : rest
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // redundant once the rows exist; until then it is the only thing a
      // reload can rebuild the view from
      if (snap.views.length) {
        const { launch, ...rest } = snap
        return rest as typeof snap
      }
      return snap
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>

declare module '@jbrowse/core/PluginManager' {
  interface ViewTypeRegistry {
    LinearSyntenyView: LinearSyntenyViewStateModel
  }
}
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
