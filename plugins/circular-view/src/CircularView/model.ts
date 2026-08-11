import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getSession,
  isSessionModelWithWidgets,
  selectNamedRegions,
} from '@jbrowse/core/util'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import {
  hideTrackGeneric,
  normalizeTrackInit,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { cast, types } from '@jbrowse/mobx-state-tree'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

import { calculateStaticSlices } from './slices.ts'

import type { SliceRegion } from './slices.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { Region } from '@jbrowse/core/util/types'
import type { IStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { FC, ReactNode } from 'react'

const twoPi = 2 * Math.PI

// the figure never grows past this, so a zoomed-in circle stays a size the
// browser can lay out
const maximumRadiusPx = 5000

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))

export interface CircularViewInit {
  assembly: string
  // restrict the circle to these assembly refNames (whole chromosomes), in the
  // order given — e.g. the main chromosomes without the unplaced/alt contigs,
  // which otherwise take a slice each. Names resolve through the assembly's
  // aliases and may be globs, the same as the linear view's key of this name.
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
}
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
  showTrack: (
    trackId: string,
    trackSnapshot?: Record<string, unknown>,
    displaySnapshot?: Record<string, unknown>,
  ) => unknown
}

/**
 * Apply one `init` blob: the regions the circle is drawn from, then the chord
 * tracks. Nothing here awaits, so `installInitAutorun`'s supersede ceiling never
 * comes up — it is still the owner of the re-entry guard, the `isAlive` checks,
 * the identity-checked clear of `init`, and the failure policy.
 */
function applyInit(self: CircularViewInitSelf, init: CircularViewInit) {
  const session = getSession(self)
  const assembly = session.assemblyManager.get(init.assembly)
  const regions = assembly?.regions
  if (assembly && regions) {
    const names = init.displayedRegionNames
    const named = names
      ? selectNamedRegions(regions, names, n => assembly.getCanonicalRefName(n))
      : regions
    // A list that matches nothing draws the whole assembly rather than blanking
    // the circle — the same fallback the LGV's and the dotplot's key of this
    // name take, and it matters more here: an empty displayedRegions drops the
    // view to its import form, and `init`, the only thing that could rebuild
    // the figure, is consumed on the way out. So a typo'd refName used to lose
    // the view outright with nothing said.
    if (names && !named.length) {
      session.notify(
        `displayedRegionNames matched no regions in ${init.assembly}: ${names.join(', ')}`,
        'warning',
      )
    }
    self.setDisplayedRegions(named.length ? named : regions)
  }
  for (const t of init.tracks ?? []) {
    const { trackId, trackSnapshot, displaySnapshot } = normalizeTrackInit(t)
    self.showTrack(trackId, trackSnapshot, displaySnapshot)
  }
}

