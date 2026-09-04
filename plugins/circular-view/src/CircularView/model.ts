import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getDialogHost,
  getSession,
  isSessionModelWithWidgets,
  resolveNamedRegions,
} from '@jbrowse/core/util'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import {
  hideTrackGeneric,
  normalizeTrackInit,
  launchToggleTrackGeneric,
  launchTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import {
  assemblyErrorMessage,
  computeViewStatus,
} from '@jbrowse/core/util/viewStatus'
import {
  pendingLaunch,
  withLaunchInput,
} from '@jbrowse/core/util/withLaunchInput'
import { cast, types } from '@jbrowse/mobx-state-tree'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

import { circularLaunchKeys } from './launchKeys.ts'
import { maxLabelGutterPx, regionLabelText } from './rulerLabels.ts'
import { calculateStaticSlices } from './slices.ts'

import type { SliceRegion } from './slices.ts'
import type { CircularViewCommands } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util/types'
import type { ViewStatus } from '@jbrowse/core/util/viewStatus'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { FC, ReactNode } from 'react'

const twoPi = 2 * Math.PI

// the figure never grows past this, so a zoomed-in circle stays a size the
// browser can lay out
const maximumRadiusPx = 5000

// Where the middle of the circle lands vertically in a box of this size, before
// the zoom-to-cursor pan.
//
// Centered, except in a box TALLER than it is wide, where a figure smaller than
// the box hangs from the TOP instead. `autoFit` sizes the figure to
// `min(width, height)`, so exactly one axis ever has slack, and it is the height
// precisely when the view is taller than it is wide — the SV inspector's
// circular pane beside a full-height spreadsheet. Splitting that slack evenly
// left the chord plot floating in the middle of its pane with nothing above or
// below it.
//
// The width comparison is what keeps the top-hang out of a WIDE box. There the
// height has slack only once the user has zoomed out below the fit, and hanging
// from the top then pinned a shrinking circle to the top edge of an 800x400 view
// with 200px of nothing under it. The `Math.min(0, …)` keeps the centering where
// it was load-bearing in the tall box too: a figure zoomed past its box still
// overflows top and bottom equally rather than only off the bottom.
//
// The consequence is that in a tall box this middle MOVES with the figure's
// size while the figure is smaller than the box, which the horizontal middle
// (`width / 2`) never does. `zoomToPoint` has to undo that or the drawing slides
// down as it grows — hence one function both callers read.
function figureMiddleY(width: number, height: number, figureSize: number) {
  return height > width
    ? Math.min(0, (height - figureSize) / 2) + figureSize / 2
    : height / 2
}

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))

export interface ExportSvgOptions {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  Wrapper?: FC<{ children: ReactNode }>
  themeName?: string
  fontFamily?: string
}

// the part of the view `applyInit` drives. Duck-typed rather than the model's
// own Instance so the helper can live above the factory that defines it
interface CircularViewInitSelf extends IStateTreeNode {
  setDisplayedRegions: (regions: Region[]) => void
  launchTrack: (
    trackId: string,
    trackSnapshot?: Record<string, unknown>,
    displaySnapshot?: Record<string, unknown>,
  ) => Promise<unknown>
}

/**
 * Apply one launch blob: the regions the circle is drawn from, then the chord
 * tracks. The only await is `launchTrack`'s dynamic import of a lazily
 * registered display model, which cannot park indefinitely, so
 * `installInitAutorun`'s supersede ceiling never comes up. It is still the
 * owner of the re-entry guard, the `isAlive` checks, the identity-checked
 * clear of `init`, and the failure policy.
 */
