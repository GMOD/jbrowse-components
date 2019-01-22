import { transaction } from 'mobx'
import {
  getEnv,
  getRoot,
  isStateTreeNode,
  types,
  getType,
  getParent,
} from 'mobx-state-tree'
import { getConf, readConfObject } from '../../../configuration'
import { ElementId, Region } from '../../../mst-types'
import { clamp } from '../../../util'
import PluginManager from '../../../PluginManager'
import TrackType from '../../../pluggableElementTypes/TrackType'

import LinearGenomeViewConfigSchema from './configSchema'

import BaseTrack from './baseTrack'
import calculateBlocks from './calculateBlocks'

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under root.configuration.tracks).

const ViewStateBase = types.model({
  // views have an auto-generated ID by default
  id: ElementId,
})

const minBpPerPx = 0.03

export default function LinearGenomeViewStateFactory(pluginManager) {
  return types
    .compose(
      'LinearGenomeView',
      ViewStateBase,
      types.model({
        id: ElementId,
        type: types.literal('LinearGenomeView'),
        offsetPx: 0,
        bpPerPx: 1,
        flipped: false,
        // we use an array for the tracks because the tracks are displayed in a specific
        // order that we need to keep.
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        controlsWidth: 120,
        displayedRegions: types.array(Region),
        configuration: LinearGenomeViewConfigSchema,
      }),
    )
    .views(self => ({
      get width() {
        return getEnv(self).testEnv ? 800 : getRoot(self).viewsWidth
      },
      get totalBlocksWidthPx() {
        return self.blocks.reduce((a, b) => a + b.widthPx, 0)
      },
      get maxBpPerPx() {
        const displayWidth = self.width - self.controlsWidth
        let totalbp = 0
        self.displayedRegions.forEach(region => {
          totalbp += region.end - region.start
        })
        return totalbp / displayWidth
      },
      get minBpPerPx() {
        return minBpPerPx
      },

      /**
       * calculate the blocks we should be showing
       */
      get blocks() {
        return calculateBlocks(self, self.horizontallyFlipped)
      },

      get horizontallyFlipped() {
        return getConf(self, 'reversed')
      },
    }))
    .actions(self => ({
      showTrack(configuration, initialSnapshot = {}) {
        const { type } = configuration
        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)
        if (!trackType) throw new Error(`unknown track type ${type}`)
        const track = trackType.stateModel.create(
          Object.assign({}, initialSnapshot, { name, type, configuration }),
        )
        self.tracks.push(track)
      },

      hideTrack(configuration) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      toggleTrack(configuration) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) self.showTrack(configuration)
      },

      displayRegions(regions) {
        self.displayedRegions = regions.map(r =>
          isStateTreeNode(r) ? r : Region.create(r),
        )
      },

      activateTrackSelector() {
        if (getType(self.configuration).name === 'AnonymousModel')
          throw new Error('this view should have a real configuration')
        const trackSelectorType = getConf(self, 'trackSelectorType')
        if (trackSelectorType === 'hierarchical') {
          const rootModel = getRoot(self)
          if (!rootModel.drawerWidgets.get('hierarchicalTrackSelector'))
            rootModel.addDrawerWidget(
              'HierarchicalTrackSelectorDrawerWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
          const selector = rootModel.drawerWidgets.get(
            'hierarchicalTrackSelector',
          )
          selector.setView(self)
          rootModel.setTask('track_select', self)
          rootModel.showDrawerWidget(selector)
        } else {
          throw new Error(`invalid track selector type ${trackSelectorType}`)
        }
      },

      zoomTo(newBpPerPx) {
        if (newBpPerPx === self.bpPerPx) return
        let bpPerPx = newBpPerPx
        if (bpPerPx < self.minBpPerPx) bpPerPx = self.minBpPerPx
        else if (bpPerPx > self.maxBpPerPx) bpPerPx = self.maxBpPerPx
        self.bpPerPx = bpPerPx
      },

      resizeTrack(trackId, distance) {
        const track = self.tracks.find(t => t.id === trackId)
        if (track) track.setHeight(track.height + distance)
      },

      horizontalScroll(distance) {
        const leftPadding = 10
        const rightPadding = 10
        const displayRegionsTotalPx = self.displayedRegions.reduce(
          (a, b) => a + (b.end - b.start) / self.bpPerPx,
          0,
        )
        const maxOffset = displayRegionsTotalPx - leftPadding
        const displayWidth = self.width - self.controlsWidth
        const minOffset = -displayWidth + rightPadding
        self.offsetPx = clamp(self.offsetPx + distance, minOffset, maxOffset)
      },

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
      },
    }))
}

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
const stubManager = new PluginManager()
stubManager.addTrackType(
  () =>
    new TrackType({
      name: 'Base',
      stateModel: BaseTrack,
      RenderingComponent: true,
    }),
)
stubManager.configure()
export const TestStub = LinearGenomeViewStateFactory(stubManager)
