/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSession } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { types, Instance } from 'mobx-state-tree'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { transaction } from 'mobx'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'

export type LGV = Instance<LinearGenomeViewStateModel>

type ConfigRelationship = { type: string; target: string }

export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const { types: jbrequiredTypes, getParent } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')

  const defaultHeight = 400
  return (jbrequiredTypes as Instance<typeof types>)
    .model('DotplotView', {
      id: ElementId,
      type: types.literal('DotplotView'),
      headerHeight: 0,
      width: 800,
      height: defaultHeight,
      borderSize: 20,
      fontSize: 15,
      displayName: 'dotplot',
      trackSelectorType: 'hierarchical',
      assemblyNames: types.array(types.string),
      views: types.frozen<
        { features: Feature[]; displayedRegions: IRegion[] }[]
      >(),
      tracks: types.array(
        pluginManager.pluggableMstType(
          'track',
          'stateModel',
        ) as BaseTrackStateModel,
      ),
    })
    .views(self => ({
      get totalBp() {
        return self.views.map(view =>
          view.displayedRegions
            .map(region => region.end - region.start)
            .reduce((a, b) => a + b, 0),
        )
      },
      get verticalBpPerPx() {
        return this.viewingRegionHeight / this.totalBp[1]
      },
      get horizontalBpPerPx() {
        return this.viewingRegionWidth / this.totalBp[0]
      },
      get viewingRegionWidth() {
        return self.width - self.borderSize * 2
      },
      get viewingRegionHeight() {
        return self.height - self.borderSize * 2
      },
    }))
    .actions(self => ({
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
