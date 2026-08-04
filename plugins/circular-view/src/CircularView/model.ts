import { lazy } from 'react'

import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import {
  clamp,
  getSession,
  isSessionModelWithWidgets,
  selectNamedRegions,
} from '@jbrowse/core/util'
import {
  hideTrackGeneric,
  normalizeTrackInit,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { autorun } from 'mobx'

import { calculateStaticSlices } from './slices.ts'

import type { SliceRegion } from './slices.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { Region } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
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
       * Whether the view is fully initialized and ready to display
       */
      get showView() {
        return !!self.displayedRegions.length && this.initialized
      },

      /**
       * #getter
       * Whether to show the import form (when not ready to display and import
       * form is enabled, or when there's an error)
       */
      get showImportForm() {
        return (
          (!this.hasSomethingToShow && !self.disableImportForm) || !!this.error
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
       * zoom toward/away from a specific angle on the circle, keeping the
       * genome position at that angle visually fixed under the cursor
       */
      zoomToPoint(newBpPerPx: number, cursorAngle: number) {
        self.autoFit = false
        const oldRadius = self.radiusPx
        self.bpPerPx = clamp(newBpPerPx, self.minBpPerPx, self.maxBpPerPx)
        // figureOriginXY keeps the circle's center pinned to the middle of the
        // box, so the only thing that moves the cursor's point is its own
        // offset from that center growing with the radius
        const dr = oldRadius - self.radiusPx
        self.panX += dr * Math.cos(cursorAngle)
        self.panY += dr * Math.sin(cursorAngle)
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
        const { saveSvgAsImage } = await import('@jbrowse/core/util')
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
        addDisposer(
          self,
          autorun(
            function circularViewInitAutorun() {
              const { init, initialized } = self
              if (!initialized) {
                return
              }
              if (init) {
                const session = getSession(self)
                const { assemblyManager } = session
                const assembly = assemblyManager.get(init.assembly)
                const regions = assembly?.regions

                if (regions) {
                  const names = init.displayedRegionNames
                  self.setDisplayedRegions(
                    names
                      ? selectNamedRegions(regions, names, n =>
                          assembly.getCanonicalRefName(n),
                        )
                      : regions,
                  )
                }

                if (init.tracks) {
                  for (const t of init.tracks) {
                    const { trackId, trackSnapshot, displaySnapshot } =
                      normalizeTrackInit(t)
                    self.showTrack(trackId, trackSnapshot, displaySnapshot)
                  }
                }

                self.setInit(undefined)
              }
            },
            { name: 'CircularViewInit' },
          ),
        )
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
