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
import { computeViewStatus } from '@jbrowse/core/util/viewStatus'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { addDisposer, cast, detach, types } from '@jbrowse/mobx-state-tree'
import { installLinkedViewSync } from '@jbrowse/plugin-linear-genome-view'
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
  ComparativeWarning,
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

// A genome row leaves the stack the way a view leaves the session: detached
// inside the action and destroyed on a later task, so a display still mounted
// over it never reads a dead node (ADR-069). The levels are destroyed in place,
// which is the ADR's rule rather than an omission — a level is not a view, so a
// display under a detached level would throw out of `getContainingView` where
// one under a destroyed level only warns.
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
          // `as const` so this resolves to the CigarMode union rather than
          // widening to `string` — the menu builders consume it as the union
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
         * edges of each band. The lower panel of a pair is queried as well as
         * the upper one for it, which is a fetch input and a second query per
         * pair.
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
         * Hide alignment blocks shorter than this many bp. Enforced per-feature
         * by its own span in buildSyntenyGeometry, then culled in the shader
         * (isCulled) and pick engine. Cuts whole-genome hairball noise.
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
         * transparent). Orthogonal to colorBy — surfaces identity-dropoff zones
         * without consuming the color channel.
         */
        opacityByIdentity: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Whether to fade a sub-pixel-thin ribbon's opacity by its on-screen
         * width (see WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered
         * whole-genome view doesn't read as a hard full-opacity hairball.
         * 'auto' enables the fade once a display is dominated by sub-pixel
         * ribbons (see `autoFadeWidthPx`); a genuinely sparse comparison
         * (only a handful of ribbons) keeps full alpha so the fade doesn't wash
         * it out. 'on'/'off' pin it. Resolved view-wide by the
         * `fadeThinAlignments` getter, so all levels fade together.
         */
        fadeThinAlignmentsMode: types.stripDefault(
          types.enumeration('FadeThinMode', ['auto', 'on', 'off']),
          'auto',
        ),
        /**
         * #property
         * transient launch state: the settings written on the view object that
         * need resolving before they can be view state — the genome rows to
         * open, the synteny tracks per level, the shared scale.
         * `preProcessSnapshot` moves them here off the snapshot, the afterAttach
         * autorun applies them and clears this, so a saved session never
         * retains it. Not written by hand: author every setting directly on the
         * view.
         */
        launch: types.frozen<
          LaunchInput<LinearSyntenyViewCommands> | undefined
        >(),
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
         * Which genome row "Re-order chromosomes" keeps as it is, ordering the
         * rows below it against the row above them and the rows above it
         * against the row below. The top row by default, which is the plain
         * top-down cascade; a stack whose linkage groups are one row's
         * chromosomes anchors on that row instead.
         */
        diagonalizeAnchorRow: types.stripDefault(types.number, 0),
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
       * View-level failure (e.g. an `init` block that couldn't be applied).
       * Volatile on purpose: a reload re-runs the init autorun from a clean
       * slate, so a transient failure stays recoverable.
       */
      volatileError: undefined as unknown,
      /**
       * #volatile
       * What the follow's last settled pass has to say about itself, for the
       * header's follow button: whether the rows are holding because nothing
       * aligns under the anchor, whether a row was placed proportionally
       * rather than by a CIGAR walk, whether a level has no synteny track to
       * follow by, and which multi-contig answer was refused as mostly filler
       * (naming the region followed and the ones whose answers are off
       * screen). Without it a holding row is the same picture as a broken
       * follow. Volatile because it describes the current window, not the
       * session.
       */
      followReport: EMPTY_FOLLOW_REPORT,
      /**
       * #volatile
       * Whether the 'auto' thin-fade is latched on. State rather than a derived
       * value because the decision has hysteresis, and hysteresis is a memory —
       * see `fadeThinAlignments`.
       */
      fadeThinLatch: false,
    }))
    .views(self => ({
      /**
       * #getter
       * nothing aligns under the anchor's window, so the other rows are holding
       */
      get followUnaligned() {
        return self.followReport.unaligned
      },
      /**
       * #getter
       * a row was placed proportionally rather than by a CIGAR walk
       */
      get followApproximate() {
        return self.followReport.approximate
      },
      /**
       * #getter
       * the multi-contig answer refused as mostly filler, naming the region
       * followed and the ones whose answers are off screen
       */
      get followPartial() {
        return self.followReport.partial
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
       * Resolved like LGV's and dotplot's: it folds in the rows, whose
       * assemblies are what `initialized` waits on, so an export or a launcher
       * waiting on a stack with a failed row is told why rather than hanging.
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
       * all-vs-all track. A level whose rows are not connected — both
       * initialized and holding regions, the same gate the bands themselves
       * use — is dropped, since there is nothing to place yet.
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
            // the bands' own gate: a row appendRow just added is initialized
            // before it has regions, and a follow placing from it walks none
            const rows = level.connectedRows
            return rows
              ? [
                  {
                    level,
                    stayingView: self.views[stayingIndex]!,
                    movingView: self.views[movingIndex]!,
                    toMate,
                    movingIndex,
                    // the level's LOWER row is the one on the alignments' mate
                    // axis whichever direction the level runs in
                    mateAssembly: rows.v1.assemblyNames[0],
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
      get syntenyWarnings(): ComparativeWarning[] {
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
       * a genome row is removed, and an index would then name a different
       * pair.
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
    .views(self => ({
      /**
       * #getter
       * The census entry for this view. Its tracks hang off the levels, one
       * list per band, and its rows are views in their own right — which is
       * the nesting the four consumers each used to walk for themselves.
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
       * An `init` blob that has not been applied yet — `installInitAutorun`
       * clears it as the last thing an apply pass does. The view is assembling
       * itself: the rows can already exist, and be initialized, while the
       * synteny tracks are still several awaits away, which is why the levels'
       * `settled` gate reads this.
       *
       * Same predicate as dotplot's, and read the same way — by `settled`, not
       * by `showLoading`. LGV's `awaitingInitNavigation` is the narrower "init
       * set and nothing on screen at all", which it does fold into
       * `showLoading`; it used to share this name.
       */
      get initPending() {
        return !!this.pendingLaunch
      },
      /**
       * #getter
       * Opt each sub-view's scalebar into captioning its refName labels with the
       * assembly name ("hg38" ahead of "chr1"), so stacked genome rows of
       * different assemblies stay distinguishable. Read duck-typed by the child
       * LinearGenomeView (scalebarDisplayPrefix) to avoid an upward plugin
       * dependency.
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
       * True if any track on any level has an adapter with tiered storage. Used
       * to gate the "Level of detail" row — PAFAdapter, BlastTabularAdapter and
       * friends have nothing to switch between.
       */
      get hasLodCapableAdapter() {
        return this.syntenyTracks.some(track => trackHasLodTiers(track))
      },
      /**
       * #getter
       * True if any synteny display could show CIGAR detail — used to gate the
       * CIGAR settings row, which a CIGAR-less PAF has nothing to put in.
       * Optimistic while no display has finished a fetch yet, so the row is
       * there from the first render rather than popping in once data lands (the
       * common case: most synteny files carry CIGARs). A view with no synteny
       * tracks at all has nothing to gate, so it reports false.
       */
      get hasCigarData() {
        return self.allSyntenyDisplays.some(displayCanShowCigar)
      },
      /**
       * #getter
       * Union across every loaded synteny display of which CIGAR indel ops are
       * actually drawn on screen. The floating legend lists an indel chip only
       * when a visible-width op of that kind is painted somewhere in the view.
       */
      get presentCigarKinds(): CigarOpMask {
        return self.allSyntenyDisplays.reduce(
          (mask, d) => mask | d.presentCigarKinds,
          0,
        )
      },
      /**
       * #getter
       * Resolved fade-thin flag that every display's renderParams reads. In
       * 'auto' mode the fade turns on once ANY loaded synteny display is
       * dominated by sub-pixel ribbons (a thin hairball that benefits from
       * decluttering); a sparse view keeps its few ribbons at full alpha.
       * 'on'/'off' pin it.
       *
       * LATCHED, with a deadband (`fadesThinAt`): a fade that is off engages at
       * 1px and one that is on holds until the ribbons come back above 1.25px.
       * The signal underneath is a mean over the features the current fetch
       * window holds, and that window rolls over once per `syntenyPanBufferPx` of
       * panning, stepping the mean with the slice it swapped; on a single
       * threshold a view sitting near it flipped every ribbon in the stack
       * between full alpha and WIDTH_FADE_FLOOR while the reader was merely
       * scrolling. `installAutoFadeLatch` moves the latch, and an un-moved latch
       * reads as the plain un-hysteretic answer, so a first frame or an SVG
       * export taken before it runs is not a different picture.
       *
       * Deliberately view-wide rather than per display: stacked levels are read
       * as one picture, so levels resolving the fade independently would paint
       * the same ribbon density differently from row to row.
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
       * mean block width any loaded display reports, or `Infinity` when none of
       * them has enough blocks to judge by. Each display measures its own ribbons
       * (`cappedMeanAlignmentPx`) and this takes the thinnest, so the densest
       * level in a stack carries the view-wide decision.
       *
       * Skips a display holding fewer than `FADE_AUTO_MIN_FEATURES` blocks, and
       * one still at 0 (no fetch landed yet), so neither can fade the view on its
       * own.
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
       * The "anchor" assembly for the 'reference' field: the assembly bordering
       * the most synteny levels. In a stacked ref-vs-A / ref-vs-B layout each
       * interior assembly touches two levels and the ends touch one, so the
       * max-adjacency assembly is the shared reference. Ties resolve to the
       * topmost. Every level then colors by this assembly's chromosome names,
       * so a region keeps its color as it's traced across levels.
       */
      get anchorAssemblyName() {
        // Positional: a row that doesn't know its assembly yet contributes no
        // adjacency, rather than being dropped so its neighbours close the gap
        // and count as a pair they aren't.
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
          // -1 keeps an assembly-less row from ever winning, including in the
          // single-row case where no pair exists and every count is 0
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
       * Every synteny track across every level, in order, paired with whatever
       * color the user pinned on it. View-wide rather than per level: the
       * floating legend is one box for the whole stack, so two levels handing
       * out the same color would make that one legend lie.
       */
      colorableTrackConfigs() {
        return this.syntenyTracks.map(t => {
          const { trackId, name } = t.configuration
          return { trackId, name }
        })
      },
      /**
       * #method
       * The numeric columns the overlaid tracks declare, so the palette menu can
       * offer one mode per measurement without any of them being a named mode.
       * `attributeColumns` is the ortholog-table adapter's slot; a track whose
       * adapter has no such slot contributes nothing.
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
       * Label for the generic loading spinner, naming the assembly file being
       * downloaded when the assembly load is what the wait is. The
       * auto-diagonalize wait is a separate render branch
       * (DiagonalizeLoadingScreen), so this only covers the plain "view not
       * ready" case.
       */
      get loadingMessage() {
        return this.showLoading
          ? this.loadingAssembly?.statusMessage || 'Loading'
          : undefined
      },
      /**
       * #getter
       * Determinate fraction for the spinner's bar, when the assembly load
       * reports one
       */
      get loadingProgress() {
        return this.showLoading
          ? this.loadingAssembly?.statusProgress
          : undefined
      },
      /**
       * #getter
       * The URL the assembly load is currently fetching, when the phase named
       * one. Only the stalled-load notice reads it — see `ViewLoadingScreen`.
       */
      get loadingSource() {
        return this.showLoading ? this.loadingAssembly?.statusSource : undefined
      },
      /**
       * #getter
       * Whether to show the import form. A failed `init` counts: `init` is kept
       * so a reload can retry it, but in this session there is nothing to show
       * and no second attempt coming, so the form (with the error banner) is the
       * only way forward — matching LGV/dotplot/circular, which also fall back
       * to the form on error rather than spinning. One failed row does not:
       * see `stackError`.
       */
      get showImportForm() {
        return !self.hasSomethingToShow || !!self.stackError
      },
      /**
       * #getter
       * The view's lifecycle as one value — ready, error, loading or noRegions
       * — for a host that draws its own chrome and has to render all four. Same
       * shape and same precedence as the linear view's, through
       * `computeViewStatus`.
       *
       * A host gating on `initialized` alone gets the trap this closes: it
       * waits on every row, so a failure in either assembly leaves it false for
       * good, and the empty box that follows says nothing about which of the
       * two happened.
       */
      get status(): ViewStatus {
        return computeViewStatus({
          error: self.stackError,
          hasSomethingToShow: self.hasSomethingToShow,
          loading: () =>
            this.showLoading
              ? {
                  message: this.loadingMessage ?? 'Loading',
                  progress: this.loadingProgress,
                }
              : undefined,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Written by the follow's autorun and read only by the header, which is
       * what keeps it from being a dependency of the very pass that writes it.
       * A partial report merges, since a settled resolve can only raise a flag
       * the plan could not see.
       *
       * In THIS block, ahead of afterAttach, rather than with the other follow
       * actions below: a later block's actions are not on the `self` an earlier
       * one sees, so anything afterAttach calls has to be declared before it —
       * the same reason `reconcileLevels` is here.
       */
      setFollowReport(report: Partial<FollowReport>) {
        self.followReport = { ...self.followReport, ...report }
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
       * setFollowReport: the follow's own snackbar offers this as the way out
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
       * Run a navigation of a row as the follow's own placement rather than as
       * a gesture. While following, a gesture on any row makes that row the
       * anchor, and the follow tells a gesture from its own work by root
       * action alone: whatever `fn` navigates is a NESTED action of this one.
       * The follow's passes and the explicit moves that take the anchor run
       * their navigations through here.
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
       * Reconcile the levels array to the views array: exactly one synteny
       * level per gap between adjacent views (N views -> N-1 levels). Grows or
       * shrinks from the end, preserving existing levels and their tracks. The
       * single source of truth for the views/levels invariant.
       */
      reconcileLevels() {
        while (self.levels.length < self.views.length - 1) {
          self.levels.push(
            cast({
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
        self.takeOutRows()
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
       * which renders nothing and breaks the views/levels invariant.
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
        const live = self.views.filter(v => v.initialized)
        const average = avg(live.map(v => v.bpPerPx))
        for (const view of live) {
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
       * Rows fit individually to width all end up the same length, which
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
       */
      setDiagonalizeAnchorRow(row: number) {
        self.diagonalizeAnchorRow = row
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
       * Also drops `launch`, which `hasSomethingToShow` keys off while views is
       * empty — leaving it set would bounce "return to import form" straight
       * back to the loading spinner.
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
       * Set every synteny band to one height in px. `resizeAllLevelHeights`
       * moves each band by a delta and keeps their differences; this is the
       * absolute form an agent or a spec reaches for.
       */
      setAllLevelHeights(height: number) {
        for (const level of self.levels) {
          level.setHeight(height)
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
       *
       * Returns `launchTrack`'s promise rather than awaiting it, so this
       * action stays synchronous and keeps action context while a caller
       * still has something to await.
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
       * Every row back to its own whole assembly, fit to its own width — and
       * so also the way off `sameScale`, whose raised ceiling would otherwise
       * make "show all regions" mean the shared scale on every row. The
       * fit-to-width half of `showAllRegionsAcrossRows`, under the name the
       * rest of the app reaches it by.
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
                // A row is appended to the stack the user is looking at, so
                // there is nothing to append to while the import form is up —
                // that form is how the stack gets built, and the dialog
                // anchored to a view with no rows offers datasets it cannot
                // open on a level that does not exist.
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
                for (const { view, leftOffset, rightOffset } of selection) {
                  if (leftOffset && rightOffset) {
                    view.moveTo(leftOffset, rightOffset)
                  }
                }
              },
            },
          ]
        },
      }
    })
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
      // Legacy: fadeThinAlignments was a boolean. stripDefault meant only an
      // explicit `false` ever persisted, so that is the case a pre-'auto'
      // session hits — but a hand-written document or spec reaches for `true`
      // to turn the fade ON, and dropping it would leave the key looking
      // accepted while it wrote nothing.
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
      // launch is transient: once views have materialized it's redundant, so
      // we strip it. But while views is still empty (a snapshot taken mid-load,
      // or a launch that errored before building views) it is the ONLY thing
      // that can rebuild the view -> keep it so a reload/restore resumes
      // instead of falling back to the import form.
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
