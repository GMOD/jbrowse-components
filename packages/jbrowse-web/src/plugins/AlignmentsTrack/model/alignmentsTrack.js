import { types, getRoot } from 'mobx-state-tree'

import { ConfigurationReference, getConf } from '../../../configuration'

import BlockBasedTrackComponent from '../../LinearGenomeView/components/BlockBasedTrack'

import BlockBasedTrack from '../../LinearGenomeView/models/blockBasedTrack'

import CompositeMap from '../../../util/compositeMap'
import TrackControls from '../components/TrackControls'
import { getParentRenderProps } from '../../../util/tracks'

// using a map because it preserves order
const rendererTypes = new Map([
  ['pileup', 'PileupRenderer'],
  ['svg', 'SvgFeatureRenderer'],
])

export default (pluginManager, configSchema) =>
  types.compose(
    'AlignmentsTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedRendering: types.optional(types.string, ''),
        height: types.optional(types.integer, 100),
      })
      .volatile(() => ({
        reactComponent: BlockBasedTrackComponent,
        rendererTypeChoices: Array.from(rendererTypes.keys()),
      }))
      // .actions(self => ({
      //   afterAttach() {
      //     onPatch(self, patch => {
      //       console.log('patch', self.name, patch)
      //     })
      //   },
      // }))
      .actions(self => ({
        selectFeature(feature) {
          const root = getRoot(self)
          if (!root.drawerWidgets.get('alignmentsFeature'))
            root.addDrawerWidget(
              'AlignmentsFeatureDrawerWidget',
              'alignmentsFeature',
            )
          const featureWidget = root.drawerWidgets.get('alignmentsFeature')
          featureWidget.setFeatureData(feature.data)
          root.showDrawerWidget(featureWidget)
          root.setSelection(feature)
        },
        clearFeatureSelection() {
          const root = getRoot(self)
          root.clearSelection()
        },
        setRenderer(newRenderer) {
          self.selectedRendering = newRenderer
        },
      }))
      .views(self => ({
        /**
         * the renderer type name is based on the "view"
         * selected in the UI: pileup, coverage, etc
         */
        get rendererTypeName() {
          const defaultRendering = getConf(self, 'defaultRendering')
          const viewName = self.selectedRendering || defaultRendering
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        get ControlsComponent() {
          return TrackControls
        },

        /**
         * returns a string feature ID if the globally-selected object
         * is probably a feature
         */
        get selectedFeatureId() {
          const root = getRoot(self)
          if (!root) return undefined
          const { selection } = root
          // does it quack like a feature?
          if (
            selection &&
            typeof selection.get === 'function' &&
            typeof selection.id === 'function'
          ) {
            // probably is a feature
            return selection.id()
          }
          return undefined
        },

        /**
         * the react props that are passed to the Renderer when data
         * is rendered in this track
         */
        get renderProps() {
          // view -> [tracks] -> [blocks]
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', self.rendererTypeName]) || {},
          )
          return {
            ...getParentRenderProps(self),
            config,
            trackModel: self,
            onFeatureClick(event, featureId) {
              // try to find the feature in our layout
              const feature = self.features.get(featureId)
              self.selectFeature(feature)
            },
            onClick() {
              self.clearFeatureSelection()
            },
          }
        },

        /**
         * a CompositeMap of featureId -> feature obj that
         * just looks in all the block data for that feature
         */
        get features() {
          const featureMaps = []
          for (const block of self.blockState.values()) {
            if (block.data && block.data.features)
              featureMaps.push(block.data.features)
          }
          return new CompositeMap(featureMaps)
        },
      })),
  )