async function applyInit(
  self: CircularViewInitSelf,
  init: LaunchInput<CircularViewCommands>,
) {
  const session = getSession(self)
  const assemblyName = init.assembly
  const assembly = assemblyName
    ? session.assemblyManager.get(assemblyName)
    : undefined
  const regions = assembly?.regions
  if (assemblyName && assembly && regions) {
    const names = init.displayedRegionNames
    // A list that matches nothing draws the whole assembly rather than blanking
    // the circle — the same fallback the synteny row takes, and it matters more
    // here: an empty displayedRegions drops the view to its import form, and
    // `init`, the only thing that could rebuild the figure, is consumed on the
    // way out. So a typo'd refName used to lose the view outright with nothing
    // said; resolveNamedRegions is what says it now.
    //
    // `?.length`, not the bare key: an empty array is truthy, so `[]` used to
    // resolve to nothing and report that no names had matched no regions.
    const named = names?.length
      ? resolveNamedRegions({
          regions,
          names,
          assemblyName,
          getCanonicalRefName: assembly.getCanonicalRefName2,
          allRefNames: assembly.allRefNames,
          notify: message => {
            session.notify(message, 'warning')
          },
        })
      : regions
    self.setDisplayedRegions(named ?? regions)
  }
  for (const t of init.tracks ?? []) {
    const { trackId, trackSnapshot, displaySnapshot } = normalizeTrackInit(t)
    await self.launchTrack(trackId, trackSnapshot, displaySnapshot)
  }
}

/**
 * #stateModel CircularView
 *
 * #example
 * Hand-authored under `defaultSession.views`, with every setting written
 * directly on the view object. `assembly` picks the genome, a `tracks` entry may
 * carry display config inline, and `displayedRegionNames` keeps an assembly's
 * alt/unplaced contigs off the circle:
 * ```js
 * {
 *   type: 'CircularView',
 *   assembly: 'hg38',
 *   displayedRegionNames: ['chr1', 'chr2', 'chr3'],
 *   tracks: [{ trackId: 'my-sv-vcf', strokeColor: 'red' }],
 * }
 * ```
 */
