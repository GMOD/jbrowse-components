// typescript only imports, runtime imports below loaded via pluginManager
import { Instance, SnapshotIn } from 'mobx-state-tree'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import { Base1DViewModel } from '@gmod/jbrowse-core/util/Base1DViewModel'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

function approxPixelStringLen(str: string) {
  return str.length * 0.7 * 12
}

type Coord = [number, number]
export default function stateModelFactory(pluginManager: PluginManager) {
  const { lib } = pluginManager
  const { cast, types, getParent, getSnapshot, addDisposer } = lib[
    'mobx-state-tree'
  ]
  const { autorun, transaction } = lib.mobx
  const { ElementId } = lib['@gmod/jbrowse-core/util/types/mst']
  const Base1DView = lib['@gmod/jbrowse-core/util/Base1DViewModel']
  const { readConfObject } = lib['@gmod/jbrowse-core/configuration']
  const { getSession, minmax, isSessionModelWithWidgets } = lib[
    '@gmod/jbrowse-core/util'
  ]

  return types
    .model('DotplotView', {
      id: ElementId,
      type: types.literal('DotplotView'),
      headerHeight: 0,
      height: 600,
      borderSize: 20,
      tickSize: 5,
      vtextRotation: 0,
      htextRotation: -90,
      fontSize: 15,
      displayName: 'dotplot',
      trackSelectorType: 'hierarchical',
      assemblyNames: types.array(types.string),
      hview: types.optional(
        Base1DView.extend(self => ({
          views: {
            get width() {
              return getParent(self).viewWidth
            },
          },
        })),
        {},
      ),
      vview: types.optional(
        Base1DView.extend(self => ({
          views: {
            get width() {
              return getParent(self).viewHeight
            },
          },
        })),
        {},
      ),
      tracks: types.array(
        pluginManager.pluggableMstType(
          'track',
          'stateModel',
        ) as BaseTrackStateModel,
      ),
    })
    .volatile(() => ({
      width: 800,
      error: undefined as Error | undefined,
      borderX: 100,
      borderY: 100,
    }))
    .views(self => ({
      get initialized() {
        return (
          self.hview.displayedRegions.length > 0 &&
          self.vview.displayedRegions.length > 0
        )
      },

      get loading() {
        return self.assemblyNames.length > 0 && !this.initialized
      },
      get viewWidth() {
        return self.width - self.borderX
      },
      get viewHeight() {
        // console.log('height', self.height, 'borderY', self.borderY)
        return self.height - self.borderY
      },
      get views() {
        return [self.hview, self.vview]
      },
    }))
    .actions(self => ({
      afterAttach() {
        const session = getSession(self)
        addDisposer(
          self,
          autorun(
            () => {
              const axis = [self.viewWidth, self.viewHeight]
              const views = [self.hview, self.vview]
              if (!self.initialized) {
                self.assemblyNames.forEach((name, index) => {
                  const assembly = session.assemblyManager.get(name)
                  if (assembly) {
                    const { regions } = assembly
                    if (regions && regions.length) {
                      const regionsSnapshot = getSnapshot(regions)
                      if (regionsSnapshot) {
                        transaction(() => {
                          views[index].setDisplayedRegions(regionsSnapshot)
                          views[index].setBpPerPx(
                            views[index].totalBp / axis[index],
                          )
                        })
                      }
                    }
                  }
                })
              }
            },
            { delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(() => {
            const padding = 4
            // these are set via autorun to avoid dependency cycle
            this.setBorderY(
              self.hview.dynamicBlocks.contentBlocks.reduce(
                (a, b) =>
                  Math.max(a, approxPixelStringLen(b.refName.slice(0, 10))),
                0,
              ) + padding,
            )
            this.setBorderX(
              self.vview.dynamicBlocks.contentBlocks.reduce(
                (a, b) => Math.max(a, approxPixelStringLen(b.refName)),
                0,
              ) + padding,
            )
          }),
        )
      },
      setDisplayName(name: string) {
        self.displayName = name
      },
      setBorderX(n: number) {
        self.borderX = n
      },
      setBorderY(n: number) {
        self.borderY = n
      },

      setWidth(newWidth: number) {
        self.width = newWidth
      },
      setHeight(newHeight: number) {
        self.height = newHeight
      },

      setError(e: Error) {
        self.error = e
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toggleTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) this.showTrack(configuration)
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      showTrack(configuration: any, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }

        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)

        if (!trackType) {
          throw new Error(`unknown track type ${type}`)
        }
        self.tracks.push({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hideTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },
      setAssemblyNames(assemblyNames: string[]) {
        self.assemblyNames = cast(assemblyNames)
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

          const d1 = Base1DView.create(getSnapshot(self.hview))
          const d2 = Base1DView.create(getSnapshot(self.vview))
          d1.setVolatileWidth(self.hview.width)
          d2.setVolatileWidth(self.hview.width)
          d1.moveTo(x1, x2)
          d2.moveTo(y2, y1)

          // add the specific evidence tracks to the LGVs in the split view
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
            tracks: [
              {
                configuration: 'grape_peach_synteny_mcscan',
                type: 'LinearSyntenyTrack',
              },
            ],
            displayName: 'A vs B',
          }

          session.addView('LinearSyntenyView', viewSnapshot)
        }
      },
    }))
    .views(self => ({
      get menuOptions() {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          return [
            {
              label: 'Open track selector',
              onClick: self.activateTrackSelector,
              disabled:
                session.visibleWidget &&
                session.visibleWidget.id === 'hierarchicalTrackSelector' &&
                // @ts-ignore
                session.visibleWidget.view &&
                // @ts-ignore
                session.visibleWidget.view.id === self.id,
            },
          ]
        }
        return []
      },
    }))
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>
