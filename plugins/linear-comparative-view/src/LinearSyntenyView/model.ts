import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import { autorun, observable, when } from 'mobx'

import baseModel from '../LinearComparativeView/model.ts'

import type {
  ExportSvgOptions,
  ImportFormSyntenyTrack,
  LinearSyntenyViewInit,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

const DEFAULT_OVERDRAW_PX = 1000

// lazies
const ExportSvgDialog = lazy(() => import('./components/ExportSvgDialog.tsx'))
const DiagonalizationProgressDialog = lazy(
  () => import('./components/DiagonalizationProgressDialog.tsx'),
)

/**
 * #stateModel LinearSyntenyView
 * extends
 * - [LinearComparativeView](../linearcomparativeview)
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearSyntenyView',
      baseModel(pluginManager),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearSyntenyView'),
        /**
         * #property
         */
        cigarMode: types.optional(
          types.enumeration(['off', 'matches', 'full']),
          'full',
        ),
        /**
         * #property
         */
        drawCurves: false,
        /**
         * #property
         */
        drawLocationMarkers: false,
        /**
         * #property
         * pixels beyond the visible viewport edge that synteny lines are still drawn
         */
        overdrawPx: DEFAULT_OVERDRAW_PX,
        /**
         * #property
         */
        alpha: types.optional(types.number, 0.2),
        /**
         * #property
         */
        minAlignmentLength: types.optional(types.number, 0),
        /**
         * #property
         * Level-of-detail tier selection for PIF adapters. 'auto' uses the
         * adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier
         * (t/q); 'coarse' forces the no-CIGAR tier (T/Q) when present.
         */
        lodMode: types.optional(
          types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
          'auto',
        ),
        /**
         * #property
         */
        colorBy: types.optional(types.string, 'default'),
        /**
         * #property
         * Fade alignment blocks by per-feature identity (lower identity = more
         * transparent). Orthogonal to colorBy — surfaces identity-dropoff zones
         * without consuming the color channel.
         */
        opacityByIdentity: types.optional(types.boolean, false),
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
        init: types.frozen<LinearSyntenyViewInit | undefined>(),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>(),
      /**
       * #volatile
       * True while the init autorun is waiting for the first synteny RPC so
       * it can diagonalize. Used to gate the canvas off — otherwise the user
       * watches an undiagonalized hairball flash before the reorder kicks in.
       */
      awaitingAutoDiagonalize: false,
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
       * True if any track on any level has an adapter that declares the
       * 'lod' capability. Used to gate the LOD menu — adapters without
       * tiered storage (e.g. PAFAdapter, BlastTabularAdapter) have nothing
       * to switch between.
       */
      get hasLodCapableAdapter() {
        for (const level of self.levels) {
          for (const track of level.tracks) {
            if (track.adapterType.adapterCapabilities.includes('lod')) {
              return true
            }
          }
        }
        return false
      },
      /**
       * #getter
       * True if any currently-loaded synteny display has at least one
       * feature with a CIGAR. Used to gate CIGAR-related menu items —
       * coarse-tier PIF files and CIGAR-less PAFs have nothing to show.
       * Returns true while no data has loaded yet so the menu doesn't
       * flicker between renders.
       */
      get hasCigarData() {
        let anyDataLoaded = false
        for (const level of self.levels) {
          for (const display of level.linearSyntenyDisplays) {
            if (display.featureData?.hasCigar) {
              return true
            }
            if (display.featureData) {
              anyDataLoaded = true
            }
          }
        }
        return !anyDataLoaded
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return (
          self.isLoading ||
          self.awaitingAutoDiagonalize ||
          (!self.initialized && self.hasSomethingToShow)
        )
      },
      /**
       * #getter
       * Override the base loadingMessage so the spinner has a helpful label
       * during the autoDiagonalize wait, instead of just "Loading".
       */
      get loadingMessage() {
        if (self.awaitingAutoDiagonalize) {
          return 'Reordering chromosomes…'
        }
        return this.showLoading ? 'Loading' : undefined
      },
      /**
       * #getter
       * Whether to show the import form
       */
      get showImportForm() {
        return !self.hasSomethingToShow
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      importFormRemoveRow(idx: number) {
        self.importFormSyntenyTrackSelections.splice(idx, 1)
      },
      /**
       * #action
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
      setCigarMode(arg: 'off' | 'matches' | 'full') {
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
      setLodMode(arg: 'auto' | 'fine' | 'coarse') {
        self.lodMode = arg
      },
      /**
       * #action
       */
      setColorBy(arg: SyntenyColorBy) {
        self.colorBy = arg
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
      showAllRegions() {
        for (const view of self.views) {
          view.showAllRegionsInAssembly()
        }
      },
      /**
       * #action
       */
      setInit(init?: LinearSyntenyViewInit) {
        self.init = init
      },
      /**
       * #action
       */
      setAwaitingAutoDiagonalize(arg: boolean) {
        self.awaitingAutoDiagonalize = arg
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearSyntenyView.tsx')
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        const { saveSvgAsImage } = await import('@jbrowse/core/util')
        await saveSvgAsImage(html, opts)
      },
    }))
    .views(self => {
      const superHeaderMenuItems = self.headerMenuItems
      const superShowMenuItems = self.showMenuItems
      const superMenuItems = self.menuItems
      return {
        /**
         * #method
         */
        showMenuItems() {
          return [
            ...superShowMenuItems(),
            {
              label: 'Show all regions',
              onClick: self.showAllRegions,
            },
            {
              label: 'Show dynamic controls',
              type: 'checkbox',
              checked: self.showDynamicControls,
              onClick: () => {
                self.setShowDynamicControls(!self.showDynamicControls)
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
              onClick: self.squareView,
              icon: CropFreeIcon,
            },
            {
              label: 'Re-order chromosomes',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  DiagonalizationProgressDialog,
                  {
                    handleClose,
                    model: self,
                  },
                ])
              },
              icon: ShuffleIcon,
            },
            ...(self.levels.length > 1
              ? [
                  {
                    label: 'Auto-scale level heights',
                    onClick: () => {
                      self.autoScaleLevelHeights()
                    },
                  },
                ]
              : []),
            ...(self.views.length > 2
              ? [
                  {
                    label: 'Genome views',
                    subMenu: [
                      {
                        label: 'Compact all views',
                        onClick: () => {
                          self.compactAllViews()
                        },
                      },
                      {
                        label: 'Expand all views',
                        onClick: () => {
                          self.expandAllViews()
                        },
                      },
                      { label: '', type: 'divider' as const },
                      ...self.views.map((view, idx) => ({
                        label: view.assemblyNames[0] ?? `View ${idx + 1}`,
                        type: 'checkbox' as const,
                        checked: !self.isViewCompact(idx),
                        onClick: () => {
                          self.toggleCompactView(idx)
                        },
                      })),
                    ],
                  },
                ]
              : []),
            ...(self.hasCigarData
              ? [
                  {
                    label: 'CIGAR display mode',
                    subMenu: (
                      [
                        { label: 'Colorize indels', mode: 'full' },
                        { label: "Don't colorize indels", mode: 'matches' },
                        { label: "Don't draw CIGAR", mode: 'off' },
                      ] as const
                    ).map(({ label, mode }) => ({
                      label,
                      type: 'radio' as const,
                      checked: self.cigarMode === mode,
                      onClick: () => {
                        self.setCigarMode(mode)
                      },
                    })),
                  },
                ]
              : []),
            ...(self.hasLodCapableAdapter
              ? [
                  {
                    label: 'Level of detail',
                    subMenu: (
                      [
                        { label: 'Auto (scale with zoom)', value: 'auto' },
                        { label: 'Fine (per-row CIGAR)', value: 'fine' },
                        { label: 'Coarse (no CIGAR)', value: 'coarse' },
                      ] as const
                    ).map(({ label, value }) => ({
                      label,
                      type: 'radio' as const,
                      checked: self.lodMode === value,
                      onClick: () => {
                        self.setLodMode(value)
                      },
                    })),
                  },
                ]
              : []),
            {
              // Post-fetch feature filter — orthogonal to the LOD tier above.
              label: 'Filter by alignment span',
              subMenu: (
                [
                  { label: 'No filter', value: 0 },
                  { label: '100 kb', value: 100_000 },
                  { label: '1 Mb', value: 1_000_000 },
                  { label: '10 Mb', value: 10_000_000 },
                ] as const
              ).map(({ label, value }) => ({
                label,
                type: 'radio' as const,
                checked: self.minAlignmentLength === value,
                onClick: () => {
                  self.setMinAlignmentLength(value)
                },
              })),
            },
            {
              label: 'Link views',
              type: 'checkbox',
              checked: self.linkViews,
              icon: LinkIcon,
              onClick: () => {
                self.setLinkViews(!self.linkViews)
              },
            },
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: (): void => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
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
            {
              label: 'Export SVG',
              icon: PhotoCameraIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ExportSvgDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // Serialize concurrent firings: dockview mount + React Strict Mode
        // double-invoke cause width to settle in multiple steps. Each width
        // change re-fires this autorun, and without the guard a second run's
        // setViews() detaches the first run's view models — the first's
        // `when(() => view.initialized)` then throws on the dead node, the
        // catch clears init, and the import form appears.
        let running = false
        addDisposer(
          self,
          autorun(
            async function initAutorun() {
              const { init, width } = self
              if (!width || !init || running) {
                return
              }
              running = true

              const session = getSession(self)
              const { assemblyManager } = session

              try {
                const assemblies = await Promise.all(
                  init.views.map(async v => {
                    const asm = await assemblyManager.waitForAssembly(
                      v.assembly,
                    )
                    if (!asm) {
                      throw new Error(`Assembly ${v.assembly} failed to load`)
                    }
                    return asm
                  }),
                )

                self.setViews(
                  assemblies.map(asm => ({
                    type: 'LinearGenomeView' as const,
                    bpPerPx: 1,
                    offsetPx: 0,
                    hideHeader: true,
                    displayedRegions: asm.regions,
                  })),
                )

                await Promise.all(
                  self.views.map(view => when(() => view.initialized)),
                )

                await Promise.all(
                  init.views.map(async (viewInit, idx) => {
                    const view = self.views[idx]
                    if (!view) {
                      return
                    }
                    if (viewInit.loc) {
                      await view.navToLocString(viewInit.loc, viewInit.assembly)
                    } else {
                      view.showAllRegionsInAssembly(viewInit.assembly)
                    }
                    if (viewInit.tracks) {
                      for (const trackId of viewInit.tracks) {
                        view.showTrack(trackId)
                      }
                    }
                  }),
                )

                if (init.tracks) {
                  // string[] is shorthand for level-0 tracks; string[][] is per-level
                  const trackLevels: string[][] =
                    typeof init.tracks[0] === 'string'
                      ? [init.tracks as string[]]
                      : (init.tracks as string[][])
                  for (const [i, ids] of trackLevels.entries()) {
                    for (const trackId of ids) {
                      self.showTrack(trackId, i)
                    }
                  }
                }

                if (self.levels.length >= 4) {
                  self.autoScaleLevelHeights()
                }

                if (init.colorBy) {
                  self.setColorBy(init.colorBy)
                }
                if (init.minAlignmentLength !== undefined) {
                  self.setMinAlignmentLength(init.minAlignmentLength)
                }
                if (init.drawCurves !== undefined) {
                  self.setDrawCurves(init.drawCurves)
                }
                if (init.alpha !== undefined) {
                  self.setAlpha(init.alpha)
                }

                if (init.levelHeights) {
                  for (const [i, h] of init.levelHeights.entries()) {
                    self.levels[i]?.setHeight(h)
                  }
                }

                if (init.autoDiagonalize) {
                  // Wait for the first synteny RPC to populate featureData on
                  // every display, then diagonalize. Race with a 30s ceiling
                  // so a stuck/minimized display never deadlocks init. The
                  // awaitingAutoDiagonalize flag flips showLoading on, so the
                  // user sees a spinner with the "Reordering chromosomes…"
                  // message instead of an undiagonalized hairball flash.
                  self.setAwaitingAutoDiagonalize(true)
                  try {
                    const { runDiagonalize, displaysReady } =
                      await import('./util/runDiagonalize.ts')
                    const view = self
                    await Promise.race([
                      when(() => displaysReady(view)),
                      new Promise(resolve => {
                        setTimeout(resolve, 30_000)
                      }),
                    ])
                    if (displaysReady(view)) {
                      await runDiagonalize(view)
                    }
                  } finally {
                    if (isAlive(self)) {
                      self.setAwaitingAutoDiagonalize(false)
                    }
                  }
                }

                self.setInit(undefined)
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
                self.setInit(undefined)
              } finally {
                running = false
              }
            },
            { name: 'LinearSyntenyViewInit' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        init,
        cigarMode,
        drawCurves,
        drawLocationMarkers,
        overdrawPx,
        lodMode,
        ...rest
      } = snap
      return {
        ...rest,
        ...(cigarMode !== 'full' ? { cigarMode } : {}),
        ...(drawCurves ? { drawCurves } : {}),
        ...(drawLocationMarkers ? { drawLocationMarkers } : {}),
        ...(overdrawPx !== DEFAULT_OVERDRAW_PX ? { overdrawPx } : {}),
        ...(lodMode !== 'auto' ? { lodMode } : {}),
      } as typeof snap
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