/**
 * #stateModel CircularView
 *
 * #example
 * Hand-authored under `defaultSession.views`. The `init` shorthand takes a
 * single `assembly` and the structural-variant `tracks` to draw as chords. A
 * track entry may carry display config inline, and `displayedRegionNames` keeps
 * an assembly's alt/unplaced contigs off the circle:
 * ```js
 * {
 *   type: 'CircularView',
 *   init: {
 *     assembly: 'hg38',
 *     displayedRegionNames: ['chr1', 'chr2', 'chr3'],
 *     tracks: [{ trackId: 'my-sv-vcf', strokeColor: 'red' }],
 *   },
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
  const defaultMinVisibleWidth = 6
  return types
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
         */
        hideVerticalResizeHandle: types.stripDefault(types.boolean, false),
        /**
         * #property
         */
        hideTrackSelectorButton: types.stripDefault(types.boolean, false),
        /**
         * #property
         */
        disableImportForm: types.stripDefault(types.boolean, false),

        /**
         * #property
         */
        height: types.stripDefault(types.number, defaultHeight),
        /*
         * #property
         */
        displayedRegions: types.stripDefault(types.frozen<Region[]>(), []),
        /**
         * #property
         */
        minimumRadiusPx: types.stripDefault(
          types.number,
          defaultMinimumRadiusPx,
        ),
        /**
         * #property
         */
        spacingPx: types.stripDefault(types.number, defaultSpacingPx),
        /**
         * #property
         */
        paddingPx: types.stripDefault(types.number, defaultPaddingPx),
        /**
         * #property
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
         * used for initializing the view from a session snapshot
         */
        init: types.frozen<CircularViewInit | undefined>(),
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
       */
      get circumferencePx() {
        return this.elidedRegions.reduce(
          (sum, r) => sum + r.widthBp / self.bpPerPx + self.spacingPx,
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
        const c = this.radiusPx + self.paddingPx
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
        return this.radiusPx * 2 + 2 * self.paddingPx
      },
      /**
       * #getter
       * top-left of the figure within the view's box. The figure is centered
       * there — a view much wider than it is tall would otherwise leave the
       * circle jammed in the corner under the controls, and a figure zoomed
       * past the box overflows evenly rather than only off the bottom-right —
       * and then shifted by the zoom-to-cursor pan
       */
      get figureOriginXY(): [number, number] {
        const { figureSize } = this
        return [
          (this.width - figureSize) / 2 + self.panX,
          (self.height - figureSize) / 2 + self.panY,
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
       */
      get assemblyNames() {
        return [...new Set(self.displayedRegions.map(r => r.assemblyName))]
      },
      /**
       * #getter
       */
      get initialized() {
        if (self.volatileWidth === undefined) {
          return false
        }
        const { assemblyManager } = getSession(self)
        // if init is set, wait for that assembly to have regions loaded
        if (self.init) {
          const asm = assemblyManager.get(self.init.assembly)
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
        return this.assemblyNames
          .map(name => assemblyManager.get(name)?.error)
          .filter(e => !!e)
          .join(', ')
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
        // Check init assembly for errors (displayedRegions may be empty during init)
        if (self.init) {
          const { assemblyManager } = getSession(self)
          const asm = assemblyManager.get(self.init.assembly)
          if (!asm) {
            return `Assembly ${self.init.assembly} not found`
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
        return self.displayedRegions.length > 0 || !!self.init
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
       * The assembly whose load the spinner is waiting on. `init` names it
       * before displayedRegions exist, so it is the source until then — the same
       * order `initialized` above resolves in.
       */
      get loadingAssembly() {
        const { assemblyManager } = getSession(self)
        return assemblyManager.loadingAssembly(
          self.init ? [self.init.assembly] : this.assemblyNames,
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
    }))
    .views(self => ({
      /**
       * #getter
       */
      get staticSlices() {
        return calculateStaticSlices(self)
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
        const targetRadiusPx = Math.max(
          Math.min(self.width, self.height) / 2 - self.paddingPx,
          self.minimumRadiusPx,
        )
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
                twoPi * targetRadiusPx - sliceCount * self.spacingPx,
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
        this.setBpPerPx(newBpPerPx)
        if (!oldRadiusPx) {
          return
        }
        // figureOriginXY keeps the circle's center pinned to the middle of the
        // box, so the only thing that moves the point under the cursor is its
        // own offset from that center scaling with the radius. Taking the real
        // offset rather than assuming the cursor sits on the ruler ring is what
        // makes this hold over the chords too — at the middle of the figure the
        // ring assumption pushed the drawing by the whole radius change
        const scale = self.radiusPx / oldRadiusPx
        self.panX += cursorX * (1 - scale)
        self.panY += cursorY * (1 - scale)
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
      setInit(init?: CircularViewInit) {
        self.init = init
      },

      /**
       * #action
       */
      showTrack(
        trackId: string,
        initialSnapshot = {},
        displayInitialSnapshot = {},
      ) {
        return showTrackGeneric(
          self,
          trackId,
          initialSnapshot,
          displayInitialSnapshot,
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
        getSession(self).queueDialog(handleClose => [
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
          apply: async init => {
            applyInit(self, init)
          },
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
      // init is transient: redundant once displayedRegions exist, so strip it
      // then. While displayedRegions is still empty, init is the only thing that
      // can rebuild the view -> keep it so a reload/restore resumes instead of
      // dropping to the import form. displayedRegions is stripDefault, so it's
      // absent (not []) when empty — the optional chain is runtime-necessary
      // despite the non-nullish type.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (snap.displayedRegions?.length) {
        const { init, ...rest } = snap
        return rest as typeof snap
      }
      return snap
    })
}

export type CircularViewStateModel = ReturnType<typeof stateModelFactory>
export type CircularViewModel = Instance<CircularViewStateModel>

export default stateModelFactory
