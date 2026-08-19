import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { computeViewStatus } from '@jbrowse/core/util/viewStatus'
import { types } from '@jbrowse/mobx-state-tree'
import {
  DiagonalizeProgressMixin,
  TrackColorsMixin,
  lodMenuItems,
  trackHasLodTiers,
} from '@jbrowse/synteny-core'
import AddIcon from '@mui/icons-material/Add'
import CropFreeIcon from '@mui/icons-material/CropFree'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import { observable } from 'mobx'

import baseModel from '../LinearComparativeView/model.ts'
import { doAfterAttach } from './afterAttach.ts'
import {
  autoScaleMenuItems,
  cigarModeMenuItems,
  displayCanShowCigar,
  genomeViewsMenuItems,
  removeRowMenuItems,
  rowSyncMenuItems,
  rowViewMenuItems,
} from './menus.ts'

import type { LinearComparativeViewModel } from '../LinearComparativeView/model.ts'
import type {
  CigarMode,
  ExportSvgOptions,
  FadeThinMode,
  ImportFormSyntenyTrack,
  LinearSyntenyViewCommands,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  AttributeRange,
  CigarOpMask,
  ComparativeTrackModel,
  LodMode,
} from '@jbrowse/synteny-core'

const DEFAULT_OVERDRAW_PX = 1000

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const ReorderChromosomesDialog = lazy(
  () => import('./components/ReorderChromosomesDialog.tsx'),
)
const AddRowDialog = lazy(() => import('./components/AddRowDialog.tsx'))

