import {
  Instance,
  SnapshotIn,
  cast,
  types,
  getParent,
  getSnapshot,
  addDisposer,
  resolveIdentifier,
  getRoot,
} from 'mobx-state-tree'

import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { makeTicks } from './components/util'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { ReturnToImportFormDialog } from '@jbrowse/core/ui'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { observable, autorun, transaction } from 'mobx'
import { BaseTrackStateModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import {
  getSession,
  isSessionModelWithWidgets,
  minmax,
  measureText,
} from '@jbrowse/core/util'
import { getConf, AnyConfigurationModel } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'

type Coord = [number, number]

// Used in the renderer
// ref https://mobx-state-tree.js.org/concepts/volatiles on volatile state used here
export const Dotplot1DView = Base1DView.extend(self => {
  const scaleFactor = observable.box(1)
  return {
    views: {
      get dynamicBlocks() {
        return calculateDynamicBlocks(self, false, false)
      },
      get scaleFactor() {
        return scaleFactor.get()
      },
    },
    actions: {
      setScaleFactor(n: number) {
        scaleFactor.set(n)
      },
    },
  }
})

export type Dotplot1DViewModel = Instance<typeof Dotplot1DView>

const DotplotHView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent(self).viewWidth
    },
  },
}))

const DotplotVView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent(self).viewHeight
    },
  },
}))

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      BaseViewModel,
      types.model('DotplotView', {
        id: ElementId,
        type: types.literal('DotplotView'),
        headerHeight: 0,
        height: 600,
        borderSize: 20,
        tickSize: 5,
        vtextRotation: 0,
        htextRotation: -90,
        fontSize: 15,
        trackSelectorType: 'hierarchical',
        assemblyNames: types.array(types.string),
        hview: types.optional(DotplotHView, {}),
        vview: types.optional(DotplotVView, {}),

        tracks: types.array(
          pluginManager.pluggableMstType(
            'track',
            'stateModel',
          ) as BaseTrackStateModel,
        ),

        // this represents tracks specific to this view specifically used for
        // read vs ref dotplots where this track would not really apply
        // elsewhere
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        ),

        // this represents assemblies in the specialized read vs ref dotplot
        // view
        viewAssemblyConfigs: types.array(types.frozen()),
      }),
    )
    .volatile(() => ({
      volatileWidth: undefined as number | undefined,
      volatileError: undefined as Error | undefined,
      borderX: 100,
      borderY: 100,
    }))
    .views(self => ({
      get width(): number {
        if (!self.volatileWidth) {
          throw new Error('width not initialized')
        }
        return self.volatileWidth
      },
    }))
    .views(self => ({
      get assemblyErrors() {
        const { assemblyManager } = getSession(self)
        return self.assemblyNames
          .map(a => assemblyManager.get(a)?.error)
          .filter(f => !!f)
          .join(', ')
      },
      get assembliesInitialized() {
        const { assemblyNames } = self
        const { assemblyManager } = getSession(self)
        return assemblyNames.every(
          n => assemblyManager.get(n)?.initialized ?? true,
        )
      },
    }))
    .views(self => ({
      get initialized() {
        return (
          self.volatileWidth !== undefined &&
          self.hview.displayedRegions.length > 0 &&
          self.vview.displayedRegions.length > 0 &&
          self.assembliesInitialized
        )
      },

      get hticks() {
        const { hview } = self
        const { dynamicBlocks, staticBlocks, bpPerPx } = hview
        return dynamicBlocks.contentBlocks.length > 5
          ? []
          : makeTicks(staticBlocks.contentBlocks, bpPerPx)
      },

      get vticks() {
        const { vview } = self
        const { dynamicBlocks, staticBlocks, bpPerPx } = vview
        return dynamicBlocks.contentBlocks.length > 5
          ? []
          : makeTicks(staticBlocks.contentBlocks, bpPerPx)
      },

      get loading() {
        return self.assemblyNames.length > 0 && !this.initialized
      },
      get viewWidth() {
        return self.width - self.borderX
      },
      get viewHeight() {
        return self.height - self.borderY
      },
      get views() {
        return [self.hview, self.vview]
      },

      renderProps() {
        return {
          ...getParentRenderProps(self),
          highResolutionScaling: getConf(
            getSession(self),
            'highResolutionScaling',
          ),
        }
      },
    }))
    .actions(self => ({
      clearView() {
        self.hview.setDisplayedRegions([])
        self.vview.setDisplayedRegions([])
        self.assemblyNames = cast([])
      },
      setBorderX(n: number) {
        self.borderX = n
      },
      setBorderY(n: number) {
        self.borderY = n
      },
      setWidth(newWidth: number) {
        self.volatileWidth = newWidth
        return self.volatileWidth
      },
      setHeight(newHeight: number) {
        self.height = newHeight
        return self.height
      },

      setError(e: Error) {
        self.volatileError = e
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setHeaderHeight(height: number) {
        self.headerHeight = height
      },

      zoomOutButton() {
        self.hview.zoomOut()
        self.vview.zoomOut()
      },
      zoomInButton() {
        self.hview.zoomIn()
        self.vview.zoomIn()
      },
      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const session: any = getSession(self)
          const selector = session.addWidget(
            'HierarchicalTrackSelectorWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showWidget(selector)
          return selector
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      showTrack(trackId: string, initialSnapshot = {}) {
        const trackConfigSchema =
          pluginManager.pluggableConfigSchemaType('track')
        const configuration = resolveIdentifier(
          trackConfigSchema,
          getRoot(self),
          trackId,
        )
        const trackType = pluginManager.getTrackType(configuration.type)
        if (!trackType) {
          throw new Error(`unknown track type ${configuration.type}`)
        }
        const viewType = pluginManager.getViewType(self.type)
        const displayConf = configuration.displays.find(
          (d: AnyConfigurationModel) => {
            if (
              viewType.displayTypes.find(
                displayType => displayType.name === d.type,
              )
            ) {
              return true
            }
            return false
          },
        )
        if (!displayConf) {
          throw new Error(
            `could not find a compatible display for view type ${self.type}`,
          )
        }
        const track = trackType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
          displays: [{ type: displayConf.type, configuration: displayConf }],
        })
        self.tracks.push(track)
      },

      hideTrack(trackId: string) {
        const trackConfigSchema =
          pluginManager.pluggableConfigSchemaType('track')
        const configuration = resolveIdentifier(
          trackConfigSchema,
          getRoot(self),
          trackId,
        )
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },

      toggleTrack(trackId: string) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(trackId)
        // if none had that configuration, turn one on
        if (!hiddenCount) {
          this.showTrack(trackId)
        }
      },
      setAssemblyNames(target: string, query: string) {
        self.assemblyNames = cast([target, query])
      },
      setViews(arr: SnapshotIn<Base1DViewModel>[]) {
        self.hview = cast(arr[0])
        self.vview = cast(arr[1])
      },

      getCoords(mousedown: Coord, mouseup: Coord) {
        const [xmin, xmax] = minmax(mouseup[0], mousedown[0])
        const [ymin, ymax] = minmax(mouseup[1], mousedown[1])
        return Math.abs(xmax - xmin) > 3 && Math.abs(ymax - ymin) > 3
          ? [
              self.hview.pxToBp(xmin),
              self.hview.pxToBp(xmax),
              self.vview.pxToBp(self.viewHeight - ymin),
              self.vview.pxToBp(self.viewHeight - ymax),
            ]
          : undefined
      },

      zoomIn(mousedown: Coord, mouseup: Coord) {
        const result = this.getCoords(mousedown, mouseup)
        if (result) {
          const [x1, x2, y1, y2] = result
          self.hview.moveTo(x1, x2)
          self.vview.moveTo(y2, y1)
        }
      },
      onDotplotView(mousedown: Coord, mouseup: Coord) {
        const result = this.getCoords(mousedown, mouseup)
        if (result) {
          const [x1, x2, y1, y2] = result
          const session = getSession(self)

          const d1 = Dotplot1DView.create({
            ...getSnapshot(self.hview),
            minimumBlockWidth: 0,
            interRegionPaddingWidth: 0,
          })
          const d2 = Dotplot1DView.create({
            ...getSnapshot(self.vview),
            minimumBlockWidth: 0,
            interRegionPaddingWidth: 0,
          })
          d1.setVolatileWidth(self.hview.width)
          d2.setVolatileWidth(self.vview.width)
          d1.moveTo(x1, x2)
          d2.moveTo(y2, y1)
          d1.zoomTo(d1.bpPerPx / (self.width / self.hview.width), 0)
          d2.zoomTo(d2.bpPerPx / (self.width / self.vview.width), 0)

          // add the specific evidence tracks to the LGVs in the split view
          // note: scales the bpPerPx by scaling proportional of the dotplot
          // width to the eventual lgv width
          const tracks = self.tracks
            .map(track => {
              const trackConf = track.configuration
              return trackConf.displays.find(
                (display: { type: string }) =>
                  display.type === 'LinearSyntenyDisplay',
              )
            })
            .filter(f => !!f)
            .map(displayConf => {
              const trackConf = getParent(displayConf, 2)
              return {
                type: getParent(displayConf, 2).type,
                configuration: trackConf,
                displays: [
                  { type: displayConf.type, configuration: displayConf },
                ],
              }
            })
          const viewSnapshot = {
            type: 'LinearSyntenyView',
            views: [
              {
                type: 'LinearGenomeView',
                ...getSnapshot(d1),
                tracks: [],
                hideHeader: true,
              },
              {
                type: 'LinearGenomeView',
                ...getSnapshot(d2),
                tracks: [],
                hideHeader: true,
              },
            ],
            tracks,
          }

          session.addView('LinearSyntenyView', viewSnapshot)
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function initializer() {
              const session = getSession(self)
              if (self.volatileWidth === undefined) {
                return
              }

              if (self.initialized) {
                return
              }
              const axis = [self.viewWidth, self.viewHeight]
              const views = [self.hview, self.vview]
              self.assemblyNames.forEach((name, index) => {
                const assembly = session.assemblyManager.get(name)
                if (assembly) {
                  if (assembly.error) {
                    self.setError(assembly.error)
                  }
                  const { regions } = assembly
                  if (regions && regions.length) {
                    const regionsSnapshot = regions
                    if (regionsSnapshot) {
                      transaction(() => {
                        const view = views[index]
                        view.setDisplayedRegions(regionsSnapshot)
                        view.setBpPerPx(view.totalBp / axis[index])
                      })
                    }
                  }
                }
              })
            },
            { delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(function borderSetter() {
            // make sure we have a width on the view before trying to load
            const { vview, hview } = self
            if (self.volatileWidth === undefined) {
              return
            }
            const padding = 10
            const vblocks = vview.dynamicBlocks.contentBlocks
            const hblocks = hview.dynamicBlocks.contentBlocks
            const len = (a: string) => measureText(a.slice(0, 30))
            const by = hblocks.reduce((a, b) => Math.max(a, len(b.refName)), 0)
            const bx = vblocks.reduce((a, b) => Math.max(a, len(b.refName)), 0)
            // these are set via autorun to avoid dependency cycle
            self.setBorderY(Math.max(by + padding, 100))
            self.setBorderX(Math.max(bx + padding, 100))
          }),
        )
      },
      squareView() {
        const { hview, vview } = self
        const avg = (hview.bpPerPx + vview.bpPerPx) / 2
        const hpx = hview.pxToBp(hview.width / 2)
        const vpx = vview.pxToBp(vview.width / 2)
        hview.setBpPerPx(avg)
        hview.centerAt(hpx.coord, hpx.refName, hpx.index)
        vview.setBpPerPx(avg)
        vview.centerAt(vpx.coord, vpx.refName, vpx.index)
      },
      squareViewProportional() {
        const { hview, vview } = self
        const ratio = hview.width / vview.width
        const avg = (hview.bpPerPx + vview.bpPerPx) / 2
        const hpx = hview.pxToBp(hview.width / 2)
        const vpx = vview.pxToBp(vview.width / 2)
        hview.setBpPerPx(avg / ratio)
        hview.centerAt(hpx.coord, hpx.refName, hpx.index)
        vview.setBpPerPx(avg)
        vview.centerAt(vpx.coord, vpx.refName, vpx.index)
      },
    }))
    .views(self => ({
      menuItems() {
        const session = getSession(self)
        return [
          {
            label: 'Return to import form',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                { model: self, handleClose },
              ])
            },
            icon: FolderOpenIcon,
          },
          {
            label: 'Square view - same bp per pixel',
            onClick: () => self.squareView(),
          },
          {
            label: 'Rectangular view - same total bp',
            onClick: () => self.squareView(),
          },
          ...(isSessionModelWithWidgets(session)
            ? [
                {
                  label: 'Open track selector',
                  onClick: self.activateTrackSelector,
                  icon: TrackSelectorIcon,
                },
              ]
            : []),
        ]
      },
      get error() {
        return self.volatileError || self.assemblyErrors
      },
    }))
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>