function stateModelFactory(pluginManager: PluginManager) {
  const minHeight = 40
  const minWidth = 100
  const defaultHeight = 400
  const defaultOffsetRadians = -Math.PI / 2
  const defaultBpPerPx = 200
  const defaultMinimumRadiusPx = 25
  const defaultSpacingPx = 10
  const defaultPaddingPx = 80
  // Floors and caps for the two above, which are fixed pixel counts sized for a
  // circle with a window to itself — see effectivePaddingPx/effectiveSpacingPx.
  //
  // 0.2 is not a new opinion: 80px is a fifth of the half-box at the 800px size
  // the constant was tuned against, so holding that fraction below it leaves
  // every roomy circle exactly where it was and keeps a small one in the same
  // proportion instead of watching the padding eat it.
  const minPaddingPx = 20
  const maxPaddingFraction = 0.2
  const maxSpacingFraction = 0.25
  const defaultMinVisibleWidth = 6
  const model = types
    .compose(
      'CircularView',
      BaseViewModel,
      types.model({
        /**
         * #property
         * this is a string instead of the const literal 'CircularView' to
         * reduce some typescripting strictness, but you should pass the string
         * 'CircularView' to the model explicitly
         */
        type: types.literal('CircularView') as unknown as string,
        /**
         * #property
         * similar to offsetPx in linear genome view
         */
        offsetRadians: types.stripDefault(types.number, defaultOffsetRadians),
        /**
         * #property
         * the zoom level, base-pairs per pixel. Capped by `minimumRadiusPx`,
         * and refit over by the first resize unless `autoFit` is false.
         */
        bpPerPx: types.stripDefault(types.number, defaultBpPerPx),
        /**
         * #property
         * whether the view keeps re-fitting to its container on resize.
         * Cleared once the user manually zooms/pans so their view (persisted
         * via bpPerPx/offsetRadians) is preserved across resizes and reloads.
         */
        autoFit: types.stripDefault(types.boolean, true),
        /**
         * #property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),

        /**
         * #property
         * chrome switch, for an embed that drives the view itself
         */
        hideVerticalResizeHandle: types.stripDefault(types.boolean, false),
        /**
         * #property
         * chrome switch, for an embed that drives the view itself
         */
        hideTrackSelectorButton: types.stripDefault(types.boolean, false),
        /**
         * #property
         * suppress the import form even on an error — what the SV inspector's
         * circle wants, since its assembly comes from the sheet beside it and a
         * form there would offer a control that cannot work
         */
        disableImportForm: types.stripDefault(types.boolean, false),

        /**
         * #property
         * the height of the view in pixels. The circle auto-fits its
         * container, so this is what sizes the drawing.
         */
        height: types.stripDefault(types.number, defaultHeight),
        /**
         * #property
         * the regions the circle lays out, one arc each, in this order.
         * `displayedRegionNames` names the same thing by refName and is the
         * shorter form.
         */
        displayedRegions: types.stripDefault(types.frozen<Region[]>(), []),
        /**
         * #property
         * how far in the circle may be zoomed, as a floor on the radius; it is
         * what caps bpPerPx
         */
        minimumRadiusPx: types.stripDefault(
          types.number,
          defaultMinimumRadiusPx,
        ),
        /**
         * #property
         * the gap drawn between adjacent chromosome arcs
         */
        spacingPx: types.stripDefault(types.number, defaultSpacingPx),
        /**
         * #property
         * blank margin between the circle and the edge of the figure
         */
        paddingPx: types.stripDefault(types.number, defaultPaddingPx),
        /**
         * #property
         * arcs thinner than this many pixels are elided instead of drawn,
         * which is what stops a few thousand unplaced contigs becoming a ring
         * of hairlines
         */
        minVisibleWidth: types.stripDefault(
          types.number,
          defaultMinVisibleWidth,
        ),
        /**
         * #property
         * vestigial: the hierarchical selector is the only one that exists, so
         * this value is ignored. Retained because saved sessions and configs
         * persist it.
         */
        trackSelectorType: types.stripDefault(types.string, 'hierarchical'),
        /**
         * #property
         * transient launch state: the settings written on the view object that
         * need resolving before they can be view state — the assembly the
         * circle is drawn from, the refNames to restrict it to, chord track
         * recipes. `preProcessSnapshot` moves them here off the snapshot, the
         * afterAttach autorun applies them and clears this, so a saved session
         * never retains it. Not written by hand: author every setting directly
         * on the view.
         */
        launch: types.frozen<LaunchInput<CircularViewCommands> | undefined>(),
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      volatileError: undefined as unknown,
      panX: 0,
      panY: 0,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get width() {
        if (self.volatileWidth === undefined) {
          throw new Error(
            'wait for view to be initialized first before accessing width',
          )
        }
        return self.volatileWidth
      },

      /**
       * #getter
       * `paddingPx`, capped so it cannot eat a small box.
       *
       * The declared value is a fixed 80px sized for a circle with a window to
       * itself, and it comes out of the radius twice. In the SV inspector,
       * whose circle gets about a third of the width, that left the drawn disc
       * covering 41% of the area it was given, and in a 316px-tall one — the
       * height the SV tutorial's figure sets — the radius fell to 78px.
       *
       * Capped as a fraction of the half-box rather than at a pixel count, so
       * the circle holds one shape at every size. The fraction is the one the
       * declared 80px already is at the size it was tuned for, so a roomy
       * circle is untouched and a cramped one is merely not made worse. The
       * floor is what the ruler labels need to sit outside the arc at all.
       */
      get effectivePaddingPx() {
        const halfBox = Math.min(self.width, self.height) / 2
        return Math.min(
          self.paddingPx,
          Math.max(
            minPaddingPx,
            halfBox * maxPaddingFraction,
            // never below what the ruler labels reach. The centre sits at
            // `radiusPx + padding`, so a label needing more than the padding is
            // drawn at a negative x and the box clips it — which is what
            // shrinking the padding at all did to `chr15`..`chr17` on the SV
            // tutorial's figure
            maxLabelGutterPx(this.elidedRegions.map(regionLabelText)),
          ),
        )
      },
      /**
       * #getter
       * `spacingPx`, capped so the inter-chromosome gaps cannot take the ring.
       *
       * Also a fixed pixel count, and it is charged once per slice, so what it
       * costs depends entirely on how big the circle ended up: 27% of the
       * circumference at the SV inspector's default and 49% of it at that
       * 316px-tall one, where the chromosomes drew as ticks with holes between
       * them. Capping the total rather than the gap keeps a roomy circle on the
       * declared value and only closes up where the ring is genuinely short.
       *
       * Measured against the radius the box would fit rather than `radiusPx`,
       * which is derived from this.
       */
      get effectiveSpacingPx() {
        const slices = this.elidedRegions.length
        return slices
          ? Math.min(
              self.spacingPx,
              (twoPi * this.fitRadiusPx * maxSpacingFraction) / slices,
            )
          : self.spacingPx
      },
      /**
       * #getter
       * the radius the current box has room for — what `fitToWindow` aims at,
       * and the scale `effectiveSpacingPx` measures itself against. A pure
       * function of the box, so neither reads back a value derived from it
       */
      get fitRadiusPx() {
        return Math.max(
          Math.min(self.width, self.height) / 2 - this.effectivePaddingPx,
          self.minimumRadiusPx,
        )
      },
      /**
       * #getter
       */
      get circumferencePx() {
        const spacing = this.effectiveSpacingPx
        return this.elidedRegions.reduce(
          (sum, r) => sum + r.widthBp / self.bpPerPx + spacing,
          0,
        )
      },
      /**
       * #getter
       */
      get radiusPx() {
        return this.circumferencePx / twoPi
      },
      /**
       * #getter
       */
      get bpPerRadian() {
        return self.bpPerPx * this.radiusPx
      },
      /**
       * #getter
       */
      get centerXY(): [number, number] {
        const c = this.radiusPx + this.effectivePaddingPx
        return [c, c]
      },
      /**
       * #getter
       */
      get totalBp() {
        return self.displayedRegions.reduce(
          (sum, r) => sum + r.end - r.start,
          0,
        )
      },
      /**
       * #getter
       */
      get maxBpPerPx() {
        const minCircumferencePx = twoPi * self.minimumRadiusPx
        return this.totalBp / minCircumferencePx
      },
      /**
       * #getter
       */
      get minBpPerPx() {
        // min depends on window dimensions, clamp between old min(0.01) and max
        const maxCircumferencePx = twoPi * maximumRadiusPx
        return clamp(
          this.totalBp / maxCircumferencePx,
          0.0000000001,
          this.maxBpPerPx,
        )
      },
      /**
       * #getter
       */
      get atMaxBpPerPx() {
        return self.bpPerPx >= this.maxBpPerPx
      },
      /**
       * #getter
       */
      get atMinBpPerPx() {
        return self.bpPerPx <= this.minBpPerPx
      },
      /**
       * #getter
       * figure is always square, so width === height
       */
      get figureSize() {
        return this.radiusPx * 2 + 2 * this.effectivePaddingPx
      },
      /**
       * #getter
       * top-left of the figure within the view's box, then shifted by the
       * zoom-to-cursor pan.
       *
       * Centered horizontally: a view much wider than it is tall would
       * otherwise leave the circle jammed in the corner under the controls.
       *
       * Vertically it hangs from the top of a box taller than it is wide — see
       * `figureMiddleY`, which `zoomToPoint` reads for the same reason.
       */
      get figureOriginXY(): [number, number] {
        const { figureSize } = this
        return [
          (this.width - figureSize) / 2 + self.panX,
          figureMiddleY(this.width, self.height, figureSize) -
            figureSize / 2 +
            self.panY,
        ]
      },
      /**
       * #getter
       * this is displayedRegions, post-processed to elide regions that are too
       * small to see reasonably
       */
      get elidedRegions() {
        const visible: SliceRegion[] = []
        for (const region of self.displayedRegions) {
          const widthBp = region.end - region.start
          const widthPx = widthBp / self.bpPerPx
          if (widthPx < self.minVisibleWidth) {
            // too small to see, collapse into a single elision region
            const lastVisible = visible.at(-1)
            if (lastVisible?.elided) {
              lastVisible.regions.push({ ...region })
              lastVisible.widthBp += widthBp
            } else {
              visible.push({
                elided: true,
                widthBp,
                regions: [{ ...region }],
              })
            }
          } else {
            // big enough to see, display it
            visible.push({ ...region, widthBp, elided: false })
          }
        }

        // a single-region elision isn't worth collapsing: promote it back to a
        // normal region. Drop the elided `regions` wrapper so its Slice key
        // (assembleLocString) matches a natively-visible region of the same
        // coords instead of diverging to JSON.stringify(regions).
        return visible.map(v =>
          v.elided && v.regions.length === 1
            ? { ...v.regions[0]!, widthBp: v.widthBp, elided: false as const }
            : v,
        )
      },
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
      get assemblyNames() {
        return [...new Set(self.displayedRegions.map(r => r.assemblyName))]
      },
      /**
       * #getter
       * The assembly a pending launch names, which is what the gates below wait
       * on before `displayedRegions` exist. A blob carrying only tracks names
       * none, and waiting on one nobody named never ends.
       */
      get launchAssemblyName() {
        return this.pendingLaunch?.assembly
      },
      /**
       * #getter
       */
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        const { assemblyManager } = getSession(self)
        const launching = this.launchAssemblyName
        if (launching) {
          const asm = assemblyManager.get(launching)
          return !!(asm?.initialized && asm.regions)
        }
        return this.assemblyNames.every(
          name => assemblyManager.get(name)?.initialized,
        )
      },

      /**
       * #getter
       */
      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        return assemblyErrorMessage(assemblyManager, this.assemblyNames)
      },

      /**
       * #getter
       */
      get error(): unknown {
        if (self.volatileError) {
          return self.volatileError
        }
        if (this.assemblyErrors) {
          return this.assemblyErrors
        }
        // Check the launch assembly for errors (displayedRegions may be empty
        // while it is still resolving)
        const launching = this.launchAssemblyName
        if (launching) {
          const { assemblyManager } = getSession(self)
          const asm = assemblyManager.get(launching)
          if (!asm) {
            return `Assembly ${launching} not found`
          }
          if (asm.error) {
            return asm.error
          }
        }
        return undefined
      },

      /**
       * #getter
       */
      get hasSomethingToShow() {
        return self.displayedRegions.length > 0 || !!this.pendingLaunch
      },

      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return !this.initialized && !this.error && this.hasSomethingToShow
      },

      /**
       * #getter
       * The assembly whose load the spinner is waiting on. A pending launch
       * names it before displayedRegions exist, so it is the source until then
       * — the same order `initialized` above resolves in.
       */
      get loadingAssembly() {
        const { assemblyManager } = getSession(self)
        const launching = this.launchAssemblyName
        return assemblyManager.loadingAssembly(
          launching ? [launching] : this.assemblyNames,
        )
      },

      /**
       * #getter
       * What the spinner says: which of the assembly's files is downloading,
       * rather than a bare "Loading" for the slow part of startup. See
       * agent-docs/reference/PROGRESS_REPORTING.md.
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
       * Whether the view is fully initialized and ready to display
       */
      get showView() {
        return !!self.displayedRegions.length && this.initialized
      },

      /**
       * #getter
       * `!hasSomethingToShow || !!error`, the same predicate as every other
       * view, with `disableImportForm` suppressing the whole thing rather than
       * only its first half.
       *
       * The `||` used to bind the other way, so an error re-enabled a form the
       * embedder had turned off. That is reachable, and the sv-inspector —
       * `disableImportForm`'s only setter — is where: its circle is driven by
       * the spreadsheet's assembly, so a circle left sitting on regions whose
       * assembly the config no longer has reports an error (the case the
       * region-binding autorun's comment describes). The inspector then grew a
       * circular-view import form inside its own panel, offering an assembly
       * dropdown whose Open the inspector's autorun overwrites on the next
       * pass — a control that cannot work, in a view that asked not to have it.
       *
       * The error still has to be reported, so the component renders a bare
       * ErrorBanner in that case; the form is only the *usual* place a circular
       * view puts one.
       */
      get showImportForm() {
        return (
          !self.disableImportForm && (!this.hasSomethingToShow || !!this.error)
        )
      },

      /**
       * #getter
       * The view's lifecycle as one value — ready, error, loading or noRegions
       * — for a host that draws its own chrome and has to render all four. Same
       * shape and same precedence as the linear view's, through
       * `computeViewStatus`.
       */
      get status(): ViewStatus {
        return computeViewStatus({
          error: this.error,
          hasSomethingToShow: this.hasSomethingToShow,
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
    .views(self => ({
      /**
       * #getter
       */
      get staticSlices() {
        // spelled out rather than handing over `self`, because the gap between
        // slices has to be the same one `circumferencePx` charged for — passing
        // the node let the layout read the declared `spacingPx` while the
        // circumference used the capped one, and the slices then did not close
        // the ring they were laid out on
        return calculateStaticSlices({
          elidedRegions: self.elidedRegions,
          bpPerRadian: self.bpPerRadian,
          spacingPx: self.effectiveSpacingPx,
          radiusPx: self.radiusPx,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * size the figure so it exactly fills the smaller of the view's two
       * dimensions
       */
      fitToWindow() {
        if (!self.displayedRegions.length) {
          return
        }
        // The fit needs a measured width, and `setHeight` can arrive before the
        // first `setWidth` — a restored session brings its own
        // `displayedRegions`, so the regions guard above doesn't cover it, and
        // `self.width` throws by design until the view is measured. The
        // SvInspectorView binds the two dimensions in separate autoruns and
        // sizes the circular view's height unconditionally while sizing its
        // width only when the circle is shown, so height-before-width is the
        // normal path there, not an edge case.
        //
        // Deferring rather than fitting on a guessed width loses nothing:
        // `setWidth` re-runs this under the same `autoFit` flag, so the fit
        // happens as soon as the measurement exists.
        if (self.volatileWidth === undefined) {
          return
        }
        const targetRadiusPx = self.fitRadiusPx
        // the circumference is the regions plus one inter-slice gap each, so
        // the gaps come out of the budget before the bp are spread over what is
        // left. Ignoring them overshoots by sliceCount*spacingPx/PI px of
        // figure size, which an assembly with many contigs clips off the bottom
        // of its own box. How many slices there are itself depends on bpPerPx
        // (narrow regions elide together), so iterate until the count settles —
        // two passes, in practice
        let sliceCount = -1
        for (
          let i = 0;
          i < 5 && sliceCount !== self.elidedRegions.length;
          i++
        ) {
          sliceCount = self.elidedRegions.length
          this.setBpPerPx(
            self.totalBp /
              Math.max(
                twoPi * targetRadiusPx - sliceCount * self.effectiveSpacingPx,
                twoPi * self.minimumRadiusPx,
              ),
          )
        }
        self.panX = 0
        self.panY = 0
      },
      /**
       * #action
       */
      setWidth(newWidth: number): number {
        const clamped = Math.max(newWidth, minWidth)
        self.volatileWidth = clamped
        if (self.autoFit) {
          this.fitToWindow()
        }
        return clamped
      },
      /**
       * #action
       */
      setHeight(newHeight: number) {
        self.height = Math.max(newHeight, minHeight)
        if (self.autoFit) {
          this.fitToWindow()
        }
        return self.height
      },
      /**
       * #action
       */
      rotateClockwiseButton() {
        self.offsetRadians += Math.PI / 6
      },

      /**
       * #action
       */
      rotateCounterClockwiseButton() {
        self.offsetRadians -= Math.PI / 6
      },

      /**
       * #action
       */
      rotate(delta: number) {
        self.offsetRadians += delta
      },

      /**
       * #action
       * reset rotation, pan, and zoom back to the default fit-to-window view
       */
      resetView() {
        self.offsetRadians = defaultOffsetRadians
        self.autoFit = true
        this.fitToWindow()
      },

      /**
       * #action
       */
      zoomInButton() {
        self.autoFit = false
        this.setBpPerPx(self.bpPerPx / 1.4)
      },

      /**
       * #action
       */
      zoomOutButton() {
        self.autoFit = false
        this.setBpPerPx(self.bpPerPx * 1.4)
      },

      /**
       * #action
       */
      setBpPerPx(newVal: number) {
        self.bpPerPx = clamp(newVal, self.minBpPerPx, self.maxBpPerPx)
      },

      /**
       * #action
       * zoom toward/away from a point on the figure, keeping whatever is under
       * it visually fixed. The point is its offset in screen px from the middle
       * of the circle — what `offsetFromCenter` in the component hands back
       */
      zoomToPoint(newBpPerPx: number, cursorX: number, cursorY: number) {
        self.autoFit = false
        const oldRadiusPx = self.radiusPx
        const oldMiddleY = figureMiddleY(
          self.width,
          self.height,
          self.figureSize,
        )
        this.setBpPerPx(newBpPerPx)
        if (!oldRadiusPx) {
          return
        }
        // The point's screen position is the circle's middle plus its own offset
        // from that middle, and the drawing scales that offset with the radius.
        // Taking the real offset rather than assuming the cursor sits on the
        // ruler ring is what makes this hold over the chords too — at the middle
        // of the figure the ring assumption pushed the drawing by the whole
        // radius change.
        const scale = self.radiusPx / oldRadiusPx
        // Horizontally the middle is `width / 2` whatever the figure's size, so
        // the offset term is the whole story. Vertically it is not: in a tall
        // box a figure smaller than the box hangs from the top, so growing it
        // slides the middle down by half the growth and drags the point under
        // the cursor with it. That is the tall-box case the top-hang exists for.
        self.panX += cursorX * (1 - scale)
        self.panY +=
          cursorY * (1 - scale) +
          oldMiddleY -
          figureMiddleY(self.width, self.height, self.figureSize)
      },

      /**
       * #action
       */
      setDisplayedRegions(regions: Region[]) {
        self.displayedRegions = cast(regions)
        self.autoFit = true
        this.fitToWindow()
      },

      /**
       * #action
       */
      activateTrackSelector() {
        const session = getSession(self)
        if (!isSessionModelWithWidgets(session)) {
          return
        }
        const selector = session.addWidget(
          'HierarchicalTrackSelectorWidget',
          'hierarchicalTrackSelector',
          { view: self },
        )
        session.showWidget(selector)
        return selector
      },

      /**
       * #action
       */
      toggleTrack(trackId: string) {
        return toggleTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      setError(error: unknown) {
        self.volatileError = error
      },

      /**
       * #action
       */
      setLaunch(launch?: LaunchInput<CircularViewCommands>) {
        self.launch = launch
      },

      /**
       * #action
       */
      showTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
        // the loading path re-enters through this action, so a parameter it
        // drops is one `launchTrackConf` loses
        inlineConf?: Record<string, unknown>,
      ) {
        return showTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
          inlineConf,
        )
      },
      /**
       * #action
       */
      addTrackConf(
        configuration: Record<string, unknown>,
        initialSnapshot = {},
      ) {
        const { trackId } = configuration
        if (typeof trackId === 'string') {
          return showTrackGeneric(
            self,
            trackId,
            initialSnapshot,
            {},
            configuration,
          )
        }
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      openExportDialog() {
        getDialogHost(self).queueDialog(handleClose => [
          ExportSvgDialog,
          { model: self as CircularViewModel, handleClose },
        ])
      },

      /**
       * #action
       * creates an svg export and save using FileSaver
       */
      async exportSvg(opts: ExportSvgOptions = {}) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGCircularView.tsx')
        const html = await renderToSvg(self as CircularViewModel, opts)
        const { saveSvgAsImage } =
          await import('@jbrowse/core/svg/saveSvgAsImage')
        await saveSvgAsImage(html, opts)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * showTrack for a track whose display state model may be lazily
       * loaded: loads it, then shows
       */
      async launchTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
      ) {
        return launchTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
        )
      },
      /**
       * #action
       * toggleTrack with launchTrack's loading behavior
       */
      async launchToggleTrack(trackId: string) {
        return launchToggleTrackGeneric(self, trackId)
      },
      /**
       * #action
       * `addTrackConf` with `launchTrack`'s loading behavior, for a track
       * handed over inline rather than from a session list
       */
      async launchTrackConf(
        configuration: Record<string, unknown>,
        initialSnapshot = {},
      ) {
        const { trackId } = configuration
        return typeof trackId === 'string'
          ? launchTrackGeneric(
              self,
              trackId,
              initialSnapshot,
              {},
              configuration,
            )
          : undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        return self.setHeight(oldHeight + distance) - oldHeight
      },
      /**
       * #action
       */
      resizeWidth(distance: number) {
        const oldWidth = self.volatileWidth
        if (oldWidth === undefined) {
          return 0
        }
        self.setWidth(oldWidth + distance)
        return self.width - oldWidth
      },
    }))
    .actions(self => ({
      afterAttach() {
        installInitAutorun(self, {
          name: 'CircularViewInit',
          ready: () => self.initialized,
          // the same line postProcessSnapshot draws for persistence: once
          // regions are on the circle the view is up, so a later failure is one
          // step's problem and must not take the figure down with it —
          // showImportForm keys off `error` alone
          materialized: () => self.displayedRegions.length > 0,
          apply: init => applyInit(self, init),
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       * return the view menu items
       */
      menuItems(): MenuItem[] {
        return [
          {
            label: 'Return to import form',
            onClick: () => {
              self.setDisplayedRegions([])
            },
            icon: FolderOpenIcon,
          },
          {
            label: 'Reset view',
            onClick: () => {
              self.resetView()
            },
            icon: CenterFocusStrongIcon,
          },
          {
            label: 'Export SVG',
            icon: PhotoCameraIcon,
            onClick: () => {
              self.openExportDialog()
            },
          },
          {
            label: 'Open track selector',
            onClick: () => {
              self.activateTrackSelector()
            },
            icon: TrackSelectorIcon,
          },
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // launch is transient: redundant once displayedRegions exist, so strip it
      // then. While displayedRegions is still empty it is the only thing that
      // can rebuild the view -> keep it so a reload/restore resumes instead of
      // dropping to the import form. displayedRegions is stripDefault, so it's
      // absent (not []) when empty — the optional chain is runtime-necessary
      // despite the non-nullish type.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (snap.displayedRegions?.length) {
        const { launch, ...rest } = snap
        return rest as typeof snap
      }
      return snap
    })

  return withLaunchInput(model, circularLaunchKeys, pluginManager)
}

export type CircularViewStateModel = ReturnType<typeof stateModelFactory>

// #region registry
declare module '@jbrowse/core/PluginManager' {
  interface ViewTypeRegistry {
    CircularView: CircularViewStateModel
  }
}
// #endregion
export type CircularViewModel = Instance<CircularViewStateModel>

export default stateModelFactory
