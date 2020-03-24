/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSession } from '@gmod/jbrowse-core/util'
import { Region, IRegion } from '@gmod/jbrowse-core/mst-types'

import { types, Instance } from 'mobx-state-tree'
import { autorun, transaction } from 'mobx'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'

import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'

export type LGV = Instance<LinearGenomeViewStateModel>

type ConfigRelationship = { type: string; target: string }

function totalBp(regions: IRegion[]) {
  return regions.map(a => a.end - a.start).reduce((a, b) => a + b, 0)
}

export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const { cast, types: jbrequiredTypes, getParent, addDisposer } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')

  const DotplotViewDirection = types
    .model('DotplotViewDirection', {
      displayedRegions: types.array(Region),
      bpPerPx: types.number,
      offsetPx: types.number,
    })
    .volatile(() => ({
      features: undefined as undefined | Feature[],
    }))
    .actions(self => ({
      setDisplayedRegions(regions: IRegion[]) {
        self.displayedRegions = cast(regions)
      },
      setBpToPx(val: number) {
        self.bpPerPx = val
      },
    }))
  return (jbrequiredTypes as Instance<typeof types>)
    .model('DotplotView', {
      id: ElementId,
      type: types.literal('DotplotView'),
      headerHeight: 0,
      width: 800,
      height: 600,
      borderSize: 20,
      fontSize: 15,
      displayName: 'dotplot',
      trackSelectorType: 'hierarchical',
      assemblyNames: types.array(types.string),
      views: types.array(DotplotViewDirection),
      tracks: types.array(
        pluginManager.pluggableMstType(
          'track',
          'stateModel',
        ) as BaseTrackStateModel,
      ),
    })
    .views(self => ({
      get viewingRegionWidth() {
        return self.width - self.borderSize * 2
      },
      get viewingRegionHeight() {
        return self.height - self.borderSize * 2
      },
    }))
    .actions(self => ({
      afterAttach() {
        const session = getSession(self) as any
        addDisposer(
          self,
          autorun(
            async () => {
              self.assemblyNames.forEach((name, index) => {
                const axis = [self.width, self.height]
                const regions = session.assemblyRegions.get(
                  self.assemblyNames[index],
                ) as IRegion[] | undefined
                if (regions === undefined) {
                  session
                    .getRegionsForAssemblyName(self.assemblyNames[index])
                    .then((displayRegions: IRegion[]) => {
                      self.views[index].setDisplayedRegions(displayRegions)
                      self.views[index].setBpToPx(
                        totalBp(displayRegions) / axis[index],
                      )
                    })
                } else {
                  self.views[index].setDisplayedRegions(regions as IRegion[])

                  self.views[index].setBpToPx(totalBp(regions) / axis[index])
                }
              })
            },
            { delay: 1000 },
          ),
        )
      },
      setDisplayName(name: string) {
        self.displayName = name
      },

      setWidth(newWidth: number) {
        self.width = newWidth
      },
      setHeight(newHeight: number) {
        self.height = newHeight
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setHeaderHeight(height: number) {
        self.headerHeight = height
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
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

      toggleTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) this.showTrack(configuration)
      },

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

      hideTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },
    }))
}

export type DotplotViewStateModel = ReturnType<typeof stateModelFactory>
export type DotplotViewModel = Instance<DotplotViewStateModel>
