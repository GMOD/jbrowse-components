import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
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
         */
        chainMerge: false,
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
        autoAlpha: types.optional(types.boolean, true),
        /**
         * #property
         */
        minAlignmentLength: types.optional(types.number, 0),
        /**
         * #property
         */
        colorBy: types.optional(types.string, 'default'),
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
    }))
    .views(self => ({
      /**
       * #getter
       */
      get numFeats() {
        let n = 0
        for (const level of self.levels) {
          n += (level as unknown as { numFeats: number }).numFeats
        }
        return n
      },
      /**
       * #getter
       * When autoAlpha is on, scales opacity down as total feature count grows.
       * Formula keeps ~500 feats at 0.2 (the manual default).
       */
      get effectiveAlpha() {
        if (!self.autoAlpha) {
          return self.alpha
        }
        const n = this.numFeats
        return n > 0 ? Math.min(0.8, Math.max(0.05, 100 / n)) : 0.8
      },
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
    }))
    .views(self => ({
      /**
       * #getter
       * Whether to show a loading indicator instead of the import form or view
       */
      get showLoading() {
        return self.isLoading || (!self.initialized && self.hasSomethingToShow)
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
      setChainMerge(arg: boolean) {
        self.chainMerge = arg
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
      setAutoAlpha(arg: boolean) {
        self.autoAlpha = arg
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
      setColorBy(arg: string) {
        self.colorBy = arg
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
    }))
    .actions(self => ({
      /**
       * #action
       */
      async exportSvg(opts: ExportSvgOptions) {
        const { renderToSvg } =
          await import('./svgcomponents/SVGLinearSyntenyView.tsx')
        const html = await renderToSvg(self as LinearSyntenyViewModel, opts)
        const { saveAs } = await import('@jbrowse/core/util')

        if (opts.format === 'png') {
          const img = new Image()
          const svgBlob = new Blob([html], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(svgBlob)
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0)
              URL.revokeObjectURL(url)
              canvas.toBlob(blob => {
                if (blob) {
                  saveAs(blob, opts.filename || 'image.png')
                  resolve()
                } else {
                  reject(
                    new Error(
                      `Failed to create PNG. The image may be too large (${img.width}x${img.height}). Try reducing the view size or use SVG format.`,
                    ),
                  )
                }
              }, 'image/png')
            }
            img.onerror = () => {
              URL.revokeObjectURL(url)
              reject(new Error('Failed to load SVG for PNG conversion'))
            }
            img.src = url
          })
        } else {
          saveAs(
            new Blob([html], { type: 'image/svg+xml' }),
            opts.filename || 'image.svg',
          )
        }
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
              label: 'Chain collinear alignments',
              type: 'checkbox',
              checked: self.chainMerge,
              onClick: () => {
                self.setChainMerge(!self.chainMerge)
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
                    label: 'Synteny levels',
                    subMenu: [
                      {
                        label: 'Expand all levels',
                        onClick: () => {
                          self.expandAllLevels()
                        },
                      },
                      {
                        label: 'Collapse all levels',
                        onClick: () => {
                          self.collapseAllLevels()
                        },
                      },
                      {
                        label: 'Auto-scale level heights',
                        onClick: () => {
                          self.autoScaleLevelHeights()
                        },
                      },
                      { label: '', type: 'divider' as const },
                      ...self.levels.map((level, idx) => ({
                        label: `Focus: ${self.views[idx]!.assemblyNames[0] ?? ''} ↔ ${self.views[idx + 1]!.assemblyNames[0] ?? ''}`,
                        type: 'radio' as const,
                        checked:
                          !level.collapsed &&
                          self.levels.filter(l => !l.collapsed).length === 1,
                        onClick: () => {
                          self.focusLevel(idx)
                        },
                      })),
                    ],
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
            {
              label: 'CIGAR display mode',
              subMenu: [
                {
                  label: 'Colorize indels',
                  type: 'radio',
                  checked: self.cigarMode === 'full',
                  onClick: () => {
                    self.setCigarMode('full')
                  },
                },
                {
                  label: "Don't colorize indels",
                  type: 'radio',
                  checked: self.cigarMode === 'matches',
                  onClick: () => {
                    self.setCigarMode('matches')
                  },
                },
                {
                  label: "Don't draw CIGAR",
                  type: 'radio',
                  checked: self.cigarMode === 'off',
                  onClick: () => {
                    self.setCigarMode('off')
                  },
                },
              ],
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
        addDisposer(
          self,
          autorun(
            async function initAutorun() {
              const { init, width } = self
              if (!width || !init) {
                return
              }

              const session = getSession(self)
              const { assemblyManager } = session

              try {
                // Wait for all assemblies to be ready and get their regions
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

                // Set up the views with displayed regions (not using init)
                self.setViews(
                  assemblies.map(asm => ({
                    type: 'LinearGenomeView' as const,
                    bpPerPx: 1,
                    offsetPx: 0,
                    hideHeader: true,
                    displayedRegions: asm.regions,
                  })),
                )

                // Wait for child views to initialize
                await Promise.all(
                  self.views.map(view => when(() => view.initialized)),
                )

                // Navigate to locations and show tracks on child views
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

                // Show synteny tracks. tracks is string[][] — outer index is
                // the level (between views[i] and views[i+1]).
                if (init.tracks) {
                  for (let i = 0; i < init.tracks.length; i++) {
                    const ids = init.tracks[i]
                    if (!ids) {
                      continue
                    }
                    for (const trackId of ids) {
                      self.showTrack(trackId, i)
                    }
                  }
                }

                if (self.levels.length >= 4) {
                  self.autoScaleLevelHeights()
                }

                // Clear init state
                self.setInit(undefined)
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
                self.setInit(undefined)
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
        chainMerge,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(cigarMode !== 'full' ? { cigarMode } : {}),
        ...(drawCurves ? { drawCurves } : {}),
        ...(drawLocationMarkers ? { drawLocationMarkers } : {}),
        ...(overdrawPx !== DEFAULT_OVERDRAW_PX ? { overdrawPx } : {}),
        ...(chainMerge ? { chainMerge } : {}),
      } as typeof snap
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
