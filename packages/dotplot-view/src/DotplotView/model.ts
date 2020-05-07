import { getSession } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/util/types/mst'

import { types, Instance, SnapshotIn } from 'mobx-state-tree'
import { autorun, transaction } from 'mobx'

import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import { Dotplot1DViewStateModel } from './Dotplot1DViewModel'

function approxPixelStringLen(str: string) {
  return str.length * 0.7 * 12
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const { cast, types: jbrequiredTypes, getParent, addDisposer } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId } = jbrequire('@gmod/jbrowse-core/util/types/mst')
  const Dotplot1DViewModel = jbrequire(require('./Dotplot1DViewModel'))

  return (jbrequiredTypes as Instance<typeof types>)
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
        (Dotplot1DViewModel as Dotplot1DViewStateModel).extend(self => ({
          views: {
            get width() {
              return getParent(self).viewWidth
            },
          },
        })),
        {},
      ),
      vview: types.optional(
        (Dotplot1DViewModel as Dotplot1DViewStateModel).extend(self => ({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = getSession(self) as any
        addDisposer(
          self,
          autorun(
            async () => {
              const axis = [self.viewWidth, self.viewHeight]
              const views = [self.hview, self.vview]
              if (!self.initialized) {
                self.assemblyNames.forEach(async (name, index) => {
                  session
                    .getRegionsForAssemblyName(name)
                    .then((regions: IRegion[] | undefined) => {
                      if (regions !== undefined) {
                        transaction(() => {
                          views[index].setDisplayedRegions(regions)
                          views[index].setBpPerPx(
                            views[index].totalBp / axis[index],
                          )
                        })
                      } else {
                        this.setError(
                          new Error(
                            `failed to get regions for assembly ${self.assemblyNames[index]}`,
                          ),
                        )
                      }
                    })
                    .catch((e: Error) => {
                      this.setError(e)
                    })
                })
              }
            },
            { delay: 1000 },
          ),
        )
        addDisposer(
          self,
          autorun(async () => {
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
        self.hview.zoomOutButton()
        self.vview.zoomOutButton()
      },
      zoomInButton() {
        self.hview.zoomInButton()
        self.vview.zoomInButton()
      },
      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const session: any = getSession(self)
          const selector = session.addDrawerWidget(
            'HierarchicalTrackSelectorDrawerWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showDrawerWidget(selector)
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
      setViews(arr: SnapshotIn<Dotplot1DViewStateModel>[]) {
        self.hview = cast(arr[0])
        self.vview = cast(arr[1])
      },
    }))
    .views(self => ({
      get menuOptions() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session: any = getSession(self)
        return [
          {
            label: 'Open track selector',
            onClick: self.activateTrackSelector,
            disabled:
              session.visibleDrawerWidget &&
              session.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
              session.visibleDrawerWidget.view.id === self.id,
          },
        ]
      },
    }))
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>