/**
 * #stateModel LinearSyntenyView
 *
 * #example
 * Hand-authored under `defaultSession.views`. `init.views` declares the two
 * member assemblies (stacked as linear views) and `tracks` the synteny feature
 * track connecting them with a ribbon:
 * ```js
 * {
 *   type: 'LinearSyntenyView',
 *   init: {
 *     views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
 *     tracks: ['hg38_vs_mm10.paf'],
 *     drawCurves: true,
 *   },
 * }
 * ```
 * `init` also takes the launch commands (`levelHeights`, `autoDiagonalize`,
 * `sameScale`, `collapseEmptyRows`) and ANY property below — `colorBy`,
 * `alpha`, `minAlignmentLength`, `drawLocationMarkers`, … . There is no list to
 * join: `applyInitSettings` matches an init key against this model's own
 * properties, and `LinearSyntenyViewInit` is derived from its snapshot type.
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearSyntenyView',
      baseModel(pluginManager),
      DiagonalizeProgressMixin(),
      TrackColorsMixin(),
      types.model({
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
         * Render ribbons as bezier curves rather than straight chords. Reads
         * much better at whole-genome scale, where straight crossings stack
         * into noise.
         */
        drawCurves: types.stripDefault(types.boolean, false),
        /**
         * #property
         * Continue the query view's scalebar grid down through the ribbons: a
         * tick at each round query coordinate, joined to the coordinate the
         * alignment pairs it with.
         */
        drawLocationMarkers: types.stripDefault(types.boolean, false),
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
        alpha: types.stripDefault(types.number, 0.2),
        /**
         * #property
         * Hide alignment blocks shorter than this many bp. Enforced per-feature
         * by its own span in buildSyntenyGeometry, then culled in the shader
         * (isCulled) and pick engine. Cuts whole-genome hairball noise.
         */
        minAlignmentLength: types.stripDefault(types.number, 0),
        /**
         * #property
         * Level-of-detail tier selection for PIF adapters. 'auto' uses the
         * adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier
         * (t/q); 'coarse' forces the no-CIGAR tier (T/Q) when present.
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
         * ribbons (see LinearSyntenyDisplay.autoFadeThinAlignments); a genuinely
         * sparse comparison (only a handful of ribbons) keeps full alpha so the
         * fade doesn't wash it out. 'on'/'off' pin it. Resolved view-wide by the
         * `fadeThinAlignments` getter, so all levels fade together.
         */
        fadeThinAlignmentsMode: types.stripDefault(
          types.enumeration('FadeThinMode', ['auto', 'on', 'off']),
          'auto',
        ),
        /**
         * #property
         * used for initializing the view from a session snapshot. tracks is
         * 2D — outer index is the level (the gap between views[i] and
         * views[i+1]), so a 3-way view has two entries.
         * example:
         * ```json
         * {
         *   views: [
         *     { loc: "chr1:1-100", assembly: "hg38", tracks: ["genes"] },
         *     { loc: "chr1:1-100", assembly: "mm39" },
         *     { loc: "chr1:1-100", assembly: "rn7" }
         *   ],
         *   tracks: [["hg38_vs_mm39_synteny"], ["mm39_vs_rn7_synteny"]]
         * }
         * ```
         */
        init: types.frozen<LinearSyntenyViewCommands | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.views.length > 0 || !!self.init
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
        return !!self.init
      },
      /**
       * #getter
       * Opt each sub-view's scalebar into prefixing its refName labels with the
       * assembly name (e.g. "hg38:chr1"), so stacked genome rows of different
       * assemblies stay distinguishable. Read duck-typed by the child
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
       * True if any track on any level has an adapter with tiered storage. Used
       * to gate the LOD menu — PAFAdapter, BlastTabularAdapter and friends have
       * nothing to switch between.
       */
      get hasLodCapableAdapter() {
        return self.levels
          .flatMap(l => l.tracks)
          .some((track: ComparativeTrackModel) => trackHasLodTiers(track))
      },
      /**
       * #getter
       * True if any synteny display could show CIGAR detail — used to gate the
       * CIGAR-related menu items, which a CIGAR-less PAF has nothing to put in.
       * Optimistic while no display has finished a fetch yet, so the menu is
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
       * dominated by sub-pixel ribbons (`autoFadeThinAlignments` — a thin
       * hairball that benefits from decluttering); a sparse view keeps its few
       * ribbons at full alpha. 'on'/'off' pin it.
       *
       * Deliberately view-wide rather than per display: stacked levels are read
       * as one picture, so levels resolving the fade independently would paint
       * the same ribbon density differently from row to row.
       */
      get fadeThinAlignments(): boolean {
        const { fadeThinAlignmentsMode } = self
        return fadeThinAlignmentsMode === 'auto'
          ? self.allSyntenyDisplays.some(d => d.autoFadeThinAlignments)
          : fadeThinAlignmentsMode === 'on'
      },
      /**
       * #getter
       * The "anchor" assembly for colorBy:'reference': the assembly bordering
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
       * #getter
       * Every synteny track across every level, in order, paired with whatever
       * color the user pinned on it. View-wide rather than per level: the
       * floating legend is one box for the whole stack, so two levels handing
       * out the same color would make that one legend lie.
       */
      colorableTrackConfigs() {
        return self.levels
          .flatMap(l => l.tracks)
          .map((t: ComparativeTrackModel) => {
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
        return (
          self.levels
            .flatMap(l => l.tracks)
            // Annotated for the reason ComparativeTrackModel documents: this
            // array is `any`, which switched off checking on the getConf call
            // below until the shape was named.
            .flatMap((t: ComparativeTrackModel) => {
              const declared = getConf(t, ['adapter', 'attributeColumns']) as
                | string[]
                | undefined
              return declared ?? []
            })
        )
      },
      /**
       * #method
       * Each loaded display's observed attribute spans, which the mixin unions
       * into the domain the legend labels its ramp with.
       */
      loadedAttributeRanges(): Record<string, AttributeRange>[] {
        // The declared return type is what pins these entries:
        // `allSyntenyDisplays` is one of the untyped model arrays, so `d` is
        // `any` and the property access alone would infer `any[]`.
        return self.allSyntenyDisplays.map(
          d => d.featureData?.attributeRanges ?? {},
        )
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
          (!self.initialized && self.hasSomethingToShow && !self.error)
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
            : (self.init?.views.map(v => v.assembly) ?? []),
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
       * Whether to show the import form. A failed `init` counts: `init` is kept
       * so a reload can retry it, but in this session there is nothing to show
       * and no second attempt coming, so the form (with the error banner) is the
       * only way forward — matching LGV/dotplot/circular, which also fall back
       * to the form on error rather than spinning.
       */
      get showImportForm() {
        return !self.hasSomethingToShow || !!self.error
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
          error: self.error,
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
       * Drop every pending pair-selection. The import form rewrites the whole
       * list through this whenever its assembly rows change (a selection is
       * about a pair of assemblies, not a row index — see
       * `remapSelectionsToPairs`), and again once they have been applied.
       */
      clearImportFormSyntenyTracks() {
        self.importFormSyntenyTrackSelections.clear()
      },
      /**
       * #action
       */
      setImportFormSyntenyTrack(arg: number, val: ImportFormSyntenyTrack) {
        self.importFormSyntenyTrackSelections[arg] = val
      },
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
       */
      showAllRegions() {
        for (const view of self.views) {
          view.showAllRegionsInAssembly()
        }
      },
      /**
       * #action
       */
      setInit(init?: LinearSyntenyViewCommands) {
        self.init = init
      },
    }))
    .actions(self => {
      const superClearView = self.clearView
      return {
        /**
         * #action
         * Also drops `init`, which `hasSomethingToShow` keys off while views is
         * empty — leaving it set would bounce "return to import form" straight
         * back to the loading spinner.
         */
        clearView() {
          superClearView()
          self.setInit(undefined)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearSyntenyView.tsx')
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        const { saveSvgAsImage } =
          await import('@jbrowse/core/svg/saveSvgAsImage')
        await saveSvgAsImage(html, opts)
      },
    }))
    .views(self => {
      const superHeaderMenuItems = self.headerMenuItems
      const superShowMenuItems = self.showMenuItems
      const superMenuItems = self.menuItems
      function openExportSvgDialog() {
        getSession(self).queueDialog(handleClose => [
          ExportSvgDialog,
          {
            model: self,
            handleClose,
          },
        ])
      }
      return {
        /**
         * #method
         */
        showMenuItems() {
          return [
            ...superShowMenuItems(),
            {
              label: 'Show all regions',
              onClick: () => {
                self.showAllRegions()
              },
            },
            {
              label: 'Show all regions at same scale',
              onClick: () => {
                self.showAllRegionsSameScale()
              },
            },
            {
              label: 'Show curved lines',
              type: 'checkbox',
              checked: self.drawCurves,
              onClick: () => {
                self.setDrawCurves(!self.drawCurves)
              },
            },
            {
              label: 'Show location markers',
              type: 'checkbox',
              checked: self.drawLocationMarkers,
              onClick: () => {
                self.setDrawLocationMarkers(!self.drawLocationMarkers)
              },
            },
          ]
        },
        /**
         * #method
         * includes a subset of view menu options because the full list is a
         * little overwhelming
         */
        headerMenuItems() {
          return [
            ...superHeaderMenuItems(),
            {
              label: 'Square view',
              onClick: () => {
                self.squareView()
              },
              icon: CropFreeIcon,
            },
            {
              label: 'Add assembly row...',
              icon: AddIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  AddRowDialog,
                  {
                    handleClose,
                    model: self,
                  },
                ])
              },
            },
            ...removeRowMenuItems(self),
            {
              label: 'Re-order chromosomes',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ReorderChromosomesDialog,
                  {
                    handleClose,
                    model: self,
                  },
                ])
              },
              icon: ShuffleIcon,
            },
            ...autoScaleMenuItems(self),
            ...genomeViewsMenuItems(self),
            ...cigarModeMenuItems(self),
            ...lodMenuItems(self),
            ...rowSyncMenuItems(self),
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                openExportSvgDialog()
              },
            },
          ]
        },
        /**
         * #method
         */
        menuItems() {
          return [
            ...superMenuItems(),
            ...rowViewMenuItems(self),
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                openExportSvgDialog()
              },
            },
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        doAfterAttach(self)
      },
    }))
    .preProcessSnapshot<
      ({ fadeThinAlignments?: boolean } & Record<string, unknown>) | undefined
    >(snap => {
      // Legacy: fadeThinAlignments was a boolean (stripDefault true, so only an
      // explicit `false` reached the snapshot). Map it onto the tri-state mode
      // so pre-'auto' sessions that had the fade turned off stay off.
      const { fadeThinAlignments, ...rest } = snap || {}
      return fadeThinAlignments === false
        ? { ...rest, fadeThinAlignmentsMode: 'off' }
        : rest
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // init is transient: once views have materialized it's redundant, so we
      // strip it. But while views is still empty (a snapshot taken mid-load,
      // or an init that errored before building views) init is the ONLY thing
      // that can rebuild the view -> keep it so a reload/restore resumes
      // instead of falling back to the import form.
      if (snap.views.length) {
        const { init, ...rest } = snap
        return rest as typeof snap
      }
      return snap
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>

/**
 * The synteny-specific header controls (colorBy, alpha, etc.) read state that
 * only exists on a LinearSyntenyView. Gate on the MST type discriminator so a
 * plain LinearComparativeView never renders those controls against a model that
 * lacks the matching state/actions. Narrowing along the compose chain and not
 * from an arbitrary object, so the only thing unchecked is the discriminator
 * itself, which every subclass sets to its own literal.
 */
export function asSyntenyModel(model: LinearComparativeViewModel) {
  return model.type === 'LinearSyntenyView'
    ? (model as LinearSyntenyViewModel)
    : undefined
}
